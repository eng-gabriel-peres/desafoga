/**
 * A Meta entrega celulares brasileiros sem o nono dígito (55 + DDD + 8
 * dígitos), mas pode recusar o envio para esse formato. Devolve o número com
 * o 9, ou null quando não é esse caso.
 */
export function comNonoDigito(numero: string): string | null {
  const m = /^55(\d{2})(\d{8})$/.exec(numero);
  return m ? `55${m[1]}9${m[2]}` : null;
}

/** Código da Meta para "destinatário fora da lista de permissão". */
const FORA_DA_LISTA = 131030;

async function postar(para: string, texto: string): Promise<Response> {
  const token = process.env.WHATSAPP_TOKEN;
  const numero = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !numero) {
    throw new Error("WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados.");
  }
  const versao = process.env.WHATSAPP_API_VERSION ?? "v23.0";

  return fetch(`https://graph.facebook.com/${versao}/${numero}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "text",
      text: { body: texto },
    }),
  });
}

/** Envia uma mensagem de texto pela API Cloud do WhatsApp. */
export async function enviarTexto(para: string, texto: string): Promise<void> {
  let resposta = await postar(para, texto);

  if (!resposta.ok) {
    let corpo = await resposta.text();
    const alternativo = comNonoDigito(para);
    if (alternativo && corpo.includes(String(FORA_DA_LISTA))) {
      resposta = await postar(alternativo, texto);
      if (resposta.ok) return;
      corpo = await resposta.text();
    }
    // O corpo de erro da Meta não traz o token; o telefone fica fora do log.
    throw new Error(`WhatsApp respondeu ${resposta.status}: ${corpo}`);
  }
}
