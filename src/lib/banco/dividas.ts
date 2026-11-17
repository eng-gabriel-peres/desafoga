/**
 * Dívidas que vêm de fora (Pluggy, contrato, Registrato, fatura, extrato):
 * montar a sugestão, barrar números absurdos e juntar a mesma dívida vinda
 * de fontes diferentes, deixando a fonte mais confiável falar mais alto.
 */
import type { TipoDivida } from "@/lib/finance";
import { chaveDaInstituicao } from "./instituicoes";
import type { PluggyEmprestimo } from "./pluggy";
import { CONFIANCA, type CampoDaDivida, type ContaBancaria, type SugestaoDeDivida } from "./tipos";

export const TRAVAS = { taxaMensalMax: 0.3, parcelasMax: 480 } as const;

export function taxaMensalDe(r: { valor: number; periodicidade: "MONTHLY" | "YEARLY" }): number {
  return r.periodicidade === "YEARLY" ? Math.pow(1 + r.valor, 1 / 12) - 1 : r.valor;
}

const centavos = (v: number | null | undefined): number | null => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 100));
const semRepetir = (l: CampoDaDivida[]) => [...new Set(l)];

/** Campos novos na API da Pluggy que o SDK ainda não tipa. */
type EmprestimoCompleto = PluggyEmprestimo & {
  totalRemainingAmount?: number | null;
  nextInstallmentAmount?: number | null;
  hasInsuranceContracted?: boolean | null;
};

export function aplicarTravas(s: SugestaoDeDivida): SugestaoDeDivida {
  const r: SugestaoDeDivida = { ...s, confira: [...s.confira] };
  if (r.saldo < 0) {
    r.saldo = 0;
    r.confira.push("saldo");
  }
  if (r.taxaMensal !== null && (r.taxaMensal < 0 || r.taxaMensal > TRAVAS.taxaMensalMax)) r.taxaMensal = null;
  if (r.taxaMensal === null && r.tipo !== "outra") r.confira.push("taxaMensal");
  if (r.parcelasRestantes !== null && (r.parcelasRestantes <= 0 || r.parcelasRestantes > TRAVAS.parcelasMax || !Number.isInteger(r.parcelasRestantes))) {
    r.parcelasRestantes = null;
    r.confira.push("parcelasRestantes");
  }
  if (r.parcelaMinima < 0 || (r.saldo > 0 && r.parcelaMinima > r.saldo * 2)) {
    r.parcelaMinima = 0;
    r.confira.push("parcelaMinima");
  }
  r.confira = semRepetir(r.confira);
  return r;
}

/** Valor presente de n parcelas iguais à taxa i (saldo devedor sem os juros futuros). */
const valorPresente = (parcela: number, n: number, i: number) => (i > 0 ? Math.round((parcela * (1 - Math.pow(1 + i, -n))) / i) : parcela * n);

const mesesAte = (data: Date | string, hoje: Date) => {
  const d = new Date(data);
  return (d.getUTCFullYear() - hoje.getUTCFullYear()) * 12 + (d.getUTCMonth() - hoje.getUTCMonth());
};

function tipoDoEmprestimo(kind: string | null | undefined): TipoDivida {
  if (kind === "FINANCING") return "parcelamento";
  if (kind === "UNARRANGED_ACCOUNT_OVERDRAFT") return "cheque";
  return "emprestimo";
}

export function sugestaoDoEmprestimo(l: PluggyEmprestimo, instituicao: string, hoje: Date = new Date()): SugestaoDeDivida | null {
  const e = l as EmprestimoCompleto;
  const parcela = centavos(e.nextInstallmentAmount) ?? 0;
  const faltaComJuros = centavos(e.totalRemainingAmount);
  const devedor = centavos(e.payments?.contractOutstandingBalance);

  const juros = e.interestRates?.find((r) => r.preFixedRate !== null && r.preFixedRate !== undefined);
  let taxa: number | null = null;
  if (juros) taxa = taxaMensalDe({ valor: juros.preFixedRate!, periodicidade: juros.taxPeriodicity === "MONTHLY" ? "MONTHLY" : "YEARLY" });
  else if (e.CET) taxa = taxaMensalDe({ valor: e.CET, periodicidade: "YEARLY" });

  // Parcelas restantes: o número do contrato só se for coerente com o que falta pagar.
  let restantes: number | null = null;
  const informadas = e.installments?.dueInstallments ?? null;
  if (informadas && informadas > 0 && informadas <= TRAVAS.parcelasMax && parcela && faltaComJuros && Math.abs(informadas * parcela - faltaComJuros) <= faltaComJuros * 0.1) {
    restantes = informadas;
  } else if (parcela && faltaComJuros) {
    restantes = Math.ceil(faltaComJuros / parcela);
  } else if (e.dueDate) {
    const meses = mesesAte(e.dueDate, hoje);
    restantes = meses > 0 ? meses : null;
  }

  let saldo: number | null = null;
  const confira: CampoDaDivida[] = [];
  if (devedor && devedor > parcela && (!faltaComJuros || devedor <= faltaComJuros)) saldo = devedor;
  else if (parcela && restantes && taxa !== null && taxa <= TRAVAS.taxaMensalMax) saldo = valorPresente(parcela, restantes, taxa);
  else if (faltaComJuros) {
    saldo = faltaComJuros;
    confira.push("saldo");
  }
  if (!saldo) return null;

  const tipo = tipoDoEmprestimo(e.kind);
  const primeiro = e.firstInstallmentDueDate ? new Date(e.firstInstallmentDueDate).getUTCDate() : null;
  return aplicarTravas({
    chave: chaveDaDivida({ instituicao, tipo, parcelaMinima: parcela }),
    fonte: "pluggy",
    pluggyLoanId: e.id,
    tipo,
    nome: `${e.productName} · ${instituicao}`,
    instituicao,
    detalhe: e.productName,
    saldo,
    vencido: null,
    taxaMensal: taxa,
    parcelaMinima: parcela,
    vencimento: primeiro,
    parcelasRestantes: restantes,
    cet: e.CET ?? null,
    temSeguro: e.hasInsuranceContracted ?? null,
    faltaPagarComJuros: faltaComJuros,
    confira,
  });
}

export function sugestaoDoChequeEspecial(c: ContaBancaria, instituicao: string): SugestaoDeDivida | null {
  if (!c.chequeEspecialUsado || c.chequeEspecialUsado <= 0) return null;
  return aplicarTravas({
    chave: chaveDaDivida({ instituicao, tipo: "cheque", parcelaMinima: 0 }),
    fonte: "pluggy",
    pluggyLoanId: null,
    tipo: "cheque",
    nome: `Cheque especial · ${instituicao}`,
    instituicao,
    detalhe: c.nome,
    saldo: c.chequeEspecialUsado,
    vencido: null,
    taxaMensal: null,
    parcelaMinima: 0,
    vencimento: null,
    parcelasRestantes: null,
    cet: null,
    temSeguro: null,
    faltaPagarComJuros: null,
    confira: [],
  });
}

export function chaveDaDivida(s: Pick<SugestaoDeDivida, "instituicao" | "tipo" | "parcelaMinima">): string {
  const base = `${chaveDaInstituicao(s.instituicao)}|${s.tipo}`;
  return s.parcelaMinima > 0 ? `${base}|${s.parcelaMinima}` : base;
}

export function encontrarDivida<T extends Pick<SugestaoDeDivida, "instituicao" | "tipo" | "parcelaMinima" | "saldo"> & { confira?: CampoDaDivida[] }>(existentes: T[], nova: SugestaoDeDivida): T | null {
  const inst = chaveDaInstituicao(nova.instituicao);
  const candidatas = existentes.filter((d) => {
    if (chaveDaInstituicao(d.instituicao) !== inst || d.tipo !== nova.tipo) return false;
    if (d.parcelaMinima > 0 && nova.parcelaMinima > 0) return Math.abs(d.parcelaMinima - nova.parcelaMinima) <= Math.max(d.parcelaMinima, nova.parcelaMinima) * 0.02;
    // Sem parcela para comparar: se os dois saldos são confiáveis, precisam ser parecidos (até 35%).
    const saldoConfiavel = (s: Pick<SugestaoDeDivida, "saldo"> & { confira?: CampoDaDivida[] }) => s.saldo > 0 && !(s.confira ?? []).includes("saldo");
    // Cheque especial e rotativo mudam muito de saldo de um mês para o outro: só instituição e tipo.
    const parcelado = nova.tipo === "emprestimo" || nova.tipo === "parcelamento";
    if (parcelado && saldoConfiavel(d) && saldoConfiavel(nova)) return Math.abs(d.saldo - nova.saldo) <= Math.max(d.saldo, nova.saldo) * 0.35;
    return true;
  });
  if (!candidatas.length) return null;
  return candidatas.reduce((melhor, d) => (Math.abs(d.saldo - nova.saldo) < Math.abs(melhor.saldo - nova.saldo) ? d : melhor));
}

type Campo = "saldo" | "vencido" | "taxaMensal" | "parcelaMinima" | "vencimento" | "parcelasRestantes" | "cet" | "temSeguro" | "faltaPagarComJuros" | "pluggyLoanId";
const CAMPOS: Campo[] = ["saldo", "vencido", "taxaMensal", "parcelaMinima", "vencimento", "parcelasRestantes", "cet", "temSeguro", "faltaPagarComJuros", "pluggyLoanId"];
const CONFERIVEL = new Set<string>(["saldo", "taxaMensal", "parcelaMinima", "parcelasRestantes"]);

/** O valor do campo serve? Nulo, zero em saldo/parcela ou marcado "confira" não serve. */
function usavel(s: SugestaoDeDivida, campo: Campo): boolean {
  const v = s[campo];
  if (v === null || v === undefined) return false;
  if ((campo === "saldo" || campo === "parcelaMinima") && v === 0) return false;
  return !(CONFERIVEL.has(campo) && s.confira.includes(campo as CampoDaDivida));
}

export function fundirDivida(existente: SugestaoDeDivida, nova: SugestaoDeDivida): SugestaoDeDivida {
  const novaManda = CONFIANCA[nova.fonte] >= CONFIANCA[existente.fonte];
  const r: SugestaoDeDivida = { ...existente };
  const confira = new Set(existente.confira);
  for (const campo of CAMPOS) {
    const pegarNova = usavel(nova, campo) && (novaManda || !usavel(existente, campo));
    if (pegarNova) {
      (r as unknown as Record<Campo, unknown>)[campo] = nova[campo];
      if (CONFERIVEL.has(campo)) confira.delete(campo as CampoDaDivida);
    }
  }
  if (novaManda) {
    r.fonte = nova.fonte;
    r.nome = nova.nome || r.nome;
    r.detalhe = nova.detalhe || r.detalhe;
  }
  r.confira = [...confira];
  return r;
}
