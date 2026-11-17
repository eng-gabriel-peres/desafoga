/**
 * Tipos dos bancos conectados e das fontes externas (Pluggy e documentos).
 * Podem ser importados no navegador: nada aqui depende da Pluggy.
 */
import type { Categoria, TipoDivida } from "@/lib/finance";

export type ModoCompras = "revisar" | "automatico" | "desligado";
export type TipoDeContaBancaria = "corrente" | "poupanca" | "cartao";
export type Natureza =
  | "compra"
  | "transferencia-propria"
  | "pagamento-fatura"
  | "parcela-emprestimo"
  | "renda"
  | "tarifa"
  | "juros"
  | "iof"
  | "estorno"
  | "outra-entrada"
  | "outra-saida";
export type SituacaoDoMovimento = "revisar" | "registrada" | "ignorada" | "historico" | "automatica";
export type StatusDaConexao = "ok" | "atualizando" | "reconectar" | "erro";

/** De onde veio a informação de uma dívida, da mais para a menos confiável. */
export type FonteDaDivida = "pluggy" | "contrato" | "registrato" | "fatura" | "extrato";
export const CONFIANCA: Record<FonteDaDivida, number> = { pluggy: 4, contrato: 3, registrato: 2, fatura: 1, extrato: 1 };

export interface ContaBancaria {
  id: string;
  conexaoId: string;
  pluggyAccountId: string;
  tipo: TipoDeContaBancaria;
  nome: string;
  /** Centavos; no cartão, o quanto está usado. */
  saldo: number;
  limite: number | null;
  limiteDisponivel: number | null;
  /** YYYY-MM-DD do fechamento da fatura (cartão). */
  fechamento: string | null;
  /** YYYY-MM-DD do vencimento da fatura (cartão). */
  vencimento: string | null;
  chequeEspecialUsado: number | null;
  chequeEspecialLimite: number | null;
}

export interface ConexaoBancaria {
  id: string;
  /** null = "Banco Demonstração", sem Pluggy. */
  pluggyItemId: string | null;
  banco: string;
  logo: string | null;
  status: StatusDaConexao;
  ultimaSincronizacao: string | null;
  proximaAtualizacaoPossivel: string | null;
  consentimentoAte: string | null;
  conectadaEm: string;
  contas: ContaBancaria[];
}

export interface MovimentoNovo {
  pluggyId: string;
  contaId: string;
  /** YYYY-MM-DD em Brasília. */
  data: string;
  descricao: string;
  descricaoOriginal: string;
  /** Centavos, sempre positivo. */
  valor: number;
  direcao: "saida" | "entrada";
  categoriaPluggy: string | null;
  parcela: number | null;
  totalParcelas: number | null;
  valorTotalDaCompra: number | null;
  compradaEm: string | null;
  /** YYYY-MM da fatura em que deve cair (cartão). */
  faturaPrevista: string | null;
  cnpj: string | null;
  mcc: number | null;
  /** CPF ou CNPJ (só dígitos) de quem recebeu (saída) ou pagou (entrada). */
  documentoContraparte: string | null;
  /** Juros e multa pagos num boleto atrasado (centavos). */
  jurosBoleto: number | null;
  pendente: boolean;
}

export interface Movimento extends MovimentoNovo {
  id: string;
  natureza: Natureza;
  categoria: Categoria | null;
  situacao: SituacaoDoMovimento;
  compraId: string | null;
  parceladaId: string | null;
}

/**
 * Uma compra parcelada vista no banco ou num documento. `origem`: id da conta
 * na Pluggy, ou "doc:" + instituição quando o PDF não foi ligado a um cartão
 * conectado.
 */
export interface CandidataParcelada {
  origem: string;
  descricao: string;
  valorParcela: number;
  totalParcelas: number;
  parcelaAtual: number;
  /** YYYY-MM em que a parcelaAtual caiu. */
  mesDaParcela: string;
  valorTotal: number | null;
  compradaEm: string | null;
}

export interface CompraParcelada {
  id: string;
  chave: string;
  origem: string;
  fonte: "pluggy" | "documento";
  nome: string;
  lojaOriginal: string;
  categoria: Categoria;
  valorTotal: number;
  valorParcela: number;
  totalParcelas: number;
  /** YYYY-MM da primeira parcela. */
  mesDaPrimeira: string;
  compradaEm: string;
  compradaEmEstimada: boolean;
  compraId: string | null;
  parcelasVistas: number[];
}

export type CampoDaDivida = "saldo" | "taxaMensal" | "parcelaMinima" | "parcelasRestantes";

export interface SugestaoDeDivida {
  chave: string;
  fonte: FonteDaDivida;
  pluggyLoanId: string | null;
  tipo: TipoDivida;
  nome: string;
  instituicao: string;
  detalhe: string;
  /** Saldo devedor sem juros futuros (centavos). */
  saldo: number;
  /** Parte já vencida e não paga (Registrato). */
  vencido: number | null;
  taxaMensal: number | null;
  parcelaMinima: number;
  /** Dia do mês. */
  vencimento: number | null;
  parcelasRestantes: number | null;
  /** Custo efetivo total ao ano. */
  cet: number | null;
  temSeguro: boolean | null;
  /** Soma das parcelas que faltam, com juros. */
  faltaPagarComJuros: number | null;
  /** Campos que vieram faltando ou absurdos: a pessoa confere antes de usar. */
  confira: CampoDaDivida[];
}
