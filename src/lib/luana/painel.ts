import type { Categoria, Lancamento } from "./lancamentos";
import { type Acompanhamento, acompanhar } from "./plano";
import type { Conta } from "./resumo";

/**
 * Resumo geral mostrado no painel: um bloco por mês, com entradas, saídas e
 * cada categoria aberta nos itens que a compõem. Tudo calculado aqui.
 */

export interface ItemDoPainel {
  descricao: string;
  total: number;
  quantidade: number;
}

export interface CategoriaDoPainel {
  categoria: Categoria;
  total: number;
  /** Parte dos gastos do mês, de 0 a 100. */
  percentual: number;
  /** Os itens que mais pesam na categoria, somados por descrição. */
  itens: ItemDoPainel[];
}

export interface MesDoPainel {
  /** AAAA-MM */
  referencia: string;
  entradas: number;
  gastos: number;
  /** Juros, IOF e tarifas. */
  encargos: number;
  /** Entradas menos gastos e encargos; null quando não há entrada conhecida. */
  saldo: number | null;
  faturasPagas: number;
  /**
   * Renda que a pessoa informou, usada no lugar das entradas quando o mês mais
   * recente não tem nenhuma entrada anotada; null nos outros casos.
   */
  rendaInformada: number | null;
  categorias: CategoriaDoPainel[];
  maiores: ItemDoPainel[];
}

export interface DocumentoRecebido {
  tipo: string;
  emissor: string | null;
  /** AAAA-MM-DD em que chegou. */
  recebidoEm: string;
  lancamentos: number;
  /** Primeiro e último dia dos lançamentos, AAAA-MM-DD. */
  de: string | null;
  ate: string | null;
}

export interface Painel {
  meses: MesDoPainel[];
  rendaMensal: number | null;
  contasInformadas: number | null;
  saldoEmConta: number | null;
  /** Dinheiro guardado à parte. */
  reserva: number | null;
  /** Previsto contra realizado no mês indicado; null sem despesas informadas. */
  orcamento: (Acompanhamento & { referencia: string; sobra: number | null }) | null;
  documentos: DocumentoRecebido[];
}

const ITENS_POR_CATEGORIA = 6;
const total = (itens: Lancamento[]) => itens.reduce((s, l) => s + l.valor, 0);

/** Soma lançamentos de mesma descrição (sem diferenciar maiúsculas), do maior para o menor. */
function porDescricao(itens: Lancamento[]): ItemDoPainel[] {
  const mapa = new Map<string, ItemDoPainel>();
  for (const l of itens) {
    const chave = l.descricao.trim().toLowerCase();
    const item = mapa.get(chave) ?? { descricao: l.descricao.trim(), total: 0, quantidade: 0 };
    item.total += l.valor;
    item.quantidade += 1;
    mapa.set(chave, item);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

export function montarPainel(conta: Conta, hoje: string, limiteDeMeses = 6): Painel {
  const meses = [...new Set(conta.lancamentos.map((l) => l.data.slice(0, 7)))].sort().reverse().slice(0, limiteDeMeses);
  // O plano vale para o mês mais recente; sem lançamentos, para o mês atual.
  const referencia = meses[0] ?? hoje.slice(0, 7);
  const plano = acompanhar(
    conta.plano,
    conta.lancamentos.filter((l) => l.data.startsWith(referencia)),
  );

  return {
    meses: meses.map((referencia, posicao) => {
      const doMes = conta.lancamentos.filter((l) => l.data.startsWith(referencia));
      const compras = doMes.filter((l) => l.natureza === "compra");
      const entradas = doMes.filter((l) => l.natureza === "entrada");
      const gastos = total(compras);
      const encargos = total(
        doMes.filter((l) => l.natureza === "juros" || l.natureza === "iof" || l.natureza === "tarifa_ou_multa"),
      );

      const grupos = new Map<Categoria, Lancamento[]>();
      for (const l of compras) grupos.set(l.categoria, [...(grupos.get(l.categoria) ?? []), l]);
      const rendaInformada = posicao === 0 && entradas.length === 0 && conta.rendaMensal ? conta.rendaMensal : null;
      const categorias = [...grupos]
        .map(([categoria, itens]) => ({
          categoria,
          total: total(itens),
          percentual: gastos > 0 ? Math.round((total(itens) / gastos) * 100) : 0,
          itens: porDescricao(itens).slice(0, ITENS_POR_CATEGORIA),
        }))
        .sort((a, b) => b.total - a.total);

      return {
        referencia,
        entradas: total(entradas),
        gastos,
        encargos,
        saldo:
          entradas.length > 0
            ? total(entradas) - gastos - encargos
            : rendaInformada !== null
              ? rendaInformada - gastos - encargos
              : null,
        rendaInformada,
        faturasPagas: total(doMes.filter((l) => l.natureza === "pagamento_de_fatura")),
        categorias,
        maiores: porDescricao(compras).slice(0, 5),
      };
    }),
    rendaMensal: conta.rendaMensal,
    contasInformadas: conta.contasInformadas ?? null,
    saldoEmConta: conta.saldoEmConta,
    reserva: conta.reserva ?? null,
    orcamento: plano
      ? { ...plano, referencia, sobra: conta.rendaMensal ? conta.rendaMensal - plano.esperado : null }
      : null,
    documentos: [...(conta.documentos ?? [])].reverse(),
  };
}
