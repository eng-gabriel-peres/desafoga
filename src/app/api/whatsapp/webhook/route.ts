import { after, type NextRequest } from "next/server";
import { enviarTexto } from "@/lib/whatsapp/enviar";
import { consumir, type Recurso } from "@/lib/limite";
import { origemDoSite } from "@/lib/link";
import { mascarar, registrar } from "@/lib/whatsapp/diagnostico";
import { baixarMidia } from "@/lib/whatsapp/midia";
import { assinaturaValida, extrairMensagens, type MensagemRecebida } from "@/lib/whatsapp/webhook";
import { atenderNoWhatsapp } from "@/lib/desafoga/servidor/whatsapp";

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

  const origem = origemDoSite(request.headers);
  after(async () => {
    for (const m of novas) {
      try {
        await atender(m, origem);
        registrar("respondida", `${m.tipo} de ${mascarar(m.de)}`);
      } catch (erro) {
        console.error("Falha ao responder mensagem do WhatsApp:", erro);
        registrar("falha ao responder", `${mascarar(m.de)}: ${erro instanceof Error ? erro.message : String(erro)}`);
      }
    }
  });

  return new Response("ok", { status: 200 });
}

async function atender(m: MensagemRecebida, origem: string): Promise<void> {
  const usuario = `wa:${m.de}`;

  // No WhatsApp o número já identifica a pessoa; não há endereço de rede a contar.
  const recurso: Recurso = m.tipo === "text" ? "texto" : m.tipo === "audio" ? "audio" : "arquivo";
  const uso = await consumir(recurso, usuario, null);
  if (!uso.permitido) {
    await enviarTexto(m.de, uso.mensagem ?? "Cheguei ao limite de hoje. Volto amanhã.");
    return;
  }

  // A Luana do Desafoga: com conta, responde com os dados da pessoa; sem conta, manda o link de cadastro.
  const midia = m.midiaId;
  const mensagens = await atenderNoWhatsapp(
    { de: m.de, tipo: m.tipo, texto: m.texto, baixar: midia ? () => baixarMidia(midia) : undefined },
    origem,
    () => enviarTexto(m.de, "Recebi. Lendo, leva alguns segundos…"),
  );
  for (const texto of mensagens) await enviarTexto(m.de, texto);
}
