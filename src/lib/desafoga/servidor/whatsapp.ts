/**
 * Mensagens que chegam ao WhatsApp da Luana. Número conectado a uma conta:
 * a mesma Luana do app responde, com os dados da pessoa, na conversa do
 * WhatsApp. Número sem conta: a Luana explica e manda o link para se cadastrar.
 */
import { paraWhatsapp } from "../conversar";
import { receberArquivoNoChat, receberAudioNoChat, responderTexto } from "./acoes";
import { donoDoTelefone } from "./armazem";

export interface MensagemRecebida {
  de: string;
  tipo: "text" | "audio" | "image" | "document" | string;
  texto?: string | null;
  baixar?: () => Promise<{ bytes: Uint8Array; mime: string }>;
}

/** Resposta para quem ainda não conectou o WhatsApp a uma conta do Desafoga. */
export function mensagemSemConta(origem: string): string {
  return [
    "Oi! Eu sou a Luana, assistente do Desafoga.",
    "Este número ainda não está conectado a nenhuma conta, então não consigo anotar nada por aqui.",
    `Para começar, crie sua conta em ${origem} e, no app, toque em Conectar WhatsApp. Eu mando um código para este número e você confirma por lá.`,
  ].join("\n\n");
}

/** Textos a enviar de volta para quem mandou a mensagem. */
export async function atenderNoWhatsapp(m: MensagemRecebida, origem: string, avisarLeitura: () => Promise<void>): Promise<string[]> {
  const dono = await donoDoTelefone(m.de);
  if (!dono) return [mensagemSemConta(origem)];
  const { visitante, pessoaId } = dono;

  if (m.tipo === "text" && m.texto) {
    return (await responderTexto(visitante, pessoaId, "whatsapp", m.texto)).map(paraWhatsapp);
  }
  if (m.tipo === "audio" && m.baixar) {
    const { bytes, mime } = await m.baixar();
    return (await receberAudioNoChat(visitante, pessoaId, "whatsapp", { bytes, mime })).respostas.map(paraWhatsapp);
  }
  if ((m.tipo === "image" || m.tipo === "document") && m.baixar) {
    await avisarLeitura();
    const { bytes, mime } = await m.baixar();
    return (await receberArquivoNoChat(visitante, pessoaId, "whatsapp", { bytes, mime, nome: "arquivo" })).map(paraWhatsapp);
  }
  return ["Entendo texto, áudio, foto ou PDF. Me conte o que comprou, mande a fatura ou um áudio."];
}
