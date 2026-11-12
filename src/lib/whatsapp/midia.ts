/** Baixa um arquivo recebido pelo WhatsApp (foto ou documento). */
export async function baixarMidia(id: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error("WHATSAPP_TOKEN não configurado.");
  const versao = process.env.WHATSAPP_API_VERSION ?? "v23.0";
  const cabecalhos = { Authorization: `Bearer ${token}` };

  // A Meta devolve primeiro um endereço temporário e o tipo do arquivo.
  const meta = await fetch(`https://graph.facebook.com/${versao}/${encodeURIComponent(id)}`, {
    headers: cabecalhos,
  });
  if (!meta.ok) throw new Error(`WhatsApp respondeu ${meta.status} ao localizar a mídia.`);
  const { url, mime_type: mime } = (await meta.json()) as { url?: string; mime_type?: string };
  if (!url || !mime) throw new Error("Resposta de mídia sem endereço ou tipo.");

  // O token só segue para servidores da Meta.
  const host = new URL(url).hostname;
  if (!host.endsWith(".facebook.com") && !host.endsWith(".fbsbx.com")) {
    throw new Error("Endereço de mídia fora dos domínios da Meta.");
  }

  const arquivo = await fetch(url, { headers: cabecalhos });
  if (!arquivo.ok) throw new Error(`WhatsApp respondeu ${arquivo.status} ao baixar a mídia.`);
  return { bytes: new Uint8Array(await arquivo.arrayBuffer()), mime: mime.split(";")[0].trim() };
}
