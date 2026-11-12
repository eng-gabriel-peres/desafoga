import { AJUSTAVEIS, type Categoria, type Lancamento } from "./lancamentos";

/**
 * Todas as contas da Luana ficam aqui. O modelo de IA só lê documentos e
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
  /** Soma das contas mensais que a pessoa contou ter (cartão, aluguel...), em centavos. */
  contasInformadas?: number | null;
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

export interface Entradas {
  total: number;
  quantidade: number;
  maiores: Lancamento[];
}

export interface TotalPorOrigem {
  origem: string;
  entradas: number;
  /** Gastos mais juros, IOF e tarifas. */
  saidas: number;
}

export interface Resumo {
  hoje: Periodo & { data: string };
  mes: Periodo & {
    /** AAAA-MM do mês analisado: o do lançamento mais recente. */
    referencia: string;
    maiores: Lancamento[];
    encargos: { juros: number; iof: number; tarifas: number; total: number };
    assinaturas: Lancamento[];
    entradas: Entradas;
    /** Gastos mais encargos: tudo o que saiu de verdade. */
    saidas: number;
    /** Entradas menos saídas; null quando não há nenhuma entrada conhecida. */
    saldo: number | null;
    /** Débitos em conta que pagaram fatura de cartão; não entram nas saídas. */
    faturasPagas: number;
    /** Por banco ou emissor, quando os lançamentos vieram de mais de um. */
    porOrigem: TotalPorOrigem[];
  };
  /** Mês com compras imediatamente anterior ao de referência, se houver. */
  mesAnterior: (Periodo & { referencia: string; encargos: number; entradas: number }) | null;
  /** Juros de um mês sobre o que sobra da fatura se só o mínimo for pago. */
  jurosSePagarSoOMinimo: number | null;
  poupanca: {
    /** De onde veio a renda usada na conta. */
    base: "renda_informada" | "entradas_do_mes";
    renda: number;
    meta: number;
    tetoDeGastos: number;
    sobraDoMes: number;
  } | null;
  corte: { categoria: Categoria; total: number; economia: number } | null;
}

/** Fração da renda sugerida como meta de poupança (regra 50/30/20). */
export const META_DE_POUPANCA = 0.2;
/** Corte sugerido na maior categoria ajustável. */
export const CORTE_SUGERIDO = 0.2;

const ENCARGOS: Lancamento["natureza"][] = ["juros", "iof", "tarifa_ou_multa"];
const total = (itens: Lancamento[]) => itens.reduce((s, l) => s + l.valor, 0);

export function resumir(conta: Conta, hoje: string): Resumo {
  const compras = conta.lancamentos.filter((l) => l.natureza === "compra");
  const referencia = conta.lancamentos.reduce(
    (maior, l) => (l.data.slice(0, 7) > maior ? l.data.slice(0, 7) : maior),
    "",
  ) || hoje.slice(0, 7);

  const doMes = conta.lancamentos.filter((l) => l.data.startsWith(referencia));
  const comprasDoMes = doMes.filter((l) => l.natureza === "compra");
  const mes = periodo(comprasDoMes);

  const soma = (natureza: Lancamento["natureza"]) => total(doMes.filter((l) => l.natureza === natureza));
  const encargos = { juros: soma("juros"), iof: soma("iof"), tarifas: soma("tarifa_ou_multa"), total: 0 };
  encargos.total = encargos.juros + encargos.iof + encargos.tarifas;

  const entradasDoMes = doMes.filter((l) => l.natureza === "entrada");
  const entradas: Entradas = {
    total: total(entradasDoMes),
    quantidade: entradasDoMes.length,
    maiores: [...entradasDoMes].sort((a, b) => b.valor - a.valor).slice(0, 3),
  };
  const saidas = mes.total + encargos.total;

  const refAnterior = conta.lancamentos
    .filter((l) => l.natureza === "compra" || l.natureza === "entrada")
    .map((l) => l.data.slice(0, 7))
    .filter((m) => m < referencia)
    .sort()
    .at(-1);
  const doAnterior = refAnterior ? conta.lancamentos.filter((l) => l.data.startsWith(refAnterior)) : [];
  const mesAnterior = refAnterior
    ? {
        referencia: refAnterior,
        ...periodo(doAnterior.filter((l) => l.natureza === "compra")),
        encargos: total(doAnterior.filter((l) => ENCARGOS.includes(l.natureza))),
        entradas: total(doAnterior.filter((l) => l.natureza === "entrada")),
      }
    : null;

  const ajustavel = mes.porCategoria.find((c) => AJUSTAVEIS.includes(c.categoria));
  const f = conta.fatura;
  const renda = conta.rendaMensal ?? (entradas.total > 0 ? entradas.total : null);

  return {
    hoje: { data: hoje, ...periodo(compras.filter((l) => l.data === hoje)) },
    mes: {
      referencia,
      ...mes,
      maiores: [...comprasDoMes].sort((a, b) => b.valor - a.valor).slice(0, 5),
      encargos,
      assinaturas: comprasDoMes.filter((l) => l.categoria === "assinaturas"),
      entradas,
      saidas,
      saldo: entradas.quantidade > 0 ? entradas.total - saidas : null,
      faturasPagas: soma("pagamento_de_fatura"),
      porOrigem: porOrigem(doMes),
    },
    mesAnterior,
    jurosSePagarSoOMinimo:
      f?.total && f.pagamentoMinimo && f.taxaRotativoMensal && f.total > f.pagamentoMinimo
        ? Math.round((f.total - f.pagamentoMinimo) * f.taxaRotativoMensal)
        : null,
    poupanca: renda
      ? {
          base: conta.rendaMensal ? "renda_informada" : "entradas_do_mes",
          renda,
          meta: Math.round(renda * META_DE_POUPANCA),
          tetoDeGastos: Math.round(renda * (1 - META_DE_POUPANCA)),
          sobraDoMes: renda - saidas,
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
  const soma = total(compras);
  const somas = new Map<Categoria, number>();
  for (const l of compras) somas.set(l.categoria, (somas.get(l.categoria) ?? 0) + l.valor);
  const porCategoria = [...somas]
    .map(([categoria, valor]) => ({
      categoria,
      total: valor,
      percentual: soma > 0 ? Math.round((valor / soma) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
  return { total: soma, quantidade: compras.length, porCategoria };
}

/** Entradas e saídas por banco; vazio quando há menos de duas origens. */
function porOrigem(doMes: Lancamento[]): TotalPorOrigem[] {
  const mapa = new Map<string, TotalPorOrigem>();
  for (const l of doMes) {
    if (!l.origem) continue;
    const entrada = l.natureza === "entrada";
    const saida = l.natureza === "compra" || ENCARGOS.includes(l.natureza);
    if (!entrada && !saida) continue;
    const linha = mapa.get(l.origem) ?? { origem: l.origem, entradas: 0, saidas: 0 };
    if (entrada) linha.entradas += l.valor;
    else linha.saidas += l.valor;
    mapa.set(l.origem, linha);
  }
  return mapa.size < 2 ? [] : [...mapa.values()].sort((a, b) => b.saidas - a.saidas);
}
