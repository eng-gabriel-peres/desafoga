/**
 * Mensagem ativa pelo WhatsApp (o código do cadastro): Twilio quando
 * configurada, senão a API da Meta. Sem nenhum dos dois, não há como enviar.
 */
import { enviarTexto as enviarPelaTwilio } from "@/lib/twilio/enviar";
import { enviarTexto as enviarPelaMeta } from "@/lib/whatsapp/enviar";

export class WhatsappIndisponivel extends Error {}

export function whatsappConfigurado(): "twilio" | "meta" | null {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return "twilio";
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) return "meta";
  return null;
}

/** `telefone` só com dígitos, com 55. */
export async function enviarPeloWhatsapp(telefone: string, texto: string): Promise<void> {
  const canal = whatsappConfigurado();
  if (!canal) throw new WhatsappIndisponivel("O WhatsApp da Luana não está configurado neste ambiente.");
  if (canal === "twilio") await enviarPelaTwilio(telefone, texto);
  else await enviarPelaMeta(telefone, texto);
}
