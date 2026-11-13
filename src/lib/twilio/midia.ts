import { autorizacao } from "./enviar";

/** Arquivos maiores que isto não são baixados. */
const TAMANHO_MAXIMO = 20 * 1024 * 1024;

/**
 * Baixa um arquivo recebido pelo WhatsApp da Twilio. O endereço exige as
 * credenciais da conta, que só seguem para api.twilio.com: o redirecionamento
 * para o servidor de arquivos é seguido sem elas.
 */
export async function baixarMidia(url: string, mimeInformado: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const endereco = new URL(url);
  if (endereco.protocol !== "https:" || endereco.hostname !== "api.twilio.com") {
    throw new Error("Endereço de mídia fora da Twilio.");
  }

  let resposta = await fetch(endereco, { headers: { Authorization: autorizacao() }, redirect: "manual" });
  for (let saltos = 0; saltos < 3 && resposta.status >= 300 && resposta.status < 400; saltos++) {
    const destino = resposta.headers.get("location");
    if (!destino) break;
    const proximo = new URL(destino, endereco);
    if (proximo.protocol !== "https:") throw new Error("Redirecionamento de mídia sem HTTPS.");
    resposta = await fetch(proximo, {
      headers: proximo.hostname === "api.twilio.com" ? { Authorization: autorizacao() } : {},
      redirect: "manual",
    });
  }
  if (!resposta.ok) throw new Error(`Twilio respondeu ${resposta.status} ao baixar a mídia.`);

  const bytes = new Uint8Array(await resposta.arrayBuffer());
  if (bytes.byteLength > TAMANHO_MAXIMO) throw new Error("Arquivo grande demais.");
  const mime = (resposta.headers.get("content-type") ?? mimeInformado).split(";")[0].trim().toLowerCase();
  return { bytes, mime: mime || mimeInformado };
}
