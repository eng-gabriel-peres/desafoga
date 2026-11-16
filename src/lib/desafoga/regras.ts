/** Regras de negócio que não dependem de onde os dados ficam. */
import { reais } from "@/lib/assistente/textos";
import type { Compra } from "@/lib/finance";

/** A partir deste valor, o responsável recebe um aviso de compra alta. */
export const COMPRA_ALTA = 20000;

/** Texto do aviso de compra alta, ou null quando a compra não é alta. */
export function avisoDeCompraAlta(compra: Pick<Compra, "valor" | "item">, apelido: string): string | null {
  return compra.valor >= COMPRA_ALTA ? `${apelido} registrou uma compra de ${reais(compra.valor)} (${compra.item}).` : null;
}

export function avisoDeSugestao(profissional: string, valor: number): string {
  return `${profissional} sugeriu pagar ${reais(valor)} por mês nas dívidas.`;
}

export function mensagemDeSugestao(profissional: string, valor: number): string {
  return `${profissional} sugeriu pagar ${reais(valor)} por mês nas dívidas. Quer ver como fica? Abra Dívidas ou me escreva: plano.`;
}

/** "PERFUMARIA SHOPPING" -> "Perfumaria shopping", para a compra criada a partir da fatura. */
export function nomeDeCompraDaFatura(descricao: string): string {
  return descricao.charAt(0) + descricao.slice(1).toLowerCase();
}
