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
  "transferencias",
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
  transferencias: "Pix e transferências",
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
  "entrada",
  "pagamento_de_fatura",
  "transferencia_propria",
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
  /** Banco ou emissor do documento de onde veio; ausente em gastos escritos. */
  origem?: string | null;
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
export function converter(
  lidos: LancamentoLido[],
  dataPadrao: string,
  origem: string | null = null,
): Lancamento[] {
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
      ...(origem ? { origem } : {}),
    });
  }
  return saida;
}

/**
 * Identifica o mesmo lançamento em dois documentos. Usa só data, valor e
 * sentido (entrou ou saiu): a descrição e o nome do banco mudam de uma leitura
 * para outra do mesmo arquivo, e não servem para comparar.
 */
export function chave(l: Lancamento): string {
  const sentido =
    l.natureza === "entrada"
      ? "entrou"
      : l.natureza === "compra" || l.natureza === "juros" || l.natureza === "iof" || l.natureza === "tarifa_ou_multa"
        ? "saiu"
        : l.natureza;
  return [l.data, l.valor, sentido].join("|");
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
 * Junta os lançamentos de um documento sem duplicar, para o mesmo arquivo
 * enviado duas vezes (ou dois arquivos que cobrem o mesmo período) não contar
 * em dobro. Compara por quantidade: se já existem dois lançamentos iguais e o
 * documento traz três, só o terceiro entra. Devolve só os que entraram.
 */
export function acrescentar(existentes: Lancamento[], novos: Lancamento[]): Lancamento[] {
  const jaExistem = new Map<string, number>();
  for (const l of existentes) jaExistem.set(chave(l), (jaExistem.get(chave(l)) ?? 0) + 1);

  const entraram: Lancamento[] = [];
  for (const n of novos) {
    const sobra = jaExistem.get(chave(n)) ?? 0;
    if (sobra > 0) {
      // Corresponde a um que já estava anotado.
      jaExistem.set(chave(n), sobra - 1);
      continue;
    }
    entraram.push(n);
  }
  existentes.push(...entraram);
  return entraram;
}

/** Data de hoje no fuso de Brasília, em AAAA-MM-DD. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}
