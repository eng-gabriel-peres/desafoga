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

/** Quanto foi gasto numa categoria no mês de `agora`. */
export function gastoDoMes(compras: Compra[], categoria: Categoria, agora: Date): number {
  const mes = chaveDoMes(agora);
  return compras
    .filter((c) => c.categoria === categoria && chaveDoMes(new Date(c.quando)) === mes)
    .reduce((s, c) => s + c.valor, 0);
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
export function orcamentoDoMes(orcamentos: Orcamento[], compras: Compra[], agora: Date): SituacaoDoOrcamento[] {
  return orcamentos
    .filter((o) => o.limite > 0)
    .map((o) => situacaoDoOrcamento(o, gastoDoMes(compras, o.categoria, agora), agora))
    .sort((a, b) => b.usado - a.usado);
}
