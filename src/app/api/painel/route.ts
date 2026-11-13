import { NextResponse, type NextRequest } from "next/server";
import { hojeEmBrasilia } from "@/lib/luana/lancamentos";
import { montarPainel } from "@/lib/luana/painel";
import { buscarConta } from "@/lib/luana/repositorio";
import { usuarioValido } from "@/lib/luana/usuario";
import { usoDeHoje } from "@/lib/limite";

/** Resumo geral do visitante para o painel. O identificador vai no corpo, não na URL. */
export async function POST(request: NextRequest) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const { usuario } = (corpo ?? {}) as Record<string, unknown>;
  if (!usuarioValido(usuario)) {
    return NextResponse.json({ erro: 'Envie "usuario".' }, { status: 400 });
  }
  const [conta, uso] = await Promise.all([buscarConta(`web:${usuario}`), usoDeHoje(`web:${usuario}`)]);
  return NextResponse.json({ ...montarPainel(conta, hojeEmBrasilia()), uso });
}
