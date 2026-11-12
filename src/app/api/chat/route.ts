import { NextResponse, type NextRequest } from "next/server";
import { receberTexto } from "@/lib/luana/luana";
import { usuarioValido } from "@/lib/luana/usuario";
import { consumir, redeDe } from "@/lib/limite";

export const maxDuration = 60;
const TAMANHO_MAXIMO = 1000;

/** Chat web: mesma conversa do WhatsApp, sem depender do número de teste. */
export async function POST(request: NextRequest) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const { texto, usuario } = (corpo ?? {}) as Record<string, unknown>;
  if (!usuarioValido(usuario)) {
    return NextResponse.json({ erro: 'Envie "usuario".' }, { status: 400 });
  }
  if (typeof texto !== "string" || texto.trim() === "" || texto.length > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { erro: `Envie "texto" com até ${TAMANHO_MAXIMO} caracteres.` },
      { status: 400 },
    );
  }

  const uso = await consumir("texto", `web:${usuario}`, redeDe(request.headers));
  if (!uso.permitido) return NextResponse.json({ mensagens: [uso.mensagem] });

  return NextResponse.json({ mensagens: await receberTexto(`web:${usuario}`, texto) });
}
