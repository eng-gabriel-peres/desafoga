/**
 * Ações do Desafoga no servidor, usadas pela API do app e pelo WhatsApp.
 * Toda leitura e escrita passa por `comBanco`, que carrega e salva os dados.
 */
import { FATURA_DE_EXEMPLO, materializarFatura } from "@/fixtures/desafoga";
import { gerarTexto } from "@/lib/ia/gemini";
import { lerAudio, lerDocumento, lerMensagem } from "@/lib/luana/ler";
import { TIPOS_DE_AUDIO, TAMANHO_MAXIMO } from "@/lib/luana/luana";
import { novoId, pessoa, salvarFatura, type Canal } from "@/services/nucleo";
import type { Fatura, Mensagem } from "@/services/tipos";
import { conversar, type IaDaConversa } from "../conversar";
import { paraFatura, respostaDaFatura } from "../fatura-lida";
import { comBanco } from "./armazem";

const TIPOS_DE_DOCUMENTO = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Gemini, quando há chave; sem chave, a Luana responde só por regras. */
export function iaDisponivel(): IaDaConversa | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return { lerMensagem, redigir: (sistema, conteudo) => gerarTexto(sistema, conteudo) };
}

export function responderTexto(visitante: string, pessoaId: string, canal: Canal, texto: string): Promise<Mensagem[]> {
  return comBanco(visitante, async (banco) => {
    if (canal === "app") {
      const dados = pessoa(banco, pessoaId);
      dados.conversa.forEach((m) => delete m.respostasRapidas);
      dados.conversa.push({ id: novoId("msg"), de: "pessoa", texto, quando: new Date().toISOString() });
    }
    return conversar(banco, pessoaId, canal, texto, { ia: iaDisponivel() });
  });
}

/** Simula a resposta sem gravar nada ("Testar o assistente"). */
export function testarResposta(visitante: string, pessoaId: string, texto: string): Promise<string> {
  return comBanco(
    visitante,
    async (banco) => {
      const copia = structuredClone(banco);
      copia.estados[pessoaId] = { ...copia.estados[pessoaId], app: { etapa: "livre" } };
      const respostas = await conversar(copia, pessoaId, "app", texto, { ia: iaDisponivel() });
      return respostas.map((r) => r.texto).join("\n\n");
    },
    false,
  );
}

export class ArquivoRecusado extends Error {}

/**
 * Lê uma fatura, extrato ou print. Com IA, lê o arquivo de verdade; sem IA
 * (ou sem arquivo), usa o documento de exemplo.
 */
export async function lerFatura(
  visitante: string,
  pessoaId: string,
  arquivo: { bytes: Uint8Array; mime: string } | null,
): Promise<{ fatura: Fatura; deExemplo: boolean }> {
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
    const compras = await comBanco(visitante, (b) => pessoa(b, pessoaId).compras, false);
    return { fatura: paraFatura(doc, compras, agora, novoId("fatura")), deExemplo: false };
  }
  return { fatura: { ...materializarFatura(FATURA_DE_EXEMPLO, agora), id: novoId("fatura") }, deExemplo: true };
}

/** Arquivo mandado no chat (app ou WhatsApp): lê, guarda e responde com o resumo. */
export async function receberArquivoNoChat(
  visitante: string,
  pessoaId: string,
  canal: Canal,
  arquivo: { bytes: Uint8Array; mime: string; nome: string },
): Promise<Mensagem[]> {
  let resposta: string;
  let fatura: Fatura | null = null;
  try {
    const lida = await lerFatura(visitante, pessoaId, arquivo);
    fatura = lida.fatura;
    resposta = respostaDaFatura(lida.fatura, canal) + (lida.deExemplo ? "\n(Demonstração sem IA: li um extrato de exemplo no lugar do arquivo.)" : "");
  } catch (erro) {
    resposta = erro instanceof ArquivoRecusado ? erro.message : "Não consegui ler o arquivo agora. Tente de novo em instantes.";
  }
  return comBanco(visitante, (banco) => {
    const dados = pessoa(banco, pessoaId);
    if (fatura) salvarFatura(banco, pessoaId, fatura);
    const agora = new Date().toISOString();
    const minhas: Mensagem[] = canal === "app" ? [{ id: novoId("msg"), de: "pessoa", texto: `Arquivo: ${arquivo.nome}`, quando: agora }] : [];
    const dela: Mensagem = { id: novoId("msg"), de: "assistente", texto: resposta, quando: agora };
    if (canal === "app") dados.conversa.push(...minhas, dela);
    return [dela];
  });
}

/** Mensagem de voz: a IA transcreve e a conversa segue como se fosse texto. */
export async function receberAudioNoChat(
  visitante: string,
  pessoaId: string,
  canal: Canal,
  audio: { bytes: Uint8Array; mime: string },
): Promise<{ transcricao: string; respostas: Mensagem[] }> {
  const tipo = audio.mime.split(";")[0].trim().toLowerCase();
  const ia = iaDisponivel();
  const falha = (texto: string) => ({ transcricao: "", respostas: [{ id: novoId("msg"), de: "assistente" as const, texto, quando: new Date().toISOString() }] });
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

  const respostas = await comBanco(visitante, (banco) => {
    if (canal === "app") {
      const dados = pessoa(banco, pessoaId);
      dados.conversa.forEach((m) => delete m.respostasRapidas);
      dados.conversa.push({ id: novoId("msg"), de: "pessoa", texto: `Mensagem de voz: ${transcricao}`, quando: new Date().toISOString() });
    }
    return conversar(banco, pessoaId, canal, transcricao, { ia, lida });
  });
  return { transcricao, respostas };
}
