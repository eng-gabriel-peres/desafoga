/**
 * O dinheiro do mês tem que bater: o que entra (renda) menos as contas fixas,
 * as parcelas das dívidas (pelo plano) e o que vai para as metas é o que
 * sobra para distribuir nos orçamentos. Nada disso pode passar da renda.
 */
import type { Frequencia, Meta, Orcamento } from "./tipos";

/** Quantas vezes o período cabe num mês (semana: 52 semanas / 12 meses). */
export const VEZES_POR_MES: Record<Frequencia, number> = { dia: 30, semana: 52 / 12, mes: 1 };

/** Quanto a meta tira do mês. */
export const metaNoMes = (m: Pick<Meta, "valorPorPeriodo" | "frequencia">) => Math.round(m.valorPorPeriodo * VEZES_POR_MES[m.frequencia]);

export interface DinheiroDoMes {
  renda: number | null;
  contas: number;
  parcelas: number;
  metas: number;
  orcamentos: number;
  /** Renda menos contas, parcelas e metas; null sem renda informada. */
  paraOrcamentos: number | null;
  /** O que ainda não foi distribuído; negativo: passou da renda. */
  sobra: number | null;
}

/** `metas`: só as que ainda estão em andamento. */
export function dinheiroDoMes(d: { renda: number | null; contas: number; parcelas: number; metas: Pick<Meta, "valorPorPeriodo" | "frequencia">[]; orcamentos: Orcamento[] }): DinheiroDoMes {
  const metas = d.metas.reduce((s, m) => s + metaNoMes(m), 0);
  const orcamentos = d.orcamentos.reduce((s, o) => s + o.limite, 0);
  const paraOrcamentos = d.renda === null ? null : d.renda - d.contas - d.parcelas - metas;
  return { renda: d.renda, contas: d.contas, parcelas: d.parcelas, metas, orcamentos, paraOrcamentos, sobra: paraOrcamentos === null ? null : paraOrcamentos - orcamentos };
}

/**
 * Trocar um valor mensal de `antes` para `depois` (um orçamento, uma meta, o
 * plano) cabe no mês? Diminuir sempre cabe; sem renda, não dá para conferir.
 * `ate`: o maior valor que cabe no lugar dele.
 */
export function cabeNoMes(d: DinheiroDoMes, antes: number, depois: number): { cabe: boolean; ate: number | null } {
  if (d.sobra === null) return { cabe: true, ate: null };
  const ate = Math.max(0, antes + d.sobra);
  return { cabe: depois <= antes || depois <= ate, ate };
}
