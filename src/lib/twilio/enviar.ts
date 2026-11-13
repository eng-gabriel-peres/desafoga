/** A Twilio aceita até 1.600 caracteres por mensagem; fica uma folga. */
export const LIMITE_POR_MENSAGEM = 1500;

/** O sandbox envia no máximo uma mensagem a cada três segundos. */
const INTERVALO_ENTRE_ENVIOS = 3200;

/** Número compartilhado do sandbox de WhatsApp da Twilio. */
const NUMERO_DO_SANDBOX = "whatsapp:+14155238886";

/**
 * Parte um texto longo em pedaços que cabem numa mensagem, quebrando de
 * preferência entre parágrafos, depois entre linhas, depois entre palavras.
 */
export function partir(texto: string, limite = LIMITE_POR_MENSAGEM): string[] {
  const pedacos: string[] = [];
  let resto = texto.trim();
  while (resto.length > limite) {
    const janela = resto.slice(0, limite + 1);
    let corte = janela.lastIndexOf("\n\n");
    if (corte < limite / 2) corte = janela.lastIndexOf("\n");
    if (corte < limite / 2) corte = janela.lastIndexOf(" ");
    if (corte < limite / 2) corte = limite;
    pedacos.push(resto.slice(0, corte).trimEnd());
    resto = resto.slice(corte).trimStart();
  }
  if (resto) pedacos.push(resto);
  return pedacos;
}

export function credenciais(): { sid: string; token: string } {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID ou TWILIO_AUTH_TOKEN não configurados.");
  return { sid, token };
}

export function autorizacao(): string {
  const { sid, token } = credenciais();
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

let ultimoEnvio = 0;

async function respeitarIntervalo(): Promise<void> {
  const espera = ultimoEnvio + INTERVALO_ENTRE_ENVIOS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimoEnvio = Date.now();
}

/** Envia um texto pelo WhatsApp da Twilio. `para` é o telefone só com dígitos. */
export async function enviarTexto(para: string, texto: string): Promise<void> {
  const { sid } = credenciais();
  const remetente = process.env.TWILIO_WHATSAPP_FROM || NUMERO_DO_SANDBOX;

  for (const pedaco of partir(texto)) {
    await respeitarIntervalo();
    const resposta = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: autorizacao(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ From: remetente, To: `whatsapp:+${para}`, Body: pedaco }),
    });
    if (!resposta.ok) {
      // O corpo de erro da Twilio traz código e explicação, sem o Auth Token.
      throw new Error(`Twilio respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
    }
  }
}
