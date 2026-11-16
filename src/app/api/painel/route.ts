import { NextResponse, type NextRequest } from "next/server";
import { lerCodigo } from "@/lib/link";
import { hojeEmBrasilia } from "@/lib/luana/lancamentos";
import { montarPainel } from "@/lib/luana/painel";
import { buscarConta } from "@/lib/luana/repositorio";
import { usuarioValido } from "@/lib/luana/usuario";
import { usoDeHoje } from "@/lib/limite";

/**
 * Resumo geral para o painel. No site, o visitante manda o identificador do
 * navegador; pelo link do WhatsApp, manda o código assinado. Os dois vão no
 * corpo, não na URL.
 */
export async function POST(request: NextRequest) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const { usuario, codigo } = (corpo ?? {}) as Record<string, unknown>;

  let chave: string;
  if (codigo !== undefined) {
    const conta = lerCodigo(codigo);
    if (!conta) return NextResponse.json({ erro: "Link inválido ou vencido." }, { status: 401 });
    chave = conta;
  } else if (usuarioValido(usuario)) {
    chave = `web:${usuario}`;
  } else {
    return NextResponse.json({ erro: 'Envie "usuario".' }, { status: 400 });
  }

  const [conta, uso] = await Promise.all([buscarConta(chave), usoDeHoje(chave)]);
  return NextResponse.json({ ...montarPainel(conta, hojeEmBrasilia()), uso });
}
