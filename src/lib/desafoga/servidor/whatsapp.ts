/**
 * Mensagens que chegam ao WhatsApp da Luana. Número conectado a uma conta:
 * a mesma Luana do app responde, com os dados da pessoa, na conversa do
 * WhatsApp. Número sem conta: a Luana explica e manda o link para se cadastrar.
 */
import { paraWhatsapp } from "../conversar";
import { receberArquivoNoChat, receberAudioNoChat, responderTexto } from "./acoes";
import { normalizarTelefone } from "../telefone";
import { donoDoTelefone, registrarContato } from "./vinculo-whatsapp";
import { linkDeConexao } from "./link-de-conexao";

export interface MensagemRecebida {
  de: string;
  tipo: "text" | "audio" | "image" | "document" | string;
  texto?: string | null;
  baixar?: () => Promise<{ bytes: Uint8Array; mime: string }>;
}

/** Resposta para quem ainda não conectou o WhatsApp a uma conta do Desafoga. */
export function mensagemSemConta(origem: string, numero: string): string {
  const telefone = normalizarTelefone(numero);
  const link = telefone ? linkDeConexao(origem, telefone) : null;
  return [
    "Oi! Eu sou a Luana, assistente do Desafoga.",
    "Este número ainda não está conectado a nenhuma conta, então não consigo anotar nada por aqui.",
    `Para começar, crie sua conta em ${origem} e, no app, toque em Conectar WhatsApp com este número. Eu mando um código para cá e você digita por lá.`,
    link ? `Se você já tem conta e está com ela aberta neste celular, é só tocar aqui para conectar direto (vale 30 minutos):\n${link}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Textos a enviar de volta para quem mandou a mensagem. */
export async function atenderNoWhatsapp(m: MensagemRecebida, origem: string, avisarLeitura: () => Promise<void>): Promise<string[]> {
  // Quem escreve abre a conversa: a partir daí podemos mandar o código de conexão para este número.
  await registrarContato(m.de);
  const pessoaId = await donoDoTelefone(m.de);
  if (!pessoaId) return [mensagemSemConta(origem, m.de)];

  if (m.tipo === "text" && m.texto) {
    return (await responderTexto(pessoaId, "whatsapp", m.texto)).map(paraWhatsapp);
  }
  if (m.tipo === "audio" && m.baixar) {
    const { bytes, mime } = await m.baixar();
    return (await receberAudioNoChat(pessoaId, "whatsapp", { bytes, mime })).respostas.map(paraWhatsapp);
  }
  if ((m.tipo === "image" || m.tipo === "document") && m.baixar) {
    await avisarLeitura();
    const { bytes, mime } = await m.baixar();
    return (await receberArquivoNoChat(pessoaId, "whatsapp", { bytes, mime, nome: "arquivo" })).map(paraWhatsapp);
  }
  return ["Entendo texto, áudio, foto ou PDF. Me conte o que comprou, mande a fatura ou um áudio."];
}
