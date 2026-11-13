import { lerValorEmReais } from "@/lib/dinheiro";
import { type Categoria, type Lancamento, NOME_DA_CATEGORIA } from "./lancamentos";

/**
 * O mês contado de cabeça: as despesas que a pessoa diz ter todo mês, sem
 * mandar extrato nem fatura. Aqui fica também a comparação com o que ela vai
 * anotando: previsto contra realizado.
 */

/** "cartao" é a fatura inteira: recebe os gastos que não têm item próprio. */
export type GrupoDoPlano = Categoria | "cartao";

export interface ItemDoPlano {
  descricao: string;
  /** Centavos por mês. */
  valor: number;
  grupo: GrupoDoPlano;
}

export interface Plano {
  itens: ItemDoPlano[];
}

/** Despesa mensal como o modelo transcreve: valor ainda em texto. */
export interface DespesaLida {
  descricao: string;
  valor: string;
  categoria: GrupoDoPlano;
}

export const NOME_DO_CARTAO = "Cartão e demais gastos";

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/**
 * Guarda as despesas mensais informadas. A mesma descrição substitui o valor
 * anterior; valor zero tira o item. Devolve o que entrou e o que saiu.
 */
export function informar(
  plano: Plano | undefined,
  lidas: DespesaLida[],
): { plano: Plano; anotados: ItemDoPlano[]; removidos: string[] } {
  const itens = [...(plano?.itens ?? [])];
  const anotados: ItemDoPlano[] = [];
  const removidos: string[] = [];

  for (const lida of lidas) {
    const limpa = lida.descricao.trim().slice(0, 60);
    const descricao = limpa.charAt(0).toUpperCase() + limpa.slice(1);
    const valor = lerValorEmReais(lida.valor);
    if (!descricao || valor === null) continue;
    const posicao = itens.findIndex((i) => semAcento(i.descricao) === semAcento(descricao));
    if (valor === 0) {
      if (posicao >= 0) removidos.push(itens.splice(posicao, 1)[0].descricao);
      continue;
    }
    const item: ItemDoPlano = { descricao, valor, grupo: lida.categoria };
    if (posicao >= 0) itens[posicao] = item;
    else itens.push(item);
    anotados.push(item);
  }
  return { plano: { itens }, anotados, removidos };
}

export interface LinhaDoPlano {
  grupo: GrupoDoPlano;
  nome: string;
  itens: ItemDoPlano[];
  previsto: number;
  /** O que já está anotado no mês para este grupo. */
  realizado: number;
  /** O maior entre o previsto e o realizado: é o que deve sair no mês. */
  esperado: number;
}

export interface Acompanhamento {
  linhas: LinhaDoPlano[];
  previsto: number;
  /** Gastos anotados em categorias sem previsão, quando não há item de cartão. */
  foraDoPlano: number;
  /** Juros, IOF e tarifas anotados no mês. */
  encargos: number;
  /** Quanto deve sair no mês, somando tudo. */
  esperado: number;
}

/**
 * Compara o plano com os lançamentos de um mês. Em cada grupo vale o maior
 * entre o previsto e o que já foi anotado: assim a fatura ou o gasto real
 * substitui a estimativa em vez de somar com ela.
 */
export function acompanhar(plano: Plano | undefined, doMes: Lancamento[]): Acompanhamento | null {
  if (!plano || plano.itens.length === 0) return null;

  const gastoPorCategoria = new Map<Categoria, number>();
  let encargos = 0;
  for (const l of doMes) {
    if (l.natureza === "compra") gastoPorCategoria.set(l.categoria, (gastoPorCategoria.get(l.categoria) ?? 0) + l.valor);
    else if (l.natureza === "juros" || l.natureza === "iof" || l.natureza === "tarifa_ou_multa") encargos += l.valor;
  }

  const grupos = new Map<GrupoDoPlano, ItemDoPlano[]>();
  for (const item of plano.itens) grupos.set(item.grupo, [...(grupos.get(item.grupo) ?? []), item]);

  let semPrevisao = 0;
  for (const [categoria, valor] of gastoPorCategoria) if (!grupos.has(categoria)) semPrevisao += valor;

  const linhas: LinhaDoPlano[] = [...grupos].map(([grupo, itens]) => {
    const previsto = itens.reduce((s, i) => s + i.valor, 0);
    const realizado = grupo === "cartao" ? semPrevisao : (gastoPorCategoria.get(grupo) ?? 0);
    return {
      grupo,
      nome: grupo === "cartao" ? NOME_DO_CARTAO : NOME_DA_CATEGORIA[grupo],
      itens,
      previsto,
      realizado,
      esperado: Math.max(previsto, realizado),
    };
  });

  const foraDoPlano = grupos.has("cartao") ? 0 : semPrevisao;
  return {
    linhas,
    previsto: linhas.reduce((s, l) => s + l.previsto, 0),
    foraDoPlano,
    encargos,
    esperado: linhas.reduce((s, l) => s + l.esperado, 0) + foraDoPlano + encargos,
  };
}
