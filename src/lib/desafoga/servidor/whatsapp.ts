/**
 * Mensagens do WhatsApp de quem cadastrou o número no Desafoga. Usa a mesma
 * Luana do app (mesmas regras, memória e números), na conversa do WhatsApp.
 */
import { paraWhatsapp } from "../conversar";
import { receberArquivoNoChat, receberAudioNoChat, responderTexto } from "./acoes";
import { codigoDaMensagem, confirmarTelefone, donoDoTelefone } from "./armazem";

export interface MensagemRecebida {
  de: string;
  tipo: "text" | "audio" | "image" | "document" | string;
  texto?: string | null;
  baixar?: () => Promise<{ bytes: Uint8Array; mime: string }>;
}

/**
 * Responde a mensagem se o número está cadastrado no Desafoga. Devolve os
 * textos a enviar, ou null quando o número não é de ninguém (segue a Luana antiga).
 */
export async function atenderNoDesafoga(m: MensagemRecebida, avisarLeitura: () => Promise<void>): Promise<string[] | null> {
  // Código do cadastro ("DESAFOGA 123456") vindo do próprio número: confirma a ligação.
  const codigo = m.tipo === "text" && m.texto ? codigoDaMensagem(m.texto) : null;
  if (codigo) {
    const confirmado = await confirmarTelefone(m.de, codigo);
    return [
      confirmado
        ? "Pronto, seu WhatsApp está ligado ao Desafoga. Pode me contar suas compras, mandar a fatura ou um áudio por aqui."
        : "Esse código não confere ou já venceu. Gere um novo em Conectar WhatsApp, no app.",
    ];
  }

  const dono = await donoDoTelefone(m.de);
  if (!dono) return null;
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
