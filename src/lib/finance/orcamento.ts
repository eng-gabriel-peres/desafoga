/**
 * Orçamento por categoria: quanto já foi usado no mês, quanto resta e quanto
 * dá para gastar por dia até o fim do mês. Valores em centavos.
 */
import { chaveDoMes } from "./datas";
import type { Categoria, Compra, Orcamento } from "./tipos";

/** A partir de quanto do orçamento usado o aviso pede atenção. */
export const LIMIAR_DE_ATENCAO = 0.8;

export type EstadoDoOrcamento = "tranquilo" | "atencao" | "estourou";

export interface SituacaoDoOrcamento {
  categoria: Categoria;
  limite: number;
  gasto: number;
  /** Fração usada: 0,8 = 80%. Pode passar de 1. */
  usado: number;
  /** Quanto ainda dá para gastar no mês (0 se já passou). */
  restante: number;
  /** Quanto passou do limite (0 se não passou). */
  passou: number;
  /** Dias até o fim do mês, contando hoje. */
  diasRestantes: number;
  /** Limite diário recomendado até o fim do mês, arredondado para baixo. */
  porDia: number;
  estado: EstadoDoOrcamento;
}

/** Dias até o fim do mês, contando hoje (no último dia, 1). */
export function diasAteOFimDoMes(agora: Date): number {
  const ultimo = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  return ultimo - agora.getDate() + 1;
}

/** Gasto que ainda não virou compra registrada (ex.: compra do banco esperando revisão). */
export interface GastoAvulso {
  categoria: Categoria;
  /** Centavos. */
  valor: number;
  /** YYYY-MM-DD */
  data: string;
}

const mesesEntre = (de: string, ate: string) => {
  const [a, m] = de.split("-").map(Number);
  const [b, n] = ate.split("-").map(Number);
  return (b - a) * 12 + (n - m);
};

/** Quanto da compra cai no mês: a parcelada conta a parcela em cada mês até a última; a à vista, tudo no mês dela. */
export function valorNoMes(c: Compra, mes: string): number {
  const mesDaCompra = chaveDoMes(new Date(c.quando));
  if (c.parcelas && c.parcelas > 1 && c.valorDaParcela) {
    const n = mesesEntre(mesDaCompra, mes);
    return n >= 0 && n < c.parcelas ? c.valorDaParcela : 0;
  }
  return mesDaCompra === mes ? c.valor : 0;
}

/** Quanto foi gasto numa categoria no mês de `agora`, com os gastos avulsos do banco. */
export function gastoDoMes(compras: Compra[], categoria: Categoria, agora: Date, avulsos: GastoAvulso[] = []): number {
  const mes = chaveDoMes(agora);
  const registradas = compras.filter((c) => c.categoria === categoria).reduce((s, c) => s + valorNoMes(c, mes), 0);
  const doBanco = avulsos.filter((a) => a.categoria === categoria && a.data.slice(0, 7) === mes).reduce((s, a) => s + a.valor, 0);
  return registradas + doBanco;
}

export function situacaoDoOrcamento(orcamento: Orcamento, gasto: number, agora: Date): SituacaoDoOrcamento {
  const { categoria, limite } = orcamento;
  const restante = Math.max(0, limite - gasto);
  const diasRestantes = diasAteOFimDoMes(agora);
  const usado = limite > 0 ? gasto / limite : 0;
  return {
    categoria,
    limite,
    gasto,
    usado,
    restante,
    passou: Math.max(0, gasto - limite),
    diasRestantes,
    porDia: Math.floor(restante / diasRestantes),
    estado: gasto >= limite ? "estourou" : usado >= LIMIAR_DE_ATENCAO ? "atencao" : "tranquilo",
  };
}

/** Situação de todos os orçamentos no mês, do mais usado para o menos usado. */
export function orcamentoDoMes(orcamentos: Orcamento[], compras: Compra[], agora: Date, avulsos: GastoAvulso[] = []): SituacaoDoOrcamento[] {
  return orcamentos
    .filter((o) => o.limite > 0)
    .map((o) => situacaoDoOrcamento(o, gastoDoMes(compras, o.categoria, agora, avulsos), agora))
    .sort((a, b) => b.usado - a.usado);
}

export interface ResumoDoOrcamento {
  limite: number;
  gasto: number;
  restante: number;
  usado: number;
  diasRestantes: number;
  porDia: number;
}

/** Soma das categorias com limite: quanto foi usado no mês e quanto dá por dia até o fim. */
export function resumoDoOrcamento(situacoes: SituacaoDoOrcamento[], agora: Date): ResumoDoOrcamento {
  const limite = situacoes.reduce((s, x) => s + x.limite, 0);
  // O que passou numa categoria não "come" o que sobra nas outras: soma só o que resta de cada uma.
  const restante = situacoes.reduce((s, x) => s + x.restante, 0);
  const gasto = situacoes.reduce((s, x) => s + x.gasto, 0);
  const diasRestantes = diasAteOFimDoMes(agora);
  return { limite, gasto, restante, usado: limite ? gasto / limite : 0, diasRestantes, porDia: Math.floor(restante / diasRestantes) };
}
