/**
 * A IA do app. Escolhe o provedor por IA_PROVEDOR:
 * - `gemini` (padrão): API do Gemini, com GEMINI_API_KEY.
 * - `claude-local`: Claude Code instalado na máquina (só no desenvolvimento).
 *   O que o Claude não lê (áudio) vai para o Gemini, se houver chave.
 */
import { z } from "zod";
import { claudeLocalAceita, claudeLocalConfigurado, gerarComClaudeLocal } from "./claude-local";
import { IaIndisponivel } from "./erros";
import { geminiConfigurado, gerarComGemini } from "./gemini";
import type { Gerador, OpcoesDaGeracao, Parte } from "./tipos";

export { IaIndisponivel, IaSobrecarregada } from "./erros";
export type { Parte } from "./tipos";

if (process.env.IA_PROVEDOR === "claude-local" && process.env.VERCEL) {
  console.warn("IA: IA_PROVEDOR=claude-local não funciona na Vercel; a IA fica desligada.");
}

const mimesDe = (partes: Parte[]) => partes.flatMap((p) => ("arquivo" in p ? [p.arquivo.mime] : []));

/** Quem atende este pedido, ou null se nenhum provedor ligado consegue. */
function escolher(partes: Parte[]): Gerador | null {
  if (process.env.IA_PROVEDOR === "claude-local") {
    if (!claudeLocalConfigurado()) return null;
    if (mimesDe(partes).every(claudeLocalAceita)) return gerarComClaudeLocal;
  }
  return geminiConfigurado() ? gerarComGemini : null;
}

async function gerar(partes: Parte[], opcoes: OpcoesDaGeracao): Promise<string> {
  const gerador = escolher(partes);
  if (!gerador) throw new IaIndisponivel(`Nenhuma IA configurada para ${mimesDe(partes).join(", ") || "texto"}.`);
  return gerador(partes, opcoes);
}

/** Há IA para texto e documentos? Sem ela, a Luana responde só por regras. */
export const iaConfigurada = (): boolean => escolher([{ texto: "" }]) !== null;

/** Há IA que ouve áudio deste tipo? (No modo claude-local, só com a chave do Gemini.) */
export const iaOuve = (mime: string): boolean => escolher([{ arquivo: { bytes: new Uint8Array(), mime } }]) !== null;

export function parteDeArquivo(bytes: Uint8Array, mime: string): Parte {
  return { arquivo: { bytes, mime } };
}

/** Pede ao modelo uma resposta no formato do schema e valida o que voltou. */
export async function gerarJson<T extends z.ZodType>(schema: T, instrucoes: string, partes: Parte[]): Promise<z.infer<T>> {
  const texto = await gerar(partes, { sistema: instrucoes, schemaJson: z.toJSONSchema(schema) as Record<string, unknown> });

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
  return gerar([{ texto: conteudo }], { sistema: instrucoes });
}
