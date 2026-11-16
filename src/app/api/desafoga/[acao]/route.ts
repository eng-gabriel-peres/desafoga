import { NextResponse, type NextRequest } from "next/server";
import { consumir, redeDe } from "@/lib/limite";
import { exigirAPropriaPessoa, SemPermissao, SemSessao } from "@/lib/desafoga/servidor/acesso";
import { ArquivoRecusado, lerFatura, receberArquivoNoChat, receberAudioNoChat } from "@/lib/desafoga/servidor/acoes";
import { acaoExiste, ErroDeEntrada, executar, recursoDa, type Contexto } from "@/lib/desafoga/servidor/rotas";
import { COOKIE_DA_SESSAO, lerSessao, type NovaSessao, type SessaoAtual } from "@/lib/desafoga/servidor/sessao";

/** Leitura de fatura e de áudio pela IA pode levar algumas dezenas de segundos. */
export const maxDuration = 180;

/** Ações que recebem arquivo (multipart): fatura e mensagem de voz. */
const COM_ARQUIVO = { "faturas.ler": "arquivo", "assistente.enviarArquivo": "arquivo", "assistente.enviarAudio": "audio" } as const;
type ComArquivo = keyof typeof COM_ARQUIVO;

const erro = (mensagem: string, status: number) => NextResponse.json({ erro: mensagem }, { status });

/**
 * API do app Desafoga. A sessão vem do cookie httpOnly. Toda chamada traz o
 * cabeçalho x-desafoga: um formulário de outro site não consegue mandá-lo
 * sem a permissão do navegador (CORS), o que barra pedidos forjados.
 */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/desafoga/[acao]">) {
  const { acao } = await params;
  if (request.headers.get("x-desafoga") !== "1") return erro("Cabeçalho x-desafoga ausente.", 400);

  const sessao = await lerSessao(request.cookies.get(COOKIE_DA_SESSAO)?.value);
  const rede = redeDe(request.headers);
  let novaSessao: NovaSessao | null | undefined;
  const contexto: Contexto = { rede, sessao, definirSessao: (nova) => (novaSessao = nova) };

  try {
    let dados: unknown;
    if (Object.hasOwn(COM_ARQUIVO, acao)) {
      dados = await comArquivo(acao as ComArquivo, sessao, request);
    } else {
      if (!acaoExiste(acao)) return erro("Ação desconhecida.", 404);
      const recurso = recursoDa(acao);
      if (recurso) {
        // Criar conta ou demo conta pela rede: uma conta nova não ganha cota nova.
        const quem = recurso === "conta" ? (rede ?? "anonimo") : (sessao?.id ?? rede ?? "anonimo");
        const uso = await consumir(recurso, `desafoga:${quem}`, rede);
        if (!uso.permitido) return erro(uso.mensagem ?? "Limite de uso de hoje atingido.", 429);
      }
      const corpo = (await request.json().catch(() => ({}))) as { args?: unknown };
      dados = await executar(acao, corpo.args, contexto);
    }
    const resposta = NextResponse.json({ dados: dados ?? null });
    if (novaSessao !== undefined) gravarCookie(resposta, novaSessao);
    return resposta;
  } catch (e) {
    if (e instanceof SemSessao) return erro(e.message, 401);
    if (e instanceof SemPermissao) return erro(e.message, 403);
    if (e instanceof ErroDeEntrada || e instanceof ArquivoRecusado) return erro(e.message, 400);
    console.error("Desafoga API:", acao, e instanceof Error ? e.message.slice(0, 300) : "erro");
    return erro("Não consegui fazer isso agora. Tente de novo.", 500);
  }
}

function gravarCookie(resposta: NextResponse, nova: NovaSessao | null) {
  if (!nova) {
    resposta.cookies.delete(COOKIE_DA_SESSAO);
    return;
  }
  resposta.cookies.set(COOKIE_DA_SESSAO, nova.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: nova.expira,
  });
}

async function comArquivo(acao: ComArquivo, sessao: SessaoAtual | null, request: NextRequest) {
  const formulario = await request.formData().catch(() => null);
  if (!formulario) throw new ErroDeEntrada("Envie em multipart/form-data.");
  const pessoaId = formulario.get("pessoaId");
  const arquivo = formulario.get("arquivo");
  if (typeof pessoaId !== "string") throw new ErroDeEntrada('Envie "pessoaId".');
  exigirAPropriaPessoa(sessao, pessoaId);

  if (arquivo instanceof File) {
    const uso = await consumir(COM_ARQUIVO[acao], `desafoga:${pessoaId}`, redeDe(request.headers));
    if (!uso.permitido) throw new ErroDeEntrada(uso.mensagem ?? "Limite de uso de hoje atingido.");
  }
  const lido = arquivo instanceof File ? { bytes: new Uint8Array(await arquivo.arrayBuffer()), mime: arquivo.type, nome: arquivo.name } : null;

  if (acao === "faturas.ler") return lerFatura(pessoaId, lido);
  if (!lido) throw new ErroDeEntrada('Envie o campo "arquivo".');
  if (acao === "assistente.enviarArquivo") return receberArquivoNoChat(pessoaId, "app", lido);
  return receberAudioNoChat(pessoaId, "app", lido);
}
