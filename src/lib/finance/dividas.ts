import type { Divida, Estrategia } from "./tipos";

/** Limite da simulação: 30 anos. Depois disso, consideramos que não quita. */
export const LIMITE_DE_MESES = 360;

export interface ResultadoQuitacao {
  /** false quando o valor mensal não quita tudo dentro do limite de meses. */
  quitavel: boolean;
  meses: number;
  jurosTotal: number;
  totalPago: number;
  /** Saldo total hoje (índice 0) e ao fim de cada mês simulado. */
  linhaDoTempo: number[];
  /** Mês em que cada dívida zerou, por id. */
  quitadaNoMes: Record<string, number>;
  /** Quanto vai para cada dívida no primeiro mês, por id. */
  pagamentoPrimeiroMes: Record<string, number>;
  /** Ids na ordem em que as dívidas são quitadas. */
  ordemDeQuitacao: string[];
}

/** Juros que a dívida gera em um mês, em centavos. */
export function jurosDoMes(divida: Divida): number {
  return Math.round(divida.saldo * divida.taxaMensal);
}

export function jurosMensaisTotais(dividas: Divida[]): number {
  return dividas.reduce((s, d) => s + jurosDoMes(d), 0);
}

export function somaDosMinimos(dividas: Divida[]): number {
  return dividas.reduce((s, d) => s + (d.saldo > 0 ? d.parcelaMinima : 0), 0);
}

export function saldoTotal(dividas: Divida[]): number {
  return dividas.reduce((s, d) => s + d.saldo, 0);
}

/** A dívida de maior taxa ao mês, ou null se não houver dívidas. */
export function dividaMaisCara(dividas: Divida[]): Divida | null {
  return dividas.reduce<Divida | null>(
    (maior, d) => (!maior || d.taxaMensal > maior.taxaMensal ? d : maior),
    null,
  );
}

interface EmAberto {
  id: string;
  saldo: number;
  taxa: number;
  minimo: number;
}

function ordenar(lista: EmAberto[], estrategia: Estrategia): EmAberto[] {
  const copia = [...lista];
  return estrategia === "menor"
    ? copia.sort((a, b) => a.saldo - b.saldo)
    : copia.sort((a, b) => b.taxa - a.taxa);
}

/**
 * Simula a quitação mês a mês com um valor mensal fixo. A cada mês: os juros
 * entram no saldo, o dinheiro paga a parcela mínima de cada dívida e o que
 * sobra vai para a dívida escolhida pela estratégia. Quando uma dívida zera,
 * a parcela dela passa a reforçar as outras.
 */
export function simularQuitacao(
  dividas: Divida[],
  valorMensal: number,
  estrategia: Estrategia,
  limiteMeses = LIMITE_DE_MESES,
): ResultadoQuitacao {
  const abertas: EmAberto[] = dividas
    .filter((d) => d.saldo > 0)
    .map((d) => ({ id: d.id, saldo: d.saldo, taxa: d.taxaMensal, minimo: d.parcelaMinima }));

  const total = () => abertas.reduce((s, d) => s + d.saldo, 0);
  const linhaDoTempo = [total()];
  const quitadaNoMes: Record<string, number> = {};
  const pagamentoPrimeiroMes: Record<string, number> = {};
  let jurosTotal = 0;
  let totalPago = 0;
  let mes = 0;

  while (total() > 0 && mes < limiteMeses) {
    mes++;
    for (const d of abertas) {
      if (d.saldo <= 0) continue;
      const juros = Math.round(d.saldo * d.taxa);
      d.saldo += juros;
      jurosTotal += juros;
    }

    let dinheiro = Math.max(0, valorMensal);
    const pagar = (d: EmAberto, quanto: number) => {
      const valor = Math.min(quanto, d.saldo, dinheiro);
      if (valor <= 0) return;
      d.saldo -= valor;
      dinheiro -= valor;
      totalPago += valor;
      if (mes === 1) pagamentoPrimeiroMes[d.id] = (pagamentoPrimeiroMes[d.id] ?? 0) + valor;
    };

    const ordem = ordenar(abertas.filter((d) => d.saldo > 0), estrategia);
    for (const d of ordem) pagar(d, d.minimo);
    for (const d of ordem) pagar(d, d.saldo);

    for (const d of abertas) {
      if (d.saldo <= 0 && quitadaNoMes[d.id] === undefined) quitadaNoMes[d.id] = mes;
    }
    linhaDoTempo.push(total());
  }

  const ordemDeQuitacao = Object.keys(quitadaNoMes).sort(
    (a, b) => quitadaNoMes[a] - quitadaNoMes[b],
  );

  return {
    quitavel: total() === 0,
    meses: mes,
    jurosTotal,
    totalPago,
    linhaDoTempo,
    quitadaNoMes,
    pagamentoPrimeiroMes,
    ordemDeQuitacao,
  };
}

/**
 * Juros dos próximos meses pagando só a parcela mínima de cada dívida.
 * Mostra quanto custa continuar como está.
 */
export function projecaoSoMinimo(
  dividas: Divida[],
  meses = 12,
): { jurosTotal: number; saldoFinal: number } {
  const saldos = dividas.map((d) => ({ ...d }));
  let jurosTotal = 0;
  for (let m = 0; m < meses; m++) {
    for (const d of saldos) {
      if (d.saldo <= 0) continue;
      const juros = Math.round(d.saldo * d.taxaMensal);
      jurosTotal += juros;
      d.saldo = Math.max(0, d.saldo + juros - d.parcelaMinima);
    }
  }
  return { jurosTotal, saldoFinal: saldos.reduce((s, d) => s + d.saldo, 0) };
}

/** Juros a menos no plano do que pagando só o mínimo; null se só o mínimo não quita. */
export function economiaContraOMinimo(dividas: Divida[], valorMensal: number, estrategia: Estrategia): number | null {
  const soMinimo = simularQuitacao(dividas, somaDosMinimos(dividas), estrategia);
  if (!soMinimo.quitavel) return null;
  return Math.max(0, soMinimo.jurosTotal - simularQuitacao(dividas, valorMensal, estrategia).jurosTotal);
}

export interface ComparacaoExtra {
  soMinimo: ResultadoQuitacao;
  comExtra: ResultadoQuitacao;
  /**
   * Juros a menos pagando o extra, em centavos (nunca negativo). null quando
   * só o mínimo não quita as dívidas: aí os juros crescem sem fim e a diferença
   * não é um número que faça sentido mostrar.
   */
  economiaJuros: number | null;
  mesesAMenos: number;
}

/** Compara pagar só os mínimos com pagar os mínimos mais um valor extra por mês. */
export function compararExtra(
  dividas: Divida[],
  extra: number,
  estrategia: Estrategia = "mais-cara",
): ComparacaoExtra {
  const minimos = somaDosMinimos(dividas);
  const soMinimo = simularQuitacao(dividas, minimos, estrategia);
  const comExtra = simularQuitacao(dividas, minimos + Math.max(0, extra), estrategia);
  return {
    soMinimo,
    comExtra,
    economiaJuros: soMinimo.quitavel ? Math.max(0, soMinimo.jurosTotal - comExtra.jurosTotal) : null,
    mesesAMenos: Math.max(0, soMinimo.meses - comExtra.meses),
  };
}
