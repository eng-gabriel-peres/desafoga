/**
 * Metas de economia: quanto falta, se a pessoa está em dia com o plano e
 * quando termina. Valores em centavos; datas como "YYYY-MM-DD".
 */
import { chaveDoDia } from "./datas";
import type { Frequencia, Meta } from "./tipos";

export const DIAS_DO_PERIODO: Record<Frequencia, number> = { dia: 1, semana: 7, mes: 30 };

const paraData = (chave: string) => {
  const [a, m, d] = chave.split("-").map(Number);
  return new Date(a, m - 1, d);
};

export function diasEntre(de: string, ate: string): number {
  return Math.round((paraData(ate).getTime() - paraData(de).getTime()) / 86_400_000);
}

/** Meses completos entre as datas. */
export function mesesEntre(de: string, ate: string): number {
  const x = paraData(de);
  const y = paraData(ate);
  let m = (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth());
  if (y.getDate() < x.getDate()) m--;
  return m;
}

export function somarPeriodos(chave: string, frequencia: Frequencia, n: number): string {
  const d = paraData(chave);
  if (frequencia === "mes") d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + n * DIAS_DO_PERIODO[frequencia]);
  return chaveDoDia(d);
}

export const guardadoNaMeta = (meta: Meta) => meta.depositos.reduce((s, d) => s + d.valor, 0);

export interface OpcoesDoPrazo {
  dias: number;
  semanas: number;
  meses: number;
  /** Quanto guardar por período para chegar no prazo, arredondado para cima. */
  dia: number;
  semana: number;
  mes: number;
}

/** "Tenho uma data": quanto guardar por dia, semana ou mês para juntar `falta` até o prazo. */
export function opcoesParaPrazo(falta: number, prazo: string, hoje: string): OpcoesDoPrazo {
  const dias = Math.max(1, diasEntre(hoje, prazo));
  const semanas = Math.max(1, Math.floor(dias / 7));
  const meses = Math.max(1, mesesEntre(hoje, prazo));
  return { dias, semanas, meses, dia: Math.ceil(falta / dias), semana: Math.ceil(falta / semanas), mes: Math.ceil(falta / meses) };
}

/** "Sei quanto guardar": em quantos períodos e em que data a meta termina. */
export function previsaoDeTermino(falta: number, valor: number, frequencia: Frequencia, hoje: string): { periodos: number; data: string } | null {
  if (valor <= 0) return null;
  const periodos = Math.ceil(falta / valor);
  return { periodos, data: somarPeriodos(hoje, frequencia, periodos) };
}

export interface SituacaoDaMeta {
  concluida: boolean;
  guardado: number;
  falta: number;
  /** De 0 a 1. */
  fracao: number;
  /** "Em dia", "Adiantada" ou "Faltam R$ X para ficar em dia" (o valor vem em `atrasado`). */
  ritmo: "em-dia" | "adiantada" | "atrasada";
  /** Quanto falta para ficar em dia com o plano (0 se em dia). */
  atrasado: number;
  previsao: { periodos: number; data: string } | null;
  /** A previsão passa do prazo escolhido. */
  depoisDoPrazo: boolean;
}

export function situacaoDaMeta(meta: Meta, agora: Date): SituacaoDaMeta {
  const hoje = chaveDoDia(agora);
  const guardado = guardadoNaMeta(meta);
  const falta = Math.max(0, meta.alvo - guardado);
  const fracao = meta.alvo > 0 ? Math.min(1, guardado / meta.alvo) : 0;
  if (falta === 0) {
    return { concluida: true, guardado, falta: 0, fracao: 1, ritmo: "em-dia", atrasado: 0, previsao: null, depoisDoPrazo: false };
  }
  // Quanto já deveria ter, pelo plano, desde que a meta foi criada.
  const decorridos = Math.max(0, diasEntre(meta.criadaEm, hoje));
  const periodos =
    meta.frequencia === "mes" ? Math.max(0, mesesEntre(meta.criadaEm, hoje)) : Math.floor(decorridos / DIAS_DO_PERIODO[meta.frequencia]);
  const esperado = Math.min(meta.alvo, meta.inicial + meta.valorPorPeriodo * periodos);
  const diferenca = guardado - esperado;
  const previsao = previsaoDeTermino(falta, meta.valorPorPeriodo, meta.frequencia, hoje);
  return {
    concluida: false,
    guardado,
    falta,
    fracao,
    ritmo: diferenca < 0 ? "atrasada" : diferenca > meta.valorPorPeriodo * 0.5 ? "adiantada" : "em-dia",
    atrasado: Math.max(0, -diferenca),
    previsao,
    depoisDoPrazo: Boolean(meta.prazo && previsao && previsao.data > meta.prazo),
  };
}
