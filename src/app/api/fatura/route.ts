import { NextResponse, type NextRequest } from "next/server";
import { receberArquivo, TAMANHO_MAXIMO } from "@/lib/luana/luana";
import { usuarioValido } from "@/lib/luana/usuario";

/** A leitura por IA pode levar algumas dezenas de segundos. */
export const maxDuration = 180;

/** Recebe fatura ou print enviado pelo chat web. O arquivo não é guardado. */
export async function POST(request: NextRequest) {
  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ erro: "Envie o arquivo em multipart/form-data." }, { status: 400 });
  }
  const arquivo = formulario.get("arquivo");
  const usuario = formulario.get("usuario");
  if (!usuarioValido(usuario)) {
    return NextResponse.json({ erro: 'Envie "usuario".' }, { status: 400 });
  }
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: 'Envie o campo "arquivo".' }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ erro: "Arquivo maior que 4 MB." }, { status: 413 });
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  return NextResponse.json({ mensagens: await receberArquivo(`web:${usuario}`, bytes, arquivo.type) });
}
