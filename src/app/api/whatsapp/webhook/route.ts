import { after, type NextRequest } from "next/server";
import { responder } from "@/lib/conversa/responder";
import { AINDA_NAO_LEIO_ARQUIVOS } from "@/lib/conversa/textos";
import { enviarTexto } from "@/lib/whatsapp/enviar";
import { assinaturaValida, extrairMensagens, type MensagemRecebida } from "@/lib/whatsapp/webhook";

/**
 * Estado provisório em memória, até o banco entrar. Em servidor sem estado
 * (Vercel) ele se perde entre instâncias: a pessoa pode ter de escolher a
 * persona de novo e uma reentrega da Meta pode ser respondida duas vezes.
 */
const personaPorTelefone = new Map<string, string>();
const jaProcessadas = new Set<string>();

/** Verificação do webhook, feita pela Meta ao cadastrar a URL. */
export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
  if (esperado && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === esperado) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Token de verificação inválido.", { status: 403 });
}

/** Mensagens recebidas. Responde 200 rápido e processa depois da resposta. */
export async function POST(request: NextRequest) {
  const corpoBruto = await request.text();

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const cabecalho = request.headers.get("x-hub-signature-256");
    if (!assinaturaValida(corpoBruto, cabecalho, appSecret)) {
      return new Response("Assinatura inválida.", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Sem o segredo não há como saber se a chamada veio da Meta.
    return new Response("WHATSAPP_APP_SECRET não configurado.", { status: 500 });
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(corpoBruto);
  } catch {
    return new Response("JSON inválido.", { status: 400 });
  }

  const novas = extrairMensagens(corpo).filter((m) => !jaProcessadas.has(m.id));
  for (const m of novas) jaProcessadas.add(m.id);
  if (jaProcessadas.size > 5000) jaProcessadas.clear();

  after(async () => {
    for (const m of novas) {
      try {
        await atender(m);
      } catch (erro) {
        console.error("Falha ao responder mensagem do WhatsApp:", erro);
      }
    }
  });

  return new Response("ok", { status: 200 });
}

async function atender(m: MensagemRecebida): Promise<void> {
  if (m.tipo !== "text" || !m.texto) {
    await enviarTexto(m.de, AINDA_NAO_LEIO_ARQUIVOS);
    return;
  }
  const { mensagens, persona } = responder(m.texto, personaPorTelefone.get(m.de) ?? null);
  if (persona) personaPorTelefone.set(m.de, persona);
  else personaPorTelefone.delete(m.de);
  for (const texto of mensagens) await enviarTexto(m.de, texto);
}
