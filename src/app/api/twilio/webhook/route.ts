import { after, type NextRequest } from "next/server";
import { consumir, type Recurso } from "@/lib/limite";
import { origemDoSite } from "@/lib/link";
import { atenderNoWhatsapp } from "@/lib/desafoga/servidor/whatsapp";
import { enviarTexto } from "@/lib/twilio/enviar";
import { baixarMidia } from "@/lib/twilio/midia";
import { assinaturaValida, extrairMensagem, lerFormulario, type MensagemTwilio } from "@/lib/twilio/webhook";
import { mascarar, registrar } from "@/lib/whatsapp/diagnostico";

/** A leitura de fatura por IA pode levar algumas dezenas de segundos. */
export const maxDuration = 180;

/** Controle de reentregas, em memória (mesma limitação do webhook da Meta). */
const jaProcessadas = new Set<string>();

/** Resposta vazia: a Luana responde depois, pela API, e não nesta chamada. */
const SEM_RESPOSTA = () =>
  new Response("<Response></Response>", { status: 200, headers: { "Content-Type": "text/xml" } });

/**
 * O endereço que a Twilio assinou é o cadastrado no painel dela. Atrás do
 * proxy da hospedagem ele é reconstruído pelos cabeçalhos encaminhados;
 * TWILIO_WEBHOOK_URL fixa o valor quando isso não bastar.
 */
function enderecoAssinado(request: NextRequest): string {
  if (process.env.TWILIO_WEBHOOK_URL) return process.env.TWILIO_WEBHOOK_URL;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const protocolo = request.headers.get("x-forwarded-proto")?.split(",")[0] ?? request.nextUrl.protocol.replace(":", "");
  return `${protocolo}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`;
}

/** Mensagens recebidas pelo WhatsApp da Twilio. Responde rápido e processa depois. */
export async function POST(request: NextRequest) {
  const parametros = lerFormulario(await request.text());

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const cabecalho = request.headers.get("x-twilio-signature");
    if (!assinaturaValida(enderecoAssinado(request), parametros, cabecalho, authToken)) {
      registrar("twilio: assinatura recusada", cabecalho ? "cabeçalho presente" : "sem cabeçalho");
      return new Response("Assinatura inválida.", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Sem o Auth Token não há como saber se a chamada veio da Twilio.
    return new Response("TWILIO_AUTH_TOKEN não configurado.", { status: 500 });
  }

  const m = extrairMensagem(parametros);
  if (!m || jaProcessadas.has(m.id)) return SEM_RESPOSTA();
  jaProcessadas.add(m.id);
  if (jaProcessadas.size > 5000) jaProcessadas.clear();
  registrar("twilio: webhook aceito", `${m.tipo} de ${mascarar(m.de)}`);

  const origem = origemDoSite(request.headers);
  after(async () => {
    try {
      await atender(m, origem);
      registrar("twilio: respondida", `${m.tipo} de ${mascarar(m.de)}`);
    } catch (erro) {
      console.error("Falha ao responder mensagem do WhatsApp (Twilio):", erro);
      registrar("twilio: falha ao responder", `${mascarar(m.de)}: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  });

  return SEM_RESPOSTA();
}

async function atender(m: MensagemTwilio, origem: string): Promise<void> {
  // O limite de uso conta por número.
  const usuario = `wa:${m.de}`;

  const recurso: Recurso = m.tipo === "audio" ? "audio" : m.tipo === "image" || m.tipo === "document" ? "arquivo" : "texto";
  const uso = await consumir(recurso, usuario, null);
  if (!uso.permitido) {
    await enviarTexto(m.de, uso.mensagem ?? "Cheguei ao limite de hoje. Volto amanhã.");
    return;
  }

  // A Luana do Desafoga: com conta, responde com os dados da pessoa; sem conta, manda o link de cadastro.
  const midia = m.midiaUrl;
  const mensagens = await atenderNoWhatsapp(
    {
      de: m.de,
      tipo: m.tipo,
      texto: m.texto,
      baixar: midia ? () => baixarMidia(midia, m.midiaMime ?? "application/octet-stream") : undefined,
    },
    origem,
    () => enviarTexto(m.de, "Recebi. Lendo, leva alguns segundos…"),
  );
  for (const texto of mensagens) await enviarTexto(m.de, texto);
}
