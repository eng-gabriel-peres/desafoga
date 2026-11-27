/** Um pedaço do pedido ao modelo: texto ou arquivo (PDF, imagem, áudio). Não depende de provedor. */
export type Parte = { texto: string } | { arquivo: { bytes: Uint8Array; mime: string } };

export interface OpcoesDaGeracao {
  /** Instruções de sistema. */
  sistema: string;
  /** Quando há, a resposta deve ser um JSON neste formato. */
  schemaJson?: Record<string, unknown>;
}

/** Gera a resposta em texto (ou o JSON, serializado). */
export type Gerador = (partes: Parte[], opcoes: OpcoesDaGeracao) => Promise<string>;
