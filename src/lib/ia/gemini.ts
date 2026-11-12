import { type GenerateContentConfig, GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";

export class IaIndisponivel extends Error {}

/**
 * Modelos tentados em ordem. Quando um está sobrecarregado, sem cota, fora do
 * ar ou demora demais, a chamada segue para o próximo.
 */
const MODELOS = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
];

/** Tempo máximo de cada tentativa, em milissegundos. */
const TEMPO_LIMITE = 45_000;
/** Erros que não adianta tentar em outro modelo: pedido inválido ou chave recusada. */
const SEM_NOVA_TENTATIVA = [400, 401, 403];

async function gerar(partes: Part[], config: GenerateContentConfig): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new IaIndisponivel("GEMINI_API_KEY não configurada.");
  const ia = new GoogleGenAI({ apiKey, httpOptions: { timeout: TEMPO_LIMITE } });

  let ultimoErro: unknown;
  for (const model of MODELOS) {
    try {
      const resposta = await ia.models.generateContent({
        model,
        contents: [{ role: "user", parts: partes }],
        config,
      });
      const texto = resposta.text?.trim();
      if (texto) return texto;
      ultimoErro = new Error(`${model} não devolveu conteúdo.`);
    } catch (erro) {
      ultimoErro = erro;
      const status = (erro as { status?: number }).status;
      if (status && SEM_NOVA_TENTATIVA.includes(status)) break;
    }
  }
  const motivo = ultimoErro instanceof Error ? ultimoErro.message : "erro desconhecido";
  throw new IaIndisponivel(motivo);
}

export function parteDeArquivo(bytes: Uint8Array, mime: string): Part {
  return { inlineData: { mimeType: mime, data: Buffer.from(bytes).toString("base64") } };
}

/** Pede ao modelo uma resposta no formato do schema e valida o que voltou. */
export async function gerarJson<T extends z.ZodType>(
  schema: T,
  instrucoes: string,
  partes: Part[],
): Promise<z.infer<T>> {
  const texto = await gerar(partes, {
    systemInstruction: instrucoes,
    responseMimeType: "application/json",
    responseJsonSchema: z.toJSONSchema(schema),
  });

  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new IaIndisponivel("O modelo devolveu um JSON inválido.");
  }
  const validado = schema.safeParse(bruto);
  if (!validado.success) throw new IaIndisponivel("O modelo devolveu dados fora do formato.");
  return validado.data;
}

/** Pede ao modelo um texto livre. */
export async function gerarTexto(instrucoes: string, conteudo: string): Promise<string> {
  return gerar([{ text: conteudo }], { systemInstruction: instrucoes });
}
