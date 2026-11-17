/**
 * Banco de demonstração da Ana (sem Pluggy): o que a Pluggy traria de um
 * Itaú de verdade, com dados coerentes. O consignado que aparece nas parcelas
 * do extrato é o mesmo do Registrato de exemplo, para a demo mostrar a junção.
 */
import type { Categoria } from "@/lib/finance";
import type { Natureza, SituacaoDoMovimento, SugestaoDeDivida } from "@/lib/banco/tipos";

export type ContaDaDemo = "corrente" | "cartao";

export interface SementeMovimento {
  id: string;
  conta: ContaDaDemo;
  /** Dias atrás. */
  dias: number;
  descricao: string;
  /** Centavos. */
  valor: number;
  direcao: "saida" | "entrada";
  natureza: Natureza;
  categoria?: Categoria;
  situacao: SituacaoDoMovimento;
  /** Parcela da compra parcelada da semente. */
  parcela?: number;
  jurosBoleto?: number;
}

export interface SementeBanco {
  banco: string;
  contas: {
    id: ContaDaDemo;
    nome: string;
    saldo: number;
    limite?: number;
    limiteDisponivel?: number;
    /** Dia do mês do fechamento e do vencimento da fatura (cartão). */
    fechamentoDia?: number;
    vencimentoDia?: number;
    chequeEspecialUsado?: number;
    chequeEspecialLimite?: number;
  }[];
  /** Autorização do Open Finance vence em N dias. */
  consentimentoEmDias: number;
  /** Investimento ligado a uma meta da semente (pelo nome). */
  investimento: { nome: string; tipo: string; saldo: number; meta: string };
  movimentos: SementeMovimento[];
  parcelada: { nome: string; lojaOriginal: string; categoria: Categoria; valorParcela: number; totalParcelas: number; parcelasVistas: number[]; primeiraHaMeses: number };
  sugestoes: SugestaoDeDivida[];
}

const assinatura = (id: string, descricao: string, valor: number): SementeMovimento[] =>
  [3, 33, 63].map((dias, i) => ({ id: `${id}-${i}`, conta: "cartao", dias, descricao, valor, direcao: "saida", natureza: "compra", categoria: "Lazer", situacao: "historico" }));

export const BANCO_DA_ANA: SementeBanco = {
  banco: "Itaú · demonstração",
  contas: [
    { id: "corrente", nome: "Conta corrente", saldo: 31240, chequeEspecialUsado: 35000, chequeEspecialLimite: 100000 },
    { id: "cartao", nome: "Cartão Itaú", saldo: 255000, limite: 300000, limiteDisponivel: 45000, fechamentoDia: 3, vencimentoDia: 10 },
  ],
  consentimentoEmDias: 10,
  investimento: { nome: "CDB Viagem", tipo: "FIXED_INCOME", saldo: 42000, meta: "Viagem para a praia" },
  movimentos: [
    // Para revisar (desta semana).
    { id: "ifood", conta: "cartao", dias: 0, descricao: "IFOOD *SABOR DA CASA", valor: 4590, direcao: "saida", natureza: "compra", categoria: "Comida pronta", situacao: "revisar" },
    { id: "pao", conta: "corrente", dias: 1, descricao: "PAO DE ACUCAR 118", valor: 13200, direcao: "saida", natureza: "compra", categoria: "Mercado", situacao: "revisar" },
    { id: "shopee", conta: "cartao", dias: 1, descricao: "SHOPEE *LOJA OFICIAL", valor: 8990, direcao: "saida", natureza: "compra", categoria: "Outro", situacao: "revisar" },
    // Compra parcelada (as parcelas vistas até agora).
    { id: "ml-1", conta: "cartao", dias: 62, descricao: "MERCADOLIVRE*CELULAR 01/10", valor: 48000, direcao: "saida", natureza: "compra", categoria: "Outro", situacao: "historico", parcela: 1 },
    { id: "ml-2", conta: "cartao", dias: 32, descricao: "MERCADOLIVRE*CELULAR 02/10", valor: 48000, direcao: "saida", natureza: "compra", categoria: "Outro", situacao: "historico", parcela: 2 },
    { id: "ml-3", conta: "cartao", dias: 9, descricao: "MERCADOLIVRE*CELULAR 03/10", valor: 48000, direcao: "saida", natureza: "compra", categoria: "Outro", situacao: "historico", parcela: 3 },
    // Transferência para a própria conta no PicPay: não é gasto.
    { id: "pix-picpay", conta: "corrente", dias: 6, descricao: "PIX ENVIADO ANA SOUZA PICPAY", valor: 20000, direcao: "saida", natureza: "transferencia-propria", situacao: "ignorada" },
    // Salário.
    { id: "salario-0", conta: "corrente", dias: 12, descricao: "SALARIO LOJAS EXEMPLO", valor: 280000, direcao: "entrada", natureza: "renda", situacao: "historico" },
    { id: "salario-1", conta: "corrente", dias: 43, descricao: "SALARIO LOJAS EXEMPLO", valor: 280000, direcao: "entrada", natureza: "renda", situacao: "historico" },
    { id: "salario-2", conta: "corrente", dias: 73, descricao: "SALARIO LOJAS EXEMPLO", valor: 280000, direcao: "entrada", natureza: "renda", situacao: "historico" },
    // Assinaturas.
    ...assinatura("netflix", "NETFLIX.COM", 5590),
    ...assinatura("spotify", "SPOTIFY AB", 2190),
    ...assinatura("smartfit", "SMART FIT ACADEMIA", 8990),
    // Tarifa, boleto pago com atraso e as parcelas do consignado.
    { id: "tarifa", conta: "corrente", dias: 16, descricao: "TARIFA PACOTE SERVICOS", valor: 3990, direcao: "saida", natureza: "tarifa", situacao: "historico" },
    { id: "boleto", conta: "corrente", dias: 8, descricao: "PAGAMENTO BOLETO ENEL", valor: 15240, direcao: "saida", natureza: "outra-saida", situacao: "historico", jurosBoleto: 1240 },
    { id: "consig-0", conta: "corrente", dias: 70, descricao: "PARC EMPREST 05/24", valor: 61000, direcao: "saida", natureza: "parcela-emprestimo", situacao: "historico" },
    { id: "consig-1", conta: "corrente", dias: 40, descricao: "PARC EMPREST 06/24", valor: 61000, direcao: "saida", natureza: "parcela-emprestimo", situacao: "historico" },
    { id: "consig-2", conta: "corrente", dias: 10, descricao: "PARC EMPREST 07/24", valor: 61000, direcao: "saida", natureza: "parcela-emprestimo", situacao: "historico" },
  ],
  parcelada: {
    nome: "MERCADOLIVRE*CELULAR",
    lojaOriginal: "MERCADOLIVRE*CELULAR",
    categoria: "Outro",
    valorParcela: 48000,
    totalParcelas: 10,
    parcelasVistas: [1, 2, 3],
    primeiraHaMeses: 2,
  },
  sugestoes: [
    {
      chave: "itau|emprestimo|61000",
      fonte: "extrato",
      pluggyLoanId: null,
      tipo: "emprestimo",
      nome: "Consignado · Itaú",
      instituicao: "Itaú",
      detalhe: "Consignado",
      saldo: 1037000,
      vencido: null,
      taxaMensal: null,
      parcelaMinima: 61000,
      vencimento: 7,
      parcelasRestantes: 17,
      cet: null,
      temSeguro: null,
      faltaPagarComJuros: 1037000,
      confira: ["saldo", "taxaMensal"],
    },
    {
      chave: "itau|cheque",
      fonte: "pluggy",
      pluggyLoanId: null,
      tipo: "cheque",
      nome: "Cheque especial · Itaú",
      instituicao: "Itaú",
      detalhe: "Conta corrente",
      saldo: 35000,
      vencido: null,
      taxaMensal: null,
      parcelaMinima: 0,
      vencimento: null,
      parcelasRestantes: null,
      cet: null,
      temSeguro: null,
      faltaPagarComJuros: null,
      confira: ["taxaMensal"],
    },
  ],
};
