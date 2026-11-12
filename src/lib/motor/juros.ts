/**
 * Motor financeiro do Desafoga.
 *
 * Regra do projeto: a IA lê e conversa, o código calcula. Todo número mostrado
 * ao usuário sai daqui, nunca do modelo. Valores em centavos (inteiros) para
 * não acumular erro de ponto flutuante.
 */

export type TipoDivida =
  | "cartao_rotativo"
  | "cheque_especial"
  | "parcelamento"
  | "emprestimo";

export interface Divida {
  id: string;
  nome: string;
  tipo: TipoDivida;
  /** Saldo devedor em centavos. */
  saldo: number;
  /** Taxa de juros ao mês em fração: 0.14 = 14% a.m. */
  taxaMensal: number;
  /** Pagamento mínimo mensal em centavos. */
  pagamentoMinimo: number;
}

export interface MesSimulado {
  mes: number;
  juros: number;
  pago: number;
  /** Saldo de cada dívida ao fim do mês, por id. */
  saldos: Record<string, number>;
}

export interface Simulacao {
  /** false quando o orçamento não quita as dívidas dentro do limite de meses. */
  quitavel: boolean;
  meses: number;
  jurosTotal: number;
  totalPago: number;
  cronograma: MesSimulado[];
}

const LIMITE_MESES = 600;

/** Juros que a dívida gera em um mês, em centavos. */
export function jurosDoMes(divida: Divida): number {
  return Math.round(divida.saldo * divida.taxaMensal);
}

/** Soma dos juros de um mês de todas as dívidas. */
export function jurosMensaisTotais(dividas: Divida[]): number {
  return dividas.reduce((soma, d) => soma + jurosDoMes(d), 0);
}

/** Ordem de ataque: a dívida mais cara primeiro (método avalanche). */
export function ordenarPorCusto(dividas: Divida[]): Divida[] {
  return [...dividas].sort((a, b) => b.taxaMensal - a.taxaMensal);
}

/**
 * Simula a quitação com um orçamento mensal fixo: paga o mínimo de todas e
 * joga o que sobra na dívida de maior taxa.
 */
export function simularQuitacao(
  dividas: Divida[],
  orcamentoMensal: number,
): Simulacao {
  const minimos = dividas.reduce((s, d) => s + d.pagamentoMinimo, 0);
  if (orcamentoMensal < minimos) {
    throw new Error(
      `Orçamento (${orcamentoMensal}) menor que a soma dos mínimos (${minimos}).`,
    );
  }

  const ordem = ordenarPorCusto(dividas).map((d) => ({ ...d }));
  const cronograma: MesSimulado[] = [];
  let jurosTotal = 0;
  let totalPago = 0;

  for (let mes = 1; mes <= LIMITE_MESES; mes++) {
    if (ordem.every((d) => d.saldo === 0)) break;

    let jurosMes = 0;
    for (const d of ordem) {
      const j = jurosDoMes(d);
      d.saldo += j;
      jurosMes += j;
    }

    let disponivel = orcamentoMensal;
    for (const d of ordem) {
      const pagamento = Math.min(d.pagamentoMinimo, d.saldo, disponivel);
      d.saldo -= pagamento;
      disponivel -= pagamento;
    }
    for (const d of ordem) {
      const extra = Math.min(d.saldo, disponivel);
      d.saldo -= extra;
      disponivel -= extra;
    }

    const pago = orcamentoMensal - disponivel;
    jurosTotal += jurosMes;
    totalPago += pago;
    cronograma.push({
      mes,
      juros: jurosMes,
      pago,
      saldos: Object.fromEntries(ordem.map((d) => [d.id, d.saldo])),
    });
  }

  return {
    quitavel: ordem.every((d) => d.saldo === 0),
    meses: cronograma.length,
    jurosTotal,
    totalPago,
    cronograma,
  };
}
