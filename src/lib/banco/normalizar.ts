/**
 * Converte contas e transações da Pluggy para o formato do Desafoga.
 * A Pluggy não é coerente no sinal (no sandbox, compra no cartão vem como
 * crédito negativo), então a direção sai do tipo da conta e da descrição.
 */
import type { PluggyConta, PluggyTransacao } from "./pluggy";
import type { CandidataParcelada, ContaBancaria, MovimentoNovo, TipoDeContaBancaria } from "./tipos";

const centavos = (v: number | null | undefined): number | null => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(Math.abs(v) * 100));

/** YYYY-MM-DD em Brasília. Datas "só dia" da Pluggy (00:00Z ou 03:00Z exatos) valem pelo dia escrito. */
export function diaEmBrasilia(d: Date | string): string {
  const iso = new Date(d).toISOString();
  if (/T0[03]:00:00\.000Z$/.test(iso)) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(d));
}

/** Datas "só dia" da Pluggy (00:00Z ou 03:00Z) representam o dia, não um instante. */
const diaDeData = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString().slice(0, 10) : null);

export function tipoDaConta(a: Pick<PluggyConta, "type" | "subtype">): TipoDeContaBancaria {
  if (a.type === "CREDIT") return "cartao";
  return a.subtype === "SAVINGS_ACCOUNT" ? "poupanca" : "corrente";
}

export function normalizarConta(a: PluggyConta): Omit<ContaBancaria, "id" | "conexaoId"> {
  const tipo = tipoDaConta(a);
  const credito = a.creditData;
  const banco = a.bankData;
  return {
    pluggyAccountId: a.id,
    tipo,
    nome: a.marketingName || a.name,
    saldo: centavos(tipo === "cartao" ? a.balance : (banco?.closingBalance ?? a.balance)) ?? 0,
    limite: centavos(credito?.creditLimit),
    limiteDisponivel: centavos(credito?.availableCreditLimit),
    fechamento: diaDeData(credito?.balanceCloseDate),
    vencimento: diaDeData(credito?.balanceDueDate),
    chequeEspecialUsado: centavos(banco?.overdraftUsedLimit),
    chequeEspecialLimite: centavos(banco?.overdraftContractedLimit),
  };
}

const ENTRADA_NO_CARTAO = /PAGAMENTO|PGTO|ESTORNO|REEMBOLSO|CREDITO DE/i;

function documento(d: { value?: string | null } | null | undefined): string | null {
  const digitos = d?.value?.replace(/\D/g, "") ?? "";
  return digitos.length === 11 || digitos.length === 14 ? digitos : null;
}

export function normalizarTransacao(t: PluggyTransacao, tipo: TipoDeContaBancaria): MovimentoNovo {
  const direcao: MovimentoNovo["direcao"] =
    tipo === "cartao" ? (ENTRADA_NO_CARTAO.test(t.description) ? "entrada" : "saida") : t.type === "DEBIT" ? "saida" : "entrada";
  const cartao = t.creditCardMetadata;
  const pagamento = t.paymentData;
  const outroLado = direcao === "saida" ? pagamento?.receiver : pagamento?.payer;
  const boleto = pagamento?.boletoMetadata;
  const juros = boleto ? (boleto.interestAmount ?? 0) + (boleto.penaltyAmount ?? 0) : 0;
  const compradaEm = cartao?.purchaseDate ?? (cartao as { transactionDateTime?: string } | null)?.transactionDateTime ?? null;
  return {
    pluggyId: t.id,
    contaId: t.accountId,
    data: diaEmBrasilia(t.date),
    descricao: t.description.trim(),
    descricaoOriginal: (t.descriptionRaw ?? t.description).trim(),
    valor: centavos(t.amount) ?? 0,
    direcao,
    categoriaPluggy: t.category ?? null,
    parcela: cartao?.installmentNumber ?? null,
    totalParcelas: cartao?.totalInstallments ?? null,
    valorTotalDaCompra: cartao?.totalInstallments ? centavos(cartao.totalAmount) : null,
    compradaEm: compradaEm ? diaDeData(compradaEm) : null,
    faturaPrevista: (cartao as { billForecastDate?: string } | null)?.billForecastDate?.slice(0, 7) ?? null,
    cnpj: documento(t.merchant?.cnpj ? { value: t.merchant.cnpj } : null),
    mcc: cartao?.payeeMCC ?? null,
    documentoContraparte: documento(outroLado?.documentNumber),
    jurosBoleto: juros > 0 ? Math.round(juros * 100) : null,
    pendente: t.status === "PENDING",
  };
}

export function candidataDoMovimento(m: MovimentoNovo): CandidataParcelada | null {
  if (!m.parcela || !m.totalParcelas || m.totalParcelas < 2) return null;
  return {
    origem: m.contaId,
    descricao: m.descricao,
    valorParcela: m.valor,
    totalParcelas: m.totalParcelas,
    parcelaAtual: m.parcela,
    mesDaParcela: m.data.slice(0, 7),
    valorTotal: m.valorTotalDaCompra,
    compradaEm: m.compradaEm,
  };
}
