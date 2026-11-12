import { lerValorEmReais } from "@/lib/dinheiro";

export const CATEGORIAS = [
  "mercado",
  "alimentacao",
  "transporte",
  "moradia_e_contas",
  "saude",
  "educacao",
  "lazer",
  "compras",
  "assinaturas",
  "outros",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const NOME_DA_CATEGORIA: Record<Categoria, string> = {
  mercado: "Mercado",
  alimentacao: "Restaurantes e delivery",
  transporte: "Transporte",
  moradia_e_contas: "Casa e contas fixas",
  saude: "Saúde",
  educacao: "Educação",
  lazer: "Lazer",
  compras: "Compras e bens de consumo",
  assinaturas: "Assinaturas",
  outros: "Outros",
};

/** Categorias em que normalmente dá para cortar sem mexer no essencial. */
export const AJUSTAVEIS: Categoria[] = ["alimentacao", "lazer", "compras", "assinaturas"];

export const NATUREZAS = [
  "compra",
  "juros",
  "iof",
  "tarifa_ou_multa",
  "pagamento_ou_credito",
  "saldo_anterior",
] as const;
export type Natureza = (typeof NATUREZAS)[number];

export interface Lancamento {
  /** AAAA-MM-DD */
  data: string;
  descricao: string;
  /** Centavos, sempre positivo. */
  valor: number;
  natureza: Natureza;
  categoria: Categoria;
  /** "03/06" quando é parcela. */
  parcela: string | null;
}

/** Lançamento como o modelo transcreve: valor e data ainda em texto. */
export interface LancamentoLido {
  data: string | null;
  descricao: string;
  valor: string;
  natureza: Natureza;
  categoria: Categoria;
  parcela: string | null;
}

/** Converte o que o modelo transcreveu; descarta o que não tem valor legível. */
export function converter(lidos: LancamentoLido[], dataPadrao: string): Lancamento[] {
  const saida: Lancamento[] = [];
  for (const l of lidos) {
    const valor = lerValorEmReais(l.valor);
    if (!valor) continue;
    saida.push({
      data: l.data && /^\d{4}-\d{2}-\d{2}$/.test(l.data) ? l.data : dataPadrao,
      descricao: l.descricao.trim().slice(0, 120),
      valor,
      natureza: l.natureza,
      categoria: l.categoria,
      parcela: l.parcela,
    });
  }
  return saida;
}

/** Identifica o mesmo lançamento enviado duas vezes (fatura reenviada, print repetido). */
export function chave(l: Lancamento): string {
  return [l.data, l.descricao.toLowerCase(), l.valor, l.parcela ?? ""].join("|");
}

/**
 * Junta gastos que a pessoa escreveu. Não descarta repetidos: dois cafés do
 * mesmo valor no mesmo dia são dois gastos.
 */
export function anotar(existentes: Lancamento[], novos: Lancamento[]): Lancamento[] {
  existentes.push(...novos);
  return novos;
}

/**
 * Junta os lançamentos de um documento sem duplicar, para a mesma fatura
 * enviada duas vezes não contar em dobro. Devolve só os que entraram.
 */
export function acrescentar(existentes: Lancamento[], novos: Lancamento[]): Lancamento[] {
  const vistos = new Set(existentes.map(chave));
  const entraram: Lancamento[] = [];
  for (const n of novos) {
    if (vistos.has(chave(n))) continue;
    vistos.add(chave(n));
    existentes.push(n);
    entraram.push(n);
  }
  return entraram;
}

/** Data de hoje no fuso de Brasília, em AAAA-MM-DD. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}
