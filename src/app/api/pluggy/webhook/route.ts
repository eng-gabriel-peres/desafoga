import { after, NextResponse, type NextRequest } from "next/server";
import { conferirWebhook, processarWebhook } from "@/lib/banco/webhook";

/** A sincronização roda depois da resposta; pode levar alguns segundos. */
export const maxDuration = 60;

/**
 * Webhook da Pluggy. Responde na hora (a Pluggy espera no máximo 10 s) e
 * busca os dados depois. 401 sem o segredo da URL ou com outro clientId:
 * a Pluggy não tenta de novo nesse caso.
 */
export async function POST(request: NextRequest) {
  const corpo = await request.json().catch(() => null);
  const evento = conferirWebhook(request.nextUrl.searchParams.get("s"), corpo);
  if (!evento) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  after(() =>
    processarWebhook(evento).catch((e: unknown) => console.error("Desafoga: webhook da Pluggy falhou,", e instanceof Error ? e.message.slice(0, 200) : "erro")),
  );
  return NextResponse.json({ ok: true });
}
