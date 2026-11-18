/** Regras de negócio que não dependem de onde os dados ficam. */
import { reais } from "@/lib/assistente/textos";
import { rotuloDaNota, type Compra, type ConfigDosAvisos } from "@/lib/finance";
import { umaCasa } from "@/lib/assistente/textos";

/** Texto do aviso de compra alta, ou null quando a compra não é alta (ou o aviso está desligado). */
export function avisoDeCompraAlta(compra: Pick<Compra, "valor" | "item">, apelido: string, config: Pick<ConfigDosAvisos, "compraAlta" | "valorDaCompraAlta">): string | null {
  return config.compraAlta && compra.valor >= config.valorDaCompraAlta ? `${apelido} registrou uma compra de ${reais(compra.valor)} (${compra.item}).` : null;
}

/** Aviso de dia difícil para quem acompanha (nota do dia em 2 ou menos). */
export function avisoDeDiaDificil(apelido: string, nota: number): string {
  return `A nota do dia de ${apelido} está em ${umaCasa(nota)} (${rotuloDaNota(nota)}).`;
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
