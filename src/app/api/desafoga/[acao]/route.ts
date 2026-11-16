import { NextResponse, type NextRequest } from "next/server";
import { consumir, redeDe } from "@/lib/limite";
import { usuarioValido } from "@/lib/luana/usuario";
import { ArquivoRecusado, lerFatura, receberArquivoNoChat, receberAudioNoChat } from "@/lib/desafoga/servidor/acoes";
import { acaoExiste, ErroDeEntrada, executar, recursoDa } from "@/lib/desafoga/servidor/rotas";

/** Leitura de fatura e de áudio pela IA pode levar algumas dezenas de segundos. */
export const maxDuration = 180;

/** Ações que recebem arquivo (multipart): fatura e mensagem de voz. */
const COM_ARQUIVO = ["faturas.ler", "assistente.enviarArquivo", "assistente.enviarAudio"] as const;
type ComArquivo = (typeof COM_ARQUIVO)[number];
const RECURSO_DO_ARQUIVO: Record<ComArquivo, "arquivo" | "audio"> = {
  "faturas.ler": "arquivo",
  "assistente.enviarArquivo": "arquivo",
  "assistente.enviarAudio": "audio",
};

const erro = (mensagem: string, status: number) => NextResponse.json({ erro: mensagem }, { status });

/**
 * API do app Desafoga. O navegador manda um identificador próprio no
 * cabeçalho x-desafoga-visitante: cada um tem a sua cópia dos dados da demo.
 */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/desafoga/[acao]">) {
  const { acao } = await params;
  const visitante = request.headers.get("x-desafoga-visitante");
  if (!usuarioValido(visitante)) return erro("Cabeçalho x-desafoga-visitante ausente ou inválido.", 400);

  try {
    if ((COM_ARQUIVO as readonly string[]).includes(acao)) {
      return NextResponse.json(await comArquivo(acao as ComArquivo, visitante, request));
    }
    if (!acaoExiste(acao)) return erro("Ação desconhecida.", 404);

    const recurso = recursoDa(acao);
    if (recurso) {
      const uso = await consumir(recurso, `desafoga:${visitante}`, redeDe(request.headers));
      if (!uso.permitido) return erro(uso.mensagem ?? "Limite de uso de hoje atingido.", 429);
    }
    const corpo = (await request.json().catch(() => ({}))) as { args?: unknown };
    return NextResponse.json({ dados: (await executar(acao, visitante, corpo.args)) ?? null });
  } catch (e) {
    if (e instanceof ErroDeEntrada || e instanceof ArquivoRecusado) return erro(e.message, 400);
    if (e instanceof Error && e.message.startsWith("Pessoa não encontrada")) return erro(e.message, 404);
    console.error("Desafoga API:", acao, e instanceof Error ? e.message.slice(0, 300) : "erro");
    return erro("Não consegui fazer isso agora. Tente de novo.", 500);
  }
}

async function comArquivo(acao: ComArquivo, visitante: string, request: NextRequest) {
  const formulario = await request.formData().catch(() => null);
  if (!formulario) throw new ErroDeEntrada("Envie em multipart/form-data.");
  const pessoaId = formulario.get("pessoaId");
  const arquivo = formulario.get("arquivo");
  if (typeof pessoaId !== "string" || !pessoaId) throw new ErroDeEntrada('Envie "pessoaId".');

  if (arquivo instanceof File) {
    const uso = await consumir(RECURSO_DO_ARQUIVO[acao], `desafoga:${visitante}`, redeDe(request.headers));
    if (!uso.permitido) throw new ErroDeEntrada(uso.mensagem ?? "Limite de uso de hoje atingido.");
  }
  const lido = arquivo instanceof File ? { bytes: new Uint8Array(await arquivo.arrayBuffer()), mime: arquivo.type, nome: arquivo.name } : null;

  if (acao === "faturas.ler") return { dados: await lerFatura(visitante, pessoaId, lido) };
  if (!lido) throw new ErroDeEntrada('Envie o campo "arquivo".');
  if (acao === "assistente.enviarArquivo") return { dados: await receberArquivoNoChat(visitante, pessoaId, "app", lido) };
  return { dados: await receberAudioNoChat(visitante, pessoaId, "app", lido) };
}
