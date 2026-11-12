import { NextResponse, type NextRequest } from "next/server";
import { contextoDoCliente, contextoParaCliente } from "@/lib/conversa/contexto";
import { responder } from "@/lib/conversa/responder";

const TAMANHO_MAXIMO = 1000;

/** Chat web: mesma conversa do WhatsApp, sem depender do número de teste. */
export async function POST(request: NextRequest) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const { texto, persona, analise } = (corpo ?? {}) as Record<string, unknown>;
  if (typeof texto !== "string" || texto.trim() === "" || texto.length > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { erro: `Envie "texto" com até ${TAMANHO_MAXIMO} caracteres.` },
      { status: 400 },
    );
  }

  const { mensagens, atual } = responder(texto, contextoDoCliente(persona, analise));
  return NextResponse.json({ mensagens, ...contextoParaCliente(atual) });
}
