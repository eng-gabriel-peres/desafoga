import { AJUSTAVEIS, type Categoria, type Lancamento } from "./lancamentos";

/**
 * Todas as contas da Sofia ficam aqui. O modelo de IA só lê documentos e
 * redige; nenhum número mostrado ao usuário é calculado por ele.
 */

export interface FaturaInfo {
  emissor: string | null;
  vencimento: string | null;
  total: number | null;
  pagamentoMinimo: number | null;
  /** Fração ao mês: 0.138 = 13,8%. */
  taxaRotativoMensal: number | null;
}

export interface Conta {
  lancamentos: Lancamento[];
  rendaMensal: number | null;
  saldoEmConta: number | null;
  fatura: FaturaInfo | null;
}

export interface TotalPorCategoria {
  categoria: Categoria;
  total: number;
  /** Parte do total de gastos, de 0 a 100, arredondada. */
  percentual: number;
}

export interface Periodo {
  total: number;
  quantidade: number;
  porCategoria: TotalPorCategoria[];
}

export interface Resumo {
  hoje: Periodo & { data: string };
  mes: Periodo & {
    /** AAAA-MM do mês analisado: o do lançamento mais recente. */
    referencia: string;
    maiores: Lancamento[];
    encargos: { juros: number; iof: number; tarifas: number; total: number };
    assinaturas: Lancamento[];
  };
  /** Mês com compras imediatamente anterior ao de referência, se houver. */
  mesAnterior: (Periodo & { referencia: string; encargos: number }) | null;
  /** Juros de um mês sobre o que sobra da fatura se só o mínimo for pago. */
  jurosSePagarSoOMinimo: number | null;
  poupanca: { meta: number; tetoDeGastos: number; sobraDoMes: number } | null;
  corte: { categoria: Categoria; total: number; economia: number } | null;
}

/** Fração da renda sugerida como meta de poupança (regra 50/30/20). */
export const META_DE_POUPANCA = 0.2;
/** Corte sugerido na maior categoria ajustável. */
export const CORTE_SUGERIDO = 0.2;

export function resumir(conta: Conta, hoje: string): Resumo {
  const compras = conta.lancamentos.filter((l) => l.natureza === "compra");
  const referencia = conta.lancamentos.reduce(
    (maior, l) => (l.data.slice(0, 7) > maior ? l.data.slice(0, 7) : maior),
    "",
  ) || hoje.slice(0, 7);

  const doMes = conta.lancamentos.filter((l) => l.data.startsWith(referencia));
  const comprasDoMes = doMes.filter((l) => l.natureza === "compra");
  const mes = periodo(comprasDoMes);

  const soma = (natureza: Lancamento["natureza"]) =>
    doMes.filter((l) => l.natureza === natureza).reduce((s, l) => s + l.valor, 0);
  const encargos = { juros: soma("juros"), iof: soma("iof"), tarifas: soma("tarifa_ou_multa"), total: 0 };
  encargos.total = encargos.juros + encargos.iof + encargos.tarifas;

  const refAnterior = compras
    .map((l) => l.data.slice(0, 7))
    .filter((m) => m < referencia)
    .sort()
    .at(-1);
  const mesAnterior = refAnterior
    ? {
        referencia: refAnterior,
        ...periodo(compras.filter((l) => l.data.startsWith(refAnterior))),
        encargos: conta.lancamentos
          .filter(
            (l) =>
              l.data.startsWith(refAnterior) &&
              (l.natureza === "juros" || l.natureza === "iof" || l.natureza === "tarifa_ou_multa"),
          )
          .reduce((s, l) => s + l.valor, 0),
      }
    : null;

  const ajustavel = mes.porCategoria.find((c) => AJUSTAVEIS.includes(c.categoria));
  const f = conta.fatura;

  return {
    hoje: { data: hoje, ...periodo(compras.filter((l) => l.data === hoje)) },
    mes: {
      referencia,
      ...mes,
      maiores: [...comprasDoMes].sort((a, b) => b.valor - a.valor).slice(0, 5),
      encargos,
      assinaturas: comprasDoMes.filter((l) => l.categoria === "assinaturas"),
    },
    mesAnterior,
    jurosSePagarSoOMinimo:
      f?.total && f.pagamentoMinimo && f.taxaRotativoMensal && f.total > f.pagamentoMinimo
        ? Math.round((f.total - f.pagamentoMinimo) * f.taxaRotativoMensal)
        : null,
    poupanca: conta.rendaMensal
      ? {
          meta: Math.round(conta.rendaMensal * META_DE_POUPANCA),
          tetoDeGastos: Math.round(conta.rendaMensal * (1 - META_DE_POUPANCA)),
          sobraDoMes: conta.rendaMensal - mes.total - encargos.total,
        }
      : null,
    corte: ajustavel
      ? {
          categoria: ajustavel.categoria,
          total: ajustavel.total,
          economia: Math.round(ajustavel.total * CORTE_SUGERIDO),
        }
      : null,
  };
}

function periodo(compras: Lancamento[]): Periodo {
  const total = compras.reduce((s, l) => s + l.valor, 0);
  const somas = new Map<Categoria, number>();
  for (const l of compras) somas.set(l.categoria, (somas.get(l.categoria) ?? 0) + l.valor);
  const porCategoria = [...somas]
    .map(([categoria, valor]) => ({
      categoria,
      total: valor,
      percentual: total > 0 ? Math.round((valor / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
  return { total, quantidade: compras.length, porCategoria };
}
