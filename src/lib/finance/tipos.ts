/**
 * Tipos do motor financeiro do Desafoga.
 *
 * Regra do projeto: a IA lê, o código calcula. Valores em centavos (inteiros)
 * e taxas como fração ao mês (0.142 = 14,2% a.m.).
 */

/** Como a pessoa estava na hora da compra: 1 muito triste … 5 muito feliz. */
export type Emocao = 1 | 2 | 3 | 4 | 5;

/** Se a compra era necessária, na opinião de quem comprou (ou do profissional). */
export type Necessidade = "sim" | "nao" | "talvez";

export type Categoria =
  | "Mercado"
  | "Roupa"
  | "Comida pronta"
  | "Farmácia"
  | "Casa"
  | "Lazer"
  | "Presente"
  | "Outro";

export interface Compra {
  id: string;
  item: string;
  categoria: Categoria;
  /** Centavos. */
  valor: number;
  emocao: Emocao;
  necessidade: Necessidade;
  /** Data e hora em ISO 8601. */
  quando: string;
  via: "app" | "whatsapp" | "fatura";
  /** Opinião do profissional sobre a necessidade; null enquanto não avaliou. */
  avaliacaoProfissional: Necessidade | null;
}

export type TipoDivida =
  | "cartao"
  | "cheque"
  | "emprestimo"
  | "parcelamento"
  | "outra";

export interface Divida {
  id: string;
  tipo: TipoDivida;
  nome: string;
  detalhe: string;
  /** Saldo devedor em centavos. */
  saldo: number;
  /** Juros ao mês em fração: 0.142 = 14,2% a.m. */
  taxaMensal: number;
  /** Parcela mínima mensal em centavos. */
  parcelaMinima: number;
  /** Dia do mês em que vence. */
  vencimento: number;
}

/** "mais-cara": maior taxa primeiro (avalanche). "menor": menor saldo primeiro (bola de neve). */
export type Estrategia = "mais-cara" | "menor";

export type TipoLancamento =
  | "compra"
  | "juros"
  | "iof"
  | "tarifa"
  | "assinatura"
  | "pagamento";

export interface Lancamento {
  id: string;
  /** YYYY-MM-DD */
  data: string;
  descricao: string;
  /** Centavos, sempre positivo. */
  valor: number;
  tipo: TipoLancamento;
  categoria?: Categoria;
  /** Compra registrada pela pessoa que corresponde a este lançamento. */
  compraId?: string | null;
}

export interface Fatura {
  id: string;
  tipo: "fatura" | "extrato";
  /** Ex.: "Cartão final 4417". */
  origem: string;
  /** YYYY-MM */
  mes: string;
  lancamentos: Lancamento[];
}

/** Quanto a pessoa se permite gastar por mês numa categoria. */
export interface Orcamento {
  categoria: Categoria;
  /** Centavos por mês. */
  limite: number;
}

export type IconeDaMeta = "piggy-bank" | "shield" | "plane" | "home" | "car" | "graduation-cap" | "gift" | "smartphone" | "heart";
export type CorDaMeta = "azul" | "amarelo" | "coral" | "violeta" | "petroleo";
/** De quanto em quanto tempo a pessoa guarda. */
export type Frequencia = "dia" | "semana" | "mes";

/** Meta de economia: viagem, reserva de emergência, o "cofrinho". */
export interface Meta {
  id: string;
  nome: string;
  icone: IconeDaMeta;
  cor: CorDaMeta;
  /** Centavos. */
  alvo: number;
  /** Quanto já tinha guardado ao criar (centavos); entra como primeiro depósito. */
  inicial: number;
  /** "prazo": a pessoa escolheu uma data; "valor": escolheu quanto guardar. */
  modo: "prazo" | "valor";
  frequencia: Frequencia;
  /** Quanto guardar a cada período, em centavos. */
  valorPorPeriodo: number;
  /** YYYY-MM-DD, ou null sem data. */
  prazo: string | null;
  /** YYYY-MM-DD */
  criadaEm: string;
  /** Lembrar no WhatsApp nos dias de guardar. */
  lembrete: boolean;
  depositos: Deposito[];
}

/** Dinheiro guardado na meta. A transferência para o cofrinho é registrada uma vez só e já conta. */
export interface Deposito {
  id: string;
  /** Centavos, sempre positivo. */
  valor: number;
  descricao: string;
  /** Data e hora em ISO 8601. */
  quando: string;
  via: "app" | "whatsapp";
}
