import type { Compra, Fatura, Lancamento } from "./tipos";

export interface Encargos {
  juros: number;
  iof: number;
  tarifas: number;
  total: number;
}

const soma = (l: Lancamento[]) => l.reduce((s, x) => s + x.valor, 0);
export const ehEncargo = (l: Lancamento) => l.tipo === "juros" || l.tipo === "iof" || l.tipo === "tarifa";

/** Juros, IOF e tarifas encontrados nas faturas e extratos. */
export function encargosDasFaturas(faturas: Fatura[]): Encargos {
  const linhas = faturas.flatMap((f) => f.lancamentos);
  const deTipo = (t: Lancamento["tipo"]) => soma(linhas.filter((l) => l.tipo === t));
  const juros = deTipo("juros");
  const iof = deTipo("iof");
  const tarifas = deTipo("tarifa");
  return { juros, iof, tarifas, total: juros + iof + tarifas };
}

export interface CustoEmocional {
  /** Juros e IOF das faturas de cartão. */
  encargos: number;
  totalCompras: number;
  /** Fração (0 a 1) do valor das compras feitas com emoção 1 ou 2. */
  parteTriste: number;
  parteNaoNecessaria: number;
  /** Parte dos encargos atribuída às compras tristes, em centavos. */
  custoTriste: number;
  custoNaoNecessaria: number;
}

/**
 * Quanto dos juros do cartão veio de compras feitas com emoção 1 ou 2.
 * Estimativa proporcional: os encargos são divididos na proporção do valor
 * das compras da fatura. Compras sem registro correspondente contam no total,
 * mas não como tristes.
 */
export function custoEmocional(faturas: Fatura[], compras: Compra[]): CustoEmocional | null {
  const porId = new Map(compras.map((c) => [c.id, c]));
  const cartoes = faturas.filter((f) => f.tipo === "fatura");
  const linhas = cartoes.flatMap((f) => f.lancamentos);
  const encargos = soma(linhas.filter((l) => l.tipo === "juros" || l.tipo === "iof"));
  const comprasDaFatura = linhas.filter((l) => l.tipo === "compra");
  const totalCompras = soma(comprasDaFatura);
  if (!encargos || !totalCompras) return null;

  const registrada = (l: Lancamento) => (l.compraId ? porId.get(l.compraId) : undefined);
  const triste = soma(comprasDaFatura.filter((l) => (registrada(l)?.emocao ?? 5) <= 2));
  const naoNecessaria = soma(comprasDaFatura.filter((l) => registrada(l)?.necessidade === "nao"));

  return {
    encargos,
    totalCompras,
    parteTriste: triste / totalCompras,
    parteNaoNecessaria: naoNecessaria / totalCompras,
    custoTriste: Math.round((encargos * triste) / totalCompras),
    custoNaoNecessaria: Math.round((encargos * naoNecessaria) / totalCompras),
  };
}

export interface FaturaSeparada {
  encargos: Lancamento[];
  totalEncargos: number;
  /** Compras que a pessoa já tinha registrado no app ou no WhatsApp. */
  jaRegistradas: Lancamento[];
  /** Compras que ainda precisam de emoção e necessidade. */
  novas: Lancamento[];
  assinaturas: Lancamento[];
}

/** Organiza os lançamentos de uma fatura lida para mostrar o resultado. */
export function separarFatura(fatura: Fatura): FaturaSeparada {
  const l = fatura.lancamentos;
  const encargos = l.filter(ehEncargo);
  return {
    encargos,
    totalEncargos: soma(encargos),
    jaRegistradas: l.filter((x) => x.tipo === "compra" && x.compraId),
    novas: l.filter((x) => x.tipo === "compra" && !x.compraId),
    assinaturas: l.filter((x) => x.tipo === "assinatura"),
  };
}
