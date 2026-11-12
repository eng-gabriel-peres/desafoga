import { type GenerateContentConfig, GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";

export class IaIndisponivel extends Error {}
/** O serviço do modelo está sobrecarregado ou lento; vale tentar de novo depois. */
export class IaSobrecarregada extends IaIndisponivel {}

/**
 * Modelos tentados em ordem, em até duas rodadas. Quando um está
 * sobrecarregado, sem cota, fora do ar ou demora demais, a chamada segue para
 * o próximo.
 */
const MODELOS = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
];
const RODADAS = 2;
/** Tempo máximo de cada tentativa e do conjunto, em milissegundos. */
const LIMITE_POR_TENTATIVA = 70_000;
const LIMITE_TOTAL = 150_000;
/** Erros que não adianta repetir: pedido inválido ou chave recusada. */
const SEM_NOVA_TENTATIVA = [400, 401, 403];

async function gerar(partes: Part[], config: GenerateContentConfig): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new IaIndisponivel("GEMINI_API_KEY não configurada.");
  const ia = new GoogleGenAI({ apiKey, httpOptions: { timeout: LIMITE_POR_TENTATIVA } });

  const inicio = Date.now();
  let ultimoErro = "nenhuma tentativa feita";
  for (let rodada = 0; rodada < RODADAS; rodada++) {
    if (rodada > 0) await new Promise((r) => setTimeout(r, 2000));
    for (const model of MODELOS) {
      if (Date.now() - inicio > LIMITE_TOTAL) break;
      const t0 = Date.now();
      try {
        const resposta = await ia.models.generateContent({
          model,
          contents: [{ role: "user", parts: partes }],
          config,
        });
        const texto = resposta.text?.trim();
        if (texto) return texto;
        ultimoErro = `${model}: resposta vazia`;
      } catch (erro) {
        const status = (erro as { status?: number }).status;
        ultimoErro = `${model}: ${status ?? (erro instanceof Error ? erro.name : "erro")}`;
        if (status && SEM_NOVA_TENTATIVA.includes(status)) {
          const detalhe = erro instanceof Error ? erro.message.slice(0, 300) : "";
          throw new IaIndisponivel(`${ultimoErro} ${detalhe}`);
        }
      }
      console.warn(`IA: tentativa falhou (${ultimoErro}) em ${Date.now() - t0} ms`);
    }
  }
  throw new IaSobrecarregada(`Todas as tentativas falharam; última: ${ultimoErro}`);
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
    throw new IaIndisponivel("O modelo devolveu um JSON inválido (talvez cortado).");
  }
  const validado = schema.safeParse(bruto);
  if (!validado.success) throw new IaIndisponivel("O modelo devolveu dados fora do formato.");
  return validado.data;
}

/** Pede ao modelo um texto livre. */
export async function gerarTexto(instrucoes: string, conteudo: string): Promise<string> {
  return gerar([{ text: conteudo }], { systemInstruction: instrucoes });
}
