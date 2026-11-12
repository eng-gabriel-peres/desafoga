import { apresentar } from "@/lib/conversa/responder";
import type { Persona } from "@/lib/personas";
import { montarAnalise } from "./analise";
import { extrairFatura, LeituraIndisponivel, tipoAceito } from "./extrair";

/** Limite de tamanho; a Vercel recusa corpos de requisição maiores que 4,5 MB. */
export const TAMANHO_MAXIMO = 4 * 1024 * 1024;

export interface Leitura {
  mensagens: string[];
  /** Presente quando a leitura deu certo; vira o contexto da conversa. */
  analise: Persona | null;
}

/** Fluxo completo de um arquivo recebido, igual no WhatsApp e no chat web. */
export async function lerArquivo(arquivo: Uint8Array, mime: string): Promise<Leitura> {
  if (!tipoAceito(mime)) {
    return falha("Só leio PDF ou foto (JPG, PNG, WebP). Envie a fatura em um desses formatos.");
  }
  if (arquivo.byteLength > TAMANHO_MAXIMO) {
    return falha("Esse arquivo passa de 4 MB. Envie uma versão menor ou uma foto da primeira página.");
  }

  let extraida;
  try {
    extraida = await extrairFatura(arquivo, mime);
  } catch (erro) {
    console.error("Falha na leitura de fatura:", erro instanceof Error ? erro.message : erro);
    return falha(
      erro instanceof LeituraIndisponivel
        ? "A leitura de fatura não está disponível agora. Enquanto isso, responda *Ana*, *Carlos* ou *Marina* para ver uma simulação."
        : "Não consegui ler o arquivo agora. Tente de novo em instantes.",
    );
  }

  const resultado = montarAnalise(extraida);
  if (!resultado.ok) return falha(`${resultado.motivo} Envie a fatura em PDF ou uma foto nítida.`);

  return {
    mensagens: [apresentar(resultado.analise, resultado.avisos)],
    analise: resultado.analise,
  };
}

function falha(texto: string): Leitura {
  return { mensagens: [texto], analise: null };
}
