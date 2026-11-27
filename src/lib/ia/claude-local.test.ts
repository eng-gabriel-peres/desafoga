import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registros: [string, string][] = [];
vi.mock("@/lib/limite", () => ({ registrarIA: (modelo: string, r: string) => registros.push([modelo, r]) }));

const { argumentos, gerarComClaudeLocal, SEM_CONTEXTO_DA_MAQUINA } = await import("./claude-local");
const { IaIndisponivel, IaSobrecarregada } = await import("./erros");
type Executar = import("./claude-local").Executar;

const resultado = (campos: Record<string, unknown>) =>
  [JSON.stringify({ type: "system", subtype: "init" }), JSON.stringify({ type: "result", is_error: false, ...campos })].join("\n");

function falso(saida: string, codigo = 0) {
  const chamadas: { bin: string; args: string[]; entrada: string; env: NodeJS.ProcessEnv; cwd: string; vazia: boolean }[] = [];
  const executar: Executar = async (bin, args, entrada, o) => {
    chamadas.push({ bin, args, entrada, env: o.env, cwd: o.cwd, vazia: (await readdir(o.cwd)).length === 0 });
    return { codigo, saida, erro: "" };
  };
  return { executar, chamadas };
}

beforeEach(() => {
  registros.length = 0;
  vi.stubEnv("CLAUDE_MODEL", "");
  vi.stubEnv("CLAUDE_BIN", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("Claude local", () => {
  it("roda sem ferramentas e sem a configuração de quem roda", () => {
    const args = argumentos("sonnet", { sistema: "regras" });
    expect(args).toEqual(expect.arrayContaining(["-p", "--safe-mode", "--strict-mcp-config", "--no-session-persistence"]));
    expect(args[args.indexOf("--tools") + 1]).toBe("");
    expect(args[args.indexOf("--setting-sources") + 1]).toBe("");
    expect(args[args.indexOf("--system-prompt") + 1]).toBe("regras");
    expect(args[args.indexOf("--append-system-prompt") + 1]).toBe(SEM_CONTEXTO_DA_MAQUINA);
    expect(args).not.toContain("--json-schema");
  });

  it("roda numa pasta vazia temporária, fora do projeto, e apaga a pasta depois", async () => {
    const { executar, chamadas } = falso(resultado({ result: "ok" }));
    await gerarComClaudeLocal([{ texto: "a" }], { sistema: "s" }, executar);
    const { cwd, vazia } = chamadas[0];
    expect(cwd).not.toBe(process.cwd());
    expect(cwd.startsWith(process.cwd())).toBe(false);
    expect(vazia).toBe(true);
    expect(existsSync(cwd)).toBe(false);
  });

  it("apaga a pasta temporária também quando o CLI falha", async () => {
    let pasta = "";
    const falha: Executar = async (_b, _a, _e, o) => {
      pasta = o.cwd;
      throw new Error("quebrou");
    };
    await expect(gerarComClaudeLocal([{ texto: "a" }], { sistema: "s" }, falha)).rejects.toBeInstanceOf(IaIndisponivel);
    expect(pasta).not.toBe("");
    expect(existsSync(pasta)).toBe(false);
  });

  it("manda o PDF e a imagem dentro do pedido e devolve o JSON estruturado", async () => {
    const { executar, chamadas } = falso(resultado({ result: "ignorado", structured_output: { total: "1.234,56" } }));
    const schemaJson = { type: "object", properties: { total: { type: "string" } } };
    const comMeta = { $schema: "https://json-schema.org/draft/2020-12/schema", ...schemaJson };
    const texto = await gerarComClaudeLocal(
      [
        { arquivo: { bytes: new Uint8Array([1, 2]), mime: "application/pdf" } },
        { arquivo: { bytes: new Uint8Array([3]), mime: "image/png" } },
        { texto: "Leia." },
      ],
      { sistema: "s", schemaJson: comMeta },
      executar,
    );

    expect(JSON.parse(texto)).toEqual({ total: "1.234,56" });
    const { bin, args, entrada } = chamadas[0];
    expect(bin).toBe("claude");
    expect(args[args.indexOf("--model") + 1]).toBe("sonnet");
    expect(JSON.parse(args[args.indexOf("--json-schema") + 1])).toEqual(schemaJson);
    const conteudo = JSON.parse(entrada).message.content;
    expect(conteudo.map((c: { type: string }) => c.type)).toEqual(["document", "image", "text"]);
    expect(conteudo[0].source).toEqual({ type: "base64", media_type: "application/pdf", data: "AQI=" });
    expect(registros).toEqual([["claude-local:sonnet", "ok"]]);
  });

  it("usa CLAUDE_BIN e CLAUDE_MODEL e devolve o texto livre", async () => {
    vi.stubEnv("CLAUDE_BIN", "/opt/claude");
    vi.stubEnv("CLAUDE_MODEL", "opus");
    vi.stubEnv("CLAUDECODE", "1");
    const { executar, chamadas } = falso(resultado({ result: "  Oi!  " }));
    expect(await gerarComClaudeLocal([{ texto: "oi" }], { sistema: "s" }, executar)).toBe("Oi!");
    expect(chamadas[0].bin).toBe("/opt/claude");
    expect(chamadas[0].args[chamadas[0].args.indexOf("--model") + 1]).toBe("opus");
    expect(chamadas[0].env.CLAUDECODE).toBeUndefined();
  });

  it("expande ~ em CLAUDE_CONFIG_DIR e descarta o valor vazio", async () => {
    const { homedir } = await import("node:os");
    const { executar, chamadas } = falso(resultado({ result: "ok" }));
    vi.stubEnv("CLAUDE_CONFIG_DIR", "~/.claude-trabalho");
    await gerarComClaudeLocal([{ texto: "a" }], { sistema: "s" }, executar);
    vi.stubEnv("CLAUDE_CONFIG_DIR", "");
    await gerarComClaudeLocal([{ texto: "a" }], { sistema: "s" }, executar);
    expect(chamadas[0].env.CLAUDE_CONFIG_DIR).toBe(`${homedir()}/.claude-trabalho`);
    expect("CLAUDE_CONFIG_DIR" in chamadas[1].env).toBe(false);
  });

  it("recusa áudio sem chamar o CLI", async () => {
    const { executar, chamadas } = falso(resultado({ result: "x" }));
    await expect(gerarComClaudeLocal([{ arquivo: { bytes: new Uint8Array(), mime: "audio/ogg" } }], { sistema: "s" }, executar)).rejects.toBeInstanceOf(IaIndisponivel);
    expect(chamadas).toHaveLength(0);
  });

  it("sobrecarga e falta de cota viram IaSobrecarregada; o resto, IaIndisponivel", async () => {
    const sem = falso(resultado({ is_error: true, api_error_status: 429, result: "limite" }));
    await expect(gerarComClaudeLocal([{ texto: "a" }], { sistema: "s" }, sem.executar)).rejects.toBeInstanceOf(IaSobrecarregada);
    expect(registros.at(-1)).toEqual(["claude-local:sonnet", "sem_cota"]);

    const modelo = falso(resultado({ is_error: true, api_error_status: 404, result: "modelo" }));
    const erro = await gerarComClaudeLocal([{ texto: "a" }], { sistema: "s" }, modelo.executar).catch((e) => e);
    expect(erro).toBeInstanceOf(IaIndisponivel);
    expect(erro).not.toBeInstanceOf(IaSobrecarregada);

    const quebrado = falso("não é json", 1);
    await expect(gerarComClaudeLocal([{ texto: "a" }], { sistema: "s" }, quebrado.executar)).rejects.toBeInstanceOf(IaIndisponivel);
  });

  it("sem o CLI instalado ou com tempo esgotado, diz qual foi o problema", async () => {
    const semCli: Executar = async () => {
      throw Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" });
    };
    await expect(gerarComClaudeLocal([{ texto: "a" }], { sistema: "s" }, semCli)).rejects.toThrow(/CLAUDE_BIN/);

    const lento: Executar = async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    };
    await expect(gerarComClaudeLocal([{ texto: "a" }], { sistema: "s" }, lento)).rejects.toBeInstanceOf(IaSobrecarregada);
  });
});
