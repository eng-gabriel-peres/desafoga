import { chaveDoDia, diaDe, ultimosDias } from "./datas";
import type { Compra, Emocao } from "./tipos";

/** Só as compras em que a pessoa disse como estava. */
export const comEmocao = (compras: Compra[]) => compras.filter((c): c is Compra & { emocao: Emocao } => c.emocao !== null);

/** Média das emoções de uma lista de compras (as sem emoção ficam de fora), ou null se não houver. */
export function notaMedia(compras: Compra[]): number | null {
  const sentidas = comEmocao(compras);
  if (!sentidas.length) return null;
  return sentidas.reduce((s, c) => s + c.emocao, 0) / sentidas.length;
}

/** Carinha correspondente a uma nota: arredonda e limita de 1 a 5. */
export function emocaoDaNota(nota: number): Emocao {
  return Math.min(5, Math.max(1, Math.round(nota))) as Emocao;
}

export function rotuloDaNota(nota: number | null): string {
  if (nota === null) return "Sem compras";
  if (nota < 1.75) return "Dia muito triste";
  if (nota < 2.5) return "Dia triste";
  if (nota < 3.5) return "Dia normal";
  if (nota < 4.25) return "Dia feliz";
  return "Dia muito feliz";
}

export function comprasDoDia(compras: Compra[], chave: string): Compra[] {
  return compras
    .filter((c) => diaDe(c.quando) === chave)
    .sort((a, b) => a.quando.localeCompare(b.quando));
}

export const somaDosValores = (compras: Compra[]) => compras.reduce((s, c) => s + c.valor, 0);

/** Nota do dia: média das emoções das compras feitas naquele dia. */
export function notaDoDia(compras: Compra[], dia: Date): number | null {
  return notaMedia(comprasDoDia(compras, chaveDoDia(dia)));
}

export interface DiaResumo {
  chave: string;
  nota: number | null;
  gasto: number;
  compras: Compra[];
}

export interface ResumoDaSemana {
  dias: DiaResumo[];
  /** Média das notas dos dias com compra. */
  nota: number | null;
  gasto: number;
  total: number;
  naoNecessarias: number;
  /** Compras que o profissional ainda não avaliou. */
  paraAvaliar: number;
  compras: Compra[];
}

/** Os últimos 7 dias até hoje, dia a dia, com os totais da semana. */
export function resumoDaSemana(compras: Compra[], hoje: Date): ResumoDaSemana {
  const dias = ultimosDias(hoje, 7).map((chave) => {
    const doDia = comprasDoDia(compras, chave);
    return { chave, nota: notaMedia(doDia), gasto: somaDosValores(doDia), compras: doDia };
  });
  const daSemana = dias.flatMap((d) => d.compras);
  const notas = dias.map((d) => d.nota).filter((n): n is number => n !== null);
  return {
    dias,
    nota: notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null,
    gasto: somaDosValores(daSemana),
    total: daSemana.length,
    naoNecessarias: daSemana.filter((c) => c.necessidade === "nao").length,
    paraAvaliar: daSemana.filter((c) => c.avaliacaoProfissional === null).length,
    compras: daSemana,
  };
}

export type Situacao = "estavel" | "acompanhar" | "atencao" | "novo";

/**
 * Situação do paciente na semana. Precisa de atenção com nota abaixo de 2,6 ou
 * metade das compras não necessárias; acompanhar abaixo de 3,2 ou 30%.
 */
export function situacaoDoPaciente(
  semana: Pick<ResumoDaSemana, "nota" | "total" | "naoNecessarias">,
): Situacao {
  if (!semana.total) return "novo";
  const parte = semana.naoNecessarias / semana.total;
  if ((semana.nota !== null && semana.nota < 2.6) || parte >= 0.5) return "atencao";
  if ((semana.nota !== null && semana.nota < 3.2) || parte >= 0.3) return "acompanhar";
  return "estavel";
}
