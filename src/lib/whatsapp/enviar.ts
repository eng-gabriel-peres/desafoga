/** Envia uma mensagem de texto pela API Cloud do WhatsApp. */
export async function enviarTexto(para: string, texto: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const numero = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !numero) {
    throw new Error("WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados.");
  }
  const versao = process.env.WHATSAPP_API_VERSION ?? "v23.0";

  const resposta = await fetch(`https://graph.facebook.com/${versao}/${numero}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "text",
      text: { body: texto },
    }),
  });

  if (!resposta.ok) {
    // O corpo de erro da Meta não traz o token; o telefone fica fora do log.
    throw new Error(`WhatsApp respondeu ${resposta.status}: ${await resposta.text()}`);
  }
}
