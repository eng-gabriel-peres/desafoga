/**
 * A Luana no servidor: texto, arquivo e áudio, no app e no WhatsApp, com os
 * dados no banco. Quem chama já conferiu a permissão (acesso.ts).
 */
import { FATURA_DE_EXEMPLO, materializarFatura } from "@/fixtures/desafoga";
import { gerarTexto } from "@/lib/ia/gemini";
import { ESTADO_INICIAL } from "@/lib/assistente/conversa";
import { lerAudio, lerDocumento, lerMensagem } from "@/lib/luana/ler";
import { TIPOS_DE_AUDIO, TAMANHO_MAXIMO } from "@/lib/luana/luana";
import type { Fatura, Mensagem } from "@/services/tipos";
import { conversar, type Canal, type DadosDaConversa, type IaDaConversa } from "../conversar";
import { paraFatura, respostaDaFatura } from "../fatura-lida";
import * as repo from "./repositorio";

const TIPOS_DE_DOCUMENTO = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Gemini, quando há chave; sem chave, a Luana responde só por regras. */
export function iaDisponivel(): IaDaConversa | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return { lerMensagem, redigir: (sistema, conteudo) => gerarTexto(sistema, conteudo) };
}

/** A conversa lendo e gravando no banco. */
const dadosNoBanco: DadosDaConversa = {
  contexto: (pessoaId, canal, agora) => repo.contextoDoAssistente(pessoaId, canal, agora),
  estado: (pessoaId, canal) => repo.estado(pessoaId, canal),
  conversaRecente: (pessoaId, canal) => repo.conversaRecente(pessoaId, canal),
  async concluir(pessoaId, canal, resultado, agora) {
    for (const e of resultado.efeitos) {
      if (e.tipo === "registrar-compra") await repo.registrarCompra(pessoaId, e.compra, agora);
      else if (e.tipo === "guardar-na-meta") await repo.guardarNaMeta(pessoaId, e.metaId, { valor: e.valor, descricao: e.descricao, via: canal }, agora);
      else await repo.avisar(pessoaId, e.aviso.tipo, e.aviso.texto, agora);
    }
    await repo.guardarEstado(pessoaId, canal, resultado.estado);
    return repo.guardarMensagens(
      pessoaId,
      canal,
      resultado.respostas.map((r) => ({ de: "assistente" as const, texto: r.texto, respostasRapidas: r.respostasRapidas, quando: agora })),
    );
  },
};

export async function responderTexto(pessoaId: string, canal: Canal, texto: string): Promise<Mensagem[]> {
  await repo.guardarMensagens(pessoaId, canal, [{ de: "pessoa", texto }]);
  return conversar(dadosNoBanco, pessoaId, canal, texto, { ia: iaDisponivel() });
}

/** Simula a resposta sem gravar nada ("Testar o assistente", no painel). */
export async function testarResposta(pessoaId: string, texto: string): Promise<string> {
  let respostas: string[] = [];
  const semGravar: DadosDaConversa = {
    ...dadosNoBanco,
    estado: async () => ESTADO_INICIAL,
    async concluir(_p, _c, resultado) {
      respostas = resultado.respostas.map((r) => r.texto);
      return [];
    },
  };
  await conversar(semGravar, pessoaId, "app", texto, { ia: iaDisponivel() });
  return respostas.join("\n\n");
}

export class ArquivoRecusado extends Error {}

/** Lê uma fatura, extrato ou print. Com IA, lê o arquivo de verdade; sem IA (ou sem arquivo), usa o exemplo. */
export async function lerFatura(pessoaId: string, arquivo: { bytes: Uint8Array; mime: string } | null): Promise<{ fatura: Fatura; deExemplo: boolean }> {
  const agora = new Date();
  if (arquivo) {
    if (!TIPOS_DE_DOCUMENTO.includes(arquivo.mime)) throw new ArquivoRecusado("Só leio PDF ou foto (JPG, PNG, WebP).");
    if (arquivo.bytes.byteLength > TAMANHO_MAXIMO) throw new ArquivoRecusado("O arquivo passa de 4 MB.");
  }
  if (arquivo && iaDisponivel()) {
    const doc = await lerDocumento(arquivo.bytes, arquivo.mime, hoje());
    if (!doc.legivel || doc.lancamentos.length === 0) {
      throw new ArquivoRecusado("Não achei lançamentos nesse arquivo. Mande a fatura em PDF ou um print nítido.");
    }
    return { fatura: paraFatura(doc, await repo.compras(pessoaId), agora, crypto.randomUUID()), deExemplo: false };
  }
  // Exemplo só faz sentido nos dados de demonstração; em conta real, sem IA, avisamos.
  return { fatura: { ...materializarFatura(FATURA_DE_EXEMPLO, agora), id: crypto.randomUUID() }, deExemplo: true };
}

/** Arquivo mandado no chat (app ou WhatsApp): lê, guarda e responde com o resumo. */
export async function receberArquivoNoChat(
  pessoaId: string,
  canal: Canal,
  arquivo: { bytes: Uint8Array; mime: string; nome: string },
): Promise<Mensagem[]> {
  if (canal === "app") await repo.guardarMensagens(pessoaId, canal, [{ de: "pessoa", texto: `Arquivo: ${arquivo.nome}` }]);
  let resposta: string;
  try {
    const lida = await lerFatura(pessoaId, arquivo);
    await repo.salvarFatura(pessoaId, lida.fatura);
    resposta =
      respostaDaFatura(lida.fatura, canal) + (lida.deExemplo ? "\n(Demonstração sem IA: li um extrato de exemplo no lugar do arquivo.)" : "");
  } catch (erro) {
    resposta = erro instanceof ArquivoRecusado ? erro.message : "Não consegui ler o arquivo agora. Tente de novo em instantes.";
  }
  return repo.guardarMensagens(pessoaId, canal, [{ de: "assistente", texto: resposta }]);
}

/** Mensagem de voz: a IA transcreve e a conversa segue como se fosse texto. */
export async function receberAudioNoChat(
  pessoaId: string,
  canal: Canal,
  audio: { bytes: Uint8Array; mime: string },
): Promise<{ transcricao: string; respostas: Mensagem[] }> {
  const tipo = audio.mime.split(";")[0].trim().toLowerCase();
  const ia = iaDisponivel();
  const falha = async (texto: string) => ({
    transcricao: "",
    respostas: await repo.guardarMensagens(pessoaId, canal, [
      ...(canal === "app" ? [{ de: "pessoa" as const, texto: "Mensagem de voz" }] : []),
      { de: "assistente" as const, texto },
    ]),
  });
  if (!TIPOS_DE_AUDIO.includes(tipo) || audio.bytes.byteLength > TAMANHO_MAXIMO) return falha("Não consegui abrir esse áudio. Grave de novo, mais curto, ou escreva.");
  if (!ia) return falha("Nesta demonstração estou sem a IA que transcreve áudio. Pode escrever a mensagem?");

  let lida;
  try {
    lida = await lerAudio(audio.bytes, tipo, hoje());
  } catch {
    return falha("Não consegui ouvir agora. Tente de novo ou escreva a mensagem.");
  }
  const transcricao = lida.transcricao?.trim() ?? "";
  if (!transcricao) return falha("Não entendi o áudio. Pode gravar de novo, mais perto do microfone?");

  await repo.guardarMensagens(pessoaId, canal, [{ de: "pessoa", texto: canal === "app" ? `Mensagem de voz: ${transcricao}` : transcricao }]);
  const respostas = await conversar(dadosNoBanco, pessoaId, canal, transcricao, { ia, lida });
  return { transcricao, respostas };
}

