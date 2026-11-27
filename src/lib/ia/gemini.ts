import { GoogleGenAI, type Part } from "@google/genai";
import { registrarIA } from "@/lib/limite";
import { IaIndisponivel, IaSobrecarregada } from "./erros";
import type { OpcoesDaGeracao, Parte } from "./tipos";

/** Provedor padrão: a API do Gemini, com a chave do AI Studio. */
export const geminiConfigurado = (): boolean => Boolean(process.env.GEMINI_API_KEY);

/**
 * Modelos tentados em ordem, em até duas rodadas. Quando um está
 * sobrecarregado, sem cota, fora do ar ou demora demais, a chamada segue para
 * o próximo.
 */
// Sem repetir: com GEMINI_MODEL igual a um da lista, o mesmo modelo era tentado duas vezes
// seguidas (70 s cada) e os reservas nunca entravam a tempo.
const MODELOS = [
  ...new Set([
    ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
    // Primeiro o que responde com as chaves novas do AI Studio; os outros ficam de reserva.
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
  ]),
];
const RODADAS = 2;
/** Tempo máximo de cada tentativa e do conjunto, em milissegundos. */
const LIMITE_POR_TENTATIVA = 55_000;
const LIMITE_TOTAL = 120_000;
/** Com menos que isso sobrando, não começa outra tentativa (a pessoa já esperou demais). */
const MINIMO_PARA_TENTAR = 30_000;
/** Depois de um "sem cota" (429), o modelo fica este tempo sem ser tentado. */
const PAUSA_SEM_COTA = 10 * 60_000;
const semCotaAte = new Map<string, number>();
/** Erros que não adianta repetir: pedido inválido ou chave recusada. */
const SEM_NOVA_TENTATIVA = [400, 401, 403];

function paraGemini(parte: Parte): Part {
  return "texto" in parte
    ? { text: parte.texto }
    : { inlineData: { mimeType: parte.arquivo.mime, data: Buffer.from(parte.arquivo.bytes).toString("base64") } };
}

export async function gerarComGemini(partes: Parte[], opcoes: OpcoesDaGeracao): Promise<string> {
  const config = {
    systemInstruction: opcoes.sistema,
    ...(opcoes.schemaJson ? { responseMimeType: "application/json", responseJsonSchema: opcoes.schemaJson } : {}),
  };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new IaIndisponivel("GEMINI_API_KEY não configurada.");
  const ia = new GoogleGenAI({ apiKey, httpOptions: { timeout: LIMITE_POR_TENTATIVA } });

  const inicio = Date.now();
  let ultimoErro = "nenhuma tentativa feita";
  for (let rodada = 0; rodada < RODADAS; rodada++) {
    if (rodada > 0) await new Promise((r) => setTimeout(r, 2000));
    // Modelos em pausa por falta de cota só entram se não sobrar nenhum outro.
    const disponiveis = MODELOS.filter((m) => (semCotaAte.get(m) ?? 0) < Date.now());
    for (const model of disponiveis.length > 0 ? disponiveis : MODELOS) {
      const restante = LIMITE_TOTAL - (Date.now() - inicio);
      if (restante < MINIMO_PARA_TENTAR) break;
      const t0 = Date.now();
      try {
        const resposta = await ia.models.generateContent({
          model,
          contents: [{ role: "user", parts: partes.map(paraGemini) }],
          // Cada tentativa cabe no que sobra do tempo total.
          config: { ...config, abortSignal: AbortSignal.timeout(Math.min(LIMITE_POR_TENTATIVA, restante)) },
        });
        const texto = resposta.text?.trim();
        if (texto) {
          registrarIA(model, "ok");
          return texto;
        }
        registrarIA(model, "falha");
        ultimoErro = `${model}: resposta vazia`;
      } catch (erro) {
        const status = (erro as { status?: number }).status;
        ultimoErro = `${model}: ${status ?? (erro instanceof Error ? erro.name : "erro")}`;
        registrarIA(model, status === 429 ? "sem_cota" : "falha");
        if (status === 429) semCotaAte.set(model, Date.now() + PAUSA_SEM_COTA);
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
