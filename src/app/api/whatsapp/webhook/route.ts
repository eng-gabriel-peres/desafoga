import { after, type NextRequest } from "next/server";
import { responder } from "@/lib/conversa/responder";
import { lerArquivo } from "@/lib/ingestao/ler";
import type { Persona } from "@/lib/personas";
import { enviarTexto } from "@/lib/whatsapp/enviar";
import { baixarMidia } from "@/lib/whatsapp/midia";
import { assinaturaValida, extrairMensagens, type MensagemRecebida } from "@/lib/whatsapp/webhook";

/** A leitura de fatura por IA pode levar algumas dezenas de segundos. */
export const maxDuration = 60;

/**
 * Estado provisório em memória, até o banco entrar. Em servidor sem estado
 * (Vercel) ele se perde entre instâncias: a pessoa pode ter de escolher a
 * persona ou enviar a fatura de novo, e uma reentrega da Meta pode ser
 * respondida duas vezes.
 */
const contextoPorTelefone = new Map<string, Persona>();
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
  if (m.tipo === "text" && m.texto) {
    const { mensagens, atual } = responder(m.texto, contextoPorTelefone.get(m.de) ?? null);
    guardar(m.de, atual);
    for (const texto of mensagens) await enviarTexto(m.de, texto);
    return;
  }

  if ((m.tipo === "image" || m.tipo === "document") && m.midiaId) {
    await enviarTexto(m.de, "Recebi. Lendo sua fatura, leva alguns segundos…");
    const { bytes, mime } = await baixarMidia(m.midiaId);
    const leitura = await lerArquivo(bytes, mime);
    if (leitura.analise) guardar(m.de, leitura.analise);
    for (const texto of leitura.mensagens) await enviarTexto(m.de, texto);
    return;
  }

  await enviarTexto(m.de, "Só entendo texto, foto ou PDF. Envie sua fatura ou escreva *oi*.");
}

function guardar(telefone: string, atual: Persona | null): void {
  if (atual) contextoPorTelefone.set(telefone, atual);
  else contextoPorTelefone.delete(telefone);
}
