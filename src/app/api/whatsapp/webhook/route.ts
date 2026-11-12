import { after, type NextRequest } from "next/server";
import { receberArquivo, receberTexto } from "@/lib/luana/luana";
import { enviarTexto } from "@/lib/whatsapp/enviar";
import { mascarar, registrar } from "@/lib/whatsapp/diagnostico";
import { baixarMidia } from "@/lib/whatsapp/midia";
import { assinaturaValida, extrairMensagens, type MensagemRecebida } from "@/lib/whatsapp/webhook";

/** A leitura de fatura por IA pode levar algumas dezenas de segundos. */
export const maxDuration = 180;

/**
 * Controle de reentregas da Meta, em memória. Em servidor sem estado (Vercel)
 * ele se perde entre instâncias e uma reentrega pode ser respondida duas vezes.
 */
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
      registrar("assinatura recusada", cabecalho ? "cabeçalho presente" : "sem cabeçalho");
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
  registrar("webhook aceito", `${novas.length} mensagem(ns) nova(s)`);
  if (jaProcessadas.size > 5000) jaProcessadas.clear();

  after(async () => {
    for (const m of novas) {
      try {
        await atender(m);
        registrar("respondida", `${m.tipo} de ${mascarar(m.de)}`);
      } catch (erro) {
        console.error("Falha ao responder mensagem do WhatsApp:", erro);
        registrar("falha ao responder", `${mascarar(m.de)}: ${erro instanceof Error ? erro.message : String(erro)}`);
      }
    }
  });

  return new Response("ok", { status: 200 });
}

async function atender(m: MensagemRecebida): Promise<void> {
  const usuario = `wa:${m.de}`;
  let mensagens: string[];

  if (m.tipo === "text" && m.texto) {
    mensagens = await receberTexto(usuario, m.texto);
  } else if ((m.tipo === "image" || m.tipo === "document") && m.midiaId) {
    await enviarTexto(m.de, "Recebi. Lendo, leva alguns segundos…");
    const { bytes, mime } = await baixarMidia(m.midiaId);
    mensagens = await receberArquivo(usuario, bytes, mime);
  } else {
    mensagens = ["Só entendo texto, foto ou PDF. Me mande a fatura, um print das compras ou escreva o que gastou."];
  }

  for (const texto of mensagens) await enviarTexto(m.de, texto);
}
