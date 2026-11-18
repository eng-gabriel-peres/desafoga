import { diaDe, horaDe, ultimosDias } from "./datas";
import { comEmocao, notaMedia, somaDosValores } from "./emocao";
import type { Compra, Necessidade } from "./tipos";

interface Proporcao {
  total: number;
  /** Quantas de cada 10 compras não eram necessárias (arredondado). */
  deCada10: number;
}

export interface Padroes {
  /** Compras com emoção 1 ou 2. */
  tristes: Proporcao | null;
  /** Compras com emoção 4 ou 5. */
  felizes: Proporcao | null;
  /** Gasto médio por dia nos dias com nota abaixo de 3 (últimos 30 dias). */
  gastoMedioDiasBaixos: number | null;
  gastoMedioDiasBons: number | null;
  /** Compras entre 21h e 5h. */
  noite: { total: number; naoNecessarias: number };
}

function proporcao(compras: Compra[]): Proporcao | null {
  if (!compras.length) return null;
  const nao = compras.filter((c) => c.necessidade === "nao").length;
  return { total: compras.length, deCada10: Math.round((nao / compras.length) * 10) };
}

const media = (l: number[]) => (l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : null);

/** Padrões entre emoção, horário e necessidade, para mostrar em linguagem simples. */
export function padroesDeCompra(todas: Compra[], hoje: Date): Padroes {
  const compras = comEmocao(todas);
  const dias = ultimosDias(hoje, 30)
    .map((chave) => compras.filter((c) => diaDe(c.quando) === chave))
    .filter((l) => l.length);
  const baixos = dias.filter((l) => (notaMedia(l) ?? 0) < 3);
  const bons = dias.filter((l) => (notaMedia(l) ?? 0) >= 3);
  const noite = compras.filter((c) => {
    const h = horaDe(c.quando);
    return h >= 21 || h < 5;
  });

  return {
    tristes: proporcao(compras.filter((c) => c.emocao <= 2)),
    felizes: proporcao(compras.filter((c) => c.emocao >= 4)),
    gastoMedioDiasBaixos: baixos.length && bons.length ? media(baixos.map(somaDosValores)) : null,
    gastoMedioDiasBons: baixos.length && bons.length ? media(bons.map(somaDosValores)) : null,
    noite: { total: noite.length, naoNecessarias: noite.filter((c) => c.necessidade === "nao").length },
  };
}

/** Quanto foi gasto em compras necessárias, não necessárias e "não sei". */
export function divisaoPorNecessidade(compras: Compra[]): Record<Necessidade, number> {
  const soma = (n: Necessidade) => somaDosValores(compras.filter((c) => c.necessidade === n));
  return { sim: soma("sim"), nao: soma("nao"), talvez: soma("talvez") };
}

export interface CompraPorHorario {
  nome: string;
  faixa: string;
  total: number;
  naoNecessarias: number;
  /** Média das emoções das compras do horário; null sem compras. */
  nota: number | null;
}

const HORARIOS: [string, string, (h: number) => boolean][] = [
  ["Manhã", "6h às 12h", (h) => h >= 6 && h < 12],
  ["Tarde", "12h às 18h", (h) => h >= 12 && h < 18],
  ["Noite", "18h às 22h", (h) => h >= 18 && h < 22],
  ["Madrugada", "22h às 6h", (h) => h >= 22 || h < 6],
];

/** Em que horário a pessoa compra: quantas, como estava e quantas não eram necessárias. */
export function comprasPorHorario(compras: Compra[]): CompraPorHorario[] {
  return HORARIOS.map(([nome, faixa, dentro]) => {
    const l = compras.filter((c) => dentro(horaDe(c.quando)));
    return { nome, faixa, total: l.length, naoNecessarias: l.filter((c) => c.necessidade === "nao").length, nota: notaMedia(l) };
  });
}
