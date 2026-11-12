import { NextResponse, type NextRequest } from "next/server";
import { receberAudio, TAMANHO_MAXIMO } from "@/lib/luana/luana";
import { usuarioValido } from "@/lib/luana/usuario";
import { consumir, redeDe } from "@/lib/limite";

/** A leitura por IA pode levar algumas dezenas de segundos. */
export const maxDuration = 180;

/** Recebe uma mensagem de voz gravada no chat web. O áudio não é guardado. */
export async function POST(request: NextRequest) {
  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ erro: "Envie o áudio em multipart/form-data." }, { status: 400 });
  }
  const audio = formulario.get("audio");
  const usuario = formulario.get("usuario");
  if (!usuarioValido(usuario)) {
    return NextResponse.json({ erro: 'Envie "usuario".' }, { status: 400 });
  }
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ erro: 'Envie o campo "audio".' }, { status: 400 });
  }
  if (audio.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ erro: "Áudio maior que 4 MB." }, { status: 413 });
  }

  const uso = await consumir("audio", `web:${usuario}`, redeDe(request.headers));
  if (!uso.permitido) return NextResponse.json({ transcricao: "", mensagens: [uso.mensagem] });

  const bytes = new Uint8Array(await audio.arrayBuffer());
  return NextResponse.json(await receberAudio(`web:${usuario}`, bytes, audio.type));
}
