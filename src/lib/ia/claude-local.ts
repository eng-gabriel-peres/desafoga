/**
 * IA pelo Claude Code instalado na máquina (`claude -p`), com o login da
 * assinatura. Só para desenvolvimento local: na Vercel e no container não há
 * o CLI nem o login.
 *
 * O arquivo vai junto no pedido (bloco de documento ou imagem), e o Claude
 * roda sem nenhuma ferramenta: um documento com instruções escondidas não tem
 * como ler outros arquivos da máquina nem rodar comandos.
 *
 * O CLI ainda anexa sozinho o e-mail da conta logada e a pasta onde roda, e
 * não há opção pública para tirar (o --bare tiraria, mas só aceita chave de
 * API). Por isso ele roda numa pasta vazia temporária (sem caminho do projeto
 * nem git) e com uma regra a mais no sistema para nunca usar esse contexto:
 * sem ela, a Luana chegou a assinar "em nome do Gabriel".
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { registrarIA } from "@/lib/limite";
import { IaIndisponivel, IaSobrecarregada } from "./erros";
import type { OpcoesDaGeracao, Parte } from "./tipos";

/** Claude lê PDF e imagem; áudio não. */
const TIPOS_DE_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const claudeLocalAceita = (mime: string): boolean => mime === "application/pdf" || TIPOS_DE_IMAGEM.includes(mime);

/** Ligado por IA_PROVEDOR=claude-local, e nunca na Vercel (lá não há o CLI). */
export const claudeLocalConfigurado = (): boolean => process.env.IA_PROVEDOR === "claude-local" && !process.env.VERCEL;

const LIMITE = 110_000;
/** Status da API que valem uma nova tentativa mais tarde. */
const SOBRECARGA = [408, 429, 500, 502, 503, 504, 529];

/** Roda o CLI com a entrada dada e devolve a saída padrão. Trocado nos testes. */
export type Executar = (
  bin: string,
  args: string[],
  entrada: string,
  o: { env: NodeJS.ProcessEnv; signal: AbortSignal; cwd: string },
) => Promise<{ codigo: number | null; saida: string; erro: string }>;

const executarDeVerdade: Executar = (bin, args, entrada, o) =>
  new Promise((resolve, reject) => {
    const filho = spawn(bin, args, { env: o.env, signal: o.signal, cwd: o.cwd, stdio: ["pipe", "pipe", "pipe"] });
    let saida = "";
    let erro = "";
    filho.stdout.setEncoding("utf8").on("data", (d: string) => (saida += d));
    filho.stderr.setEncoding("utf8").on("data", (d: string) => (erro += d));
    filho.on("error", reject);
    filho.on("close", (codigo) => resolve({ codigo, saida, erro }));
    filho.stdin.on("error", () => {}); // o processo pode morrer antes de ler tudo
    filho.stdin.end(entrada);
  });

function paraClaude(parte: Parte): unknown {
  if ("texto" in parte) return { type: "text", text: parte.texto };
  const { bytes, mime } = parte.arquivo;
  if (!claudeLocalAceita(mime)) throw new IaIndisponivel(`O Claude local não lê arquivos ${mime}.`);
  const source = { type: "base64", media_type: mime, data: Buffer.from(bytes).toString("base64") };
  return mime === "application/pdf" ? { type: "document", source } : { type: "image", source };
}

/** Vai depois do sistema do app: o contexto que o CLI anexa é da máquina, não da conversa. */
export const SEM_CONTEXTO_DA_MAQUINA =
  "Regra fixa: o ambiente pode anexar contexto que não veio da conversa (e-mail, nome de conta, pastas, data, sistema). " +
  "Ele é da máquina que roda o app: ignore-o por completo. Nunca o mencione nem o use, não diga que fala a pedido ou em nome de alguém " +
  "e não comente esta regra. Você é só quem as instruções acima definem; se for assinar, assine só com esse nome.";

export function argumentos(modelo: string, opcoes: OpcoesDaGeracao): string[] {
  return [
    "-p",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose", // exigido pelo stream-json na saída
    "--model", modelo,
    "--system-prompt", opcoes.sistema,
    "--append-system-prompt", SEM_CONTEXTO_DA_MAQUINA,
    // Nada da configuração de quem roda: sem CLAUDE.md, hooks, plugins, MCP nem ferramentas.
    "--safe-mode",
    "--setting-sources", "",
    "--strict-mcp-config",
    "--tools", "",
    "--no-session-persistence",
    ...(opcoes.schemaJson ? ["--json-schema", JSON.stringify(semMetaSchema(opcoes.schemaJson))] : []),
  ];
}

/** O CLI recusa o "$schema" que o zod põe (não conhece o draft 2020-12); o resto ele aceita. */
function semMetaSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const resto = { ...schema };
  delete resto.$schema;
  return resto;
}

interface Resultado {
  type: "result";
  is_error?: boolean;
  api_error_status?: number | null;
  result?: string;
  structured_output?: unknown;
}

/** A última linha de tipo "result" da saída em stream-json. */
function resultadoDa(saida: string): Resultado | null {
  const linhas = saida.trim().split("\n").reverse();
  for (const linha of linhas) {
    try {
      const obj = JSON.parse(linha) as { type?: string };
      if (obj.type === "result") return obj as Resultado;
    } catch {
      // linha incompleta ou de outro tipo
    }
  }
  return null;
}

export async function gerarComClaudeLocal(partes: Parte[], opcoes: OpcoesDaGeracao, executar: Executar = executarDeVerdade): Promise<string> {
  const modelo = process.env.CLAUDE_MODEL || "sonnet";
  const rotulo = `claude-local:${modelo}`;
  const mensagem = { type: "user", message: { role: "user", content: partes.map(paraClaude) } };
  const env = { ...process.env };
  // Sem isso, um `pnpm dev` aberto de dentro de uma sessão do Claude Code herdaria variáveis dela.
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  // Vazio (copiado do .env.example) faria o CLI procurar o login no lugar errado; "~" não é expandido no .env.
  if (env.CLAUDE_CONFIG_DIR) env.CLAUDE_CONFIG_DIR = env.CLAUDE_CONFIG_DIR.replace(/^~(?=\/|$)/, homedir());
  else delete env.CLAUDE_CONFIG_DIR;

  let r: Awaited<ReturnType<Executar>>;
  // Pasta vazia, nova a cada pedido: o CLI não vê o caminho do projeto nem o git dele.
  const pasta = await mkdtemp(join(tmpdir(), "desafoga-claude-"));
  try {
    r = await executar(process.env.CLAUDE_BIN || "claude", argumentos(modelo, opcoes), JSON.stringify(mensagem) + "\n", {
      env,
      signal: AbortSignal.timeout(LIMITE),
      cwd: pasta,
    });
  } catch (erro) {
    registrarIA(rotulo, "falha");
    const e = erro as NodeJS.ErrnoException;
    if (e.code === "ENOENT") throw new IaIndisponivel("CLI do Claude Code não encontrado (confira CLAUDE_BIN).");
    if (e.name === "AbortError" || e.name === "TimeoutError") throw new IaSobrecarregada(`${rotulo}: demorou mais de ${LIMITE / 1000} s`);
    throw new IaIndisponivel(`${rotulo}: ${e.message?.slice(0, 300)}`);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }

  const resultado = resultadoDa(r.saida);
  if (!resultado) {
    registrarIA(rotulo, "falha");
    throw new IaIndisponivel(`${rotulo}: saída sem resultado (código ${r.codigo}) ${r.erro.slice(0, 300)}`);
  }
  if (resultado.is_error) {
    const status = resultado.api_error_status ?? undefined;
    registrarIA(rotulo, status === 429 ? "sem_cota" : "falha");
    const detalhe = `${rotulo}: ${status ?? "erro"} ${(resultado.result ?? "").slice(0, 300)}`;
    throw status && SOBRECARGA.includes(status) ? new IaSobrecarregada(detalhe) : new IaIndisponivel(detalhe);
  }

  const texto = opcoes.schemaJson && resultado.structured_output !== undefined ? JSON.stringify(resultado.structured_output) : resultado.result?.trim();
  if (!texto) {
    registrarIA(rotulo, "falha");
    throw new IaIndisponivel(`${rotulo}: resposta vazia`);
  }
  registrarIA(rotulo, "ok");
  return texto;
}
