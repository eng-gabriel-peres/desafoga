import { NextResponse, type NextRequest } from "next/server";
import { contextoParaCliente } from "@/lib/conversa/contexto";
import { lerArquivo, TAMANHO_MAXIMO } from "@/lib/ingestao/ler";

/** A leitura por IA pode levar algumas dezenas de segundos. */
export const maxDuration = 60;

/** Recebe a fatura enviada pelo chat web. O arquivo não é guardado. */
export async function POST(request: NextRequest) {
  let arquivo: FormDataEntryValue | null;
  try {
    arquivo = (await request.formData()).get("arquivo");
  } catch {
    return NextResponse.json({ erro: "Envie o arquivo em multipart/form-data." }, { status: 400 });
  }
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: 'Envie o campo "arquivo".' }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ erro: "Arquivo maior que 4 MB." }, { status: 413 });
  }

  const leitura = await lerArquivo(new Uint8Array(await arquivo.arrayBuffer()), arquivo.type);
  return NextResponse.json({
    mensagens: leitura.mensagens,
    ...contextoParaCliente(leitura.analise),
  });
}
