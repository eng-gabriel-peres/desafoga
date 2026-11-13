import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * WhatsApp pelo sandbox da Twilio: caminho sem número próprio. A Twilio chama
 * o webhook com um formulário (não JSON) e assina a chamada com o Auth Token.
 */

export interface MensagemTwilio {
  id: string;
  /** Telefone de quem enviou, só dígitos, com DDI. */
  de: string;
  tipo: "text" | "audio" | "image" | "document" | "outro";
  texto?: string;
  midiaUrl?: string;
  midiaMime?: string;
}

/**
 * Confere o cabeçalho X-Twilio-Signature: HMAC-SHA1, em base64, do endereço
 * completo do webhook seguido de cada parâmetro (nome e valor colados), com os
 * nomes em ordem alfabética, usando o Auth Token como chave.
 */
export function assinaturaValida(
  url: string,
  parametros: Record<string, string>,
  cabecalho: string | null,
  authToken: string,
): boolean {
  if (!cabecalho) return false;
  const dados = Object.keys(parametros)
    .sort()
    .reduce((s, nome) => s + nome + parametros[nome], url);
  const esperado = createHmac("sha1", authToken).update(dados, "utf8").digest();
  const recebido = Buffer.from(cabecalho, "base64");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/** Lê o corpo application/x-www-form-urlencoded da chamada. */
export function lerFormulario(corpoBruto: string): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [nome, valor] of new URLSearchParams(corpoBruto)) saida[nome] = valor;
  return saida;
}

function tipoDaMidia(mime: string): MensagemTwilio["tipo"] {
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "document";
  return "outro";
}

/** Extrai a mensagem recebida; null quando a chamada não é uma mensagem de WhatsApp. */
export function extrairMensagem(p: Record<string, string>): MensagemTwilio | null {
  const id = p.MessageSid;
  const origem = p.From ?? "";
  if (!id || !origem.startsWith("whatsapp:")) return null;
  const de = origem.replace(/\D/g, "");
  if (!de) return null;

  if (Number(p.NumMedia ?? "0") > 0 && p.MediaUrl0) {
    const mime = (p.MediaContentType0 ?? "").split(";")[0].trim().toLowerCase();
    return { id, de, tipo: tipoDaMidia(mime), midiaUrl: p.MediaUrl0, midiaMime: mime };
  }
  const texto = (p.Body ?? "").trim();
  return texto ? { id, de, tipo: "text", texto } : { id, de, tipo: "outro" };
}
