/**
 * Seu dinheiro: em qual fatura cai cada compra no cartão (cada cartão fecha e
 * vence num dia), o saldo da conta de quem não conectou o banco e a previsão
 * até o fim do mês e do mês que vem. Datas em chaves "YYYY-MM-DD".
 */
import type { Renda } from "./tipos";

export interface CartaoParaFatura {
  id: string;
  nome: string;
  /** Dia do mês em que a fatura fecha (1 a 31; em mês curto, o último dia). */
  fechamento: number;
  vencimento: number;
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");
const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
/** O dia `dia` do mês (ano, mes 1-12), limitado ao último dia. */
const noMes = (ano: number, mes: number, dia: number) => {
  const a = ano + Math.floor((mes - 1) / 12);
  const m = ((((mes - 1) % 12) + 12) % 12) + 1;
  return `${a}-${doisDigitos(m)}-${doisDigitos(Math.min(dia, diasNoMes(a, m)))}`;
};
const partes = (dia: string) => dia.split("-").map(Number) as [number, number, number];

/**
 * A compra entra na fatura que fecha no primeiro fechamento a partir do dia
 * dela (no próprio dia do fechamento ainda entra; no dia seguinte, já é a
 * próxima), e vence no primeiro vencimento depois desse fechamento.
 */
export function faturaDaCompra(dia: string, c: Pick<CartaoParaFatura, "fechamento" | "vencimento">): { fecha: string; vence: string } {
  const [a, m] = partes(dia);
  let fecha = noMes(a, m, c.fechamento);
  if (fecha < dia) fecha = noMes(a, m + 1, c.fechamento);
  const [fa, fm] = partes(fecha);
  let vence = noMes(fa, fm, c.vencimento);
  if (vence <= fecha) vence = noMes(fa, fm + 1, c.vencimento);
  return { fecha, vence };
}

/** A fatura que fecha `n` ciclos depois desta. */
function faturaSeguinte(fecha: string, n: number, c: CartaoParaFatura) {
  const [a, m] = partes(fecha);
  return faturaDaCompra(noMes(a, m + n, c.fechamento), c);
}

export interface CompraNoCartao {
  id: string;
  dia: string;
  /** Total da compra (centavos). */
  valor: number;
  parcelas?: number | null;
  valorDaParcela?: number | null;
}

export interface FaturaPrevista {
  cartaoId: string;
  fecha: string;
  vence: string;
  valor: number;
  itens: { compraId: string; valor: number; parcela: string | null }[];
}

/** As faturas que as compras formam, da que vence primeiro para a última; parceladas uma parcela por fatura. */
export function faturasDoCartao(c: CartaoParaFatura, compras: CompraNoCartao[]): FaturaPrevista[] {
  const porFechamento = new Map<string, FaturaPrevista>();
  const somar = (f: { fecha: string; vence: string }, item: FaturaPrevista["itens"][number]) => {
    const atual = porFechamento.get(f.fecha) ?? { cartaoId: c.id, fecha: f.fecha, vence: f.vence, valor: 0, itens: [] };
    atual.valor += item.valor;
    atual.itens.push(item);
    porFechamento.set(f.fecha, atual);
  };
  for (const x of compras) {
    const primeira = faturaDaCompra(x.dia, c);
    const n = x.parcelas && x.parcelas > 1 ? x.parcelas : 1;
    if (n === 1) {
      somar(primeira, { compraId: x.id, valor: x.valor, parcela: null });
      continue;
    }
    const parcela = x.valorDaParcela ?? Math.floor(x.valor / n);
    const resto = x.valorDaParcela ? 0 : x.valor - parcela * n;
    for (let k = 0; k < n; k++) {
      somar(k === 0 ? primeira : faturaSeguinte(primeira.fecha, k, c), { compraId: x.id, valor: parcela + (k === 0 ? resto : 0), parcela: `${k + 1}/${n}` });
    }
  }
  return [...porFechamento.values()].sort((a, b) => a.vence.localeCompare(b.vence));
}

export interface MovimentoDaConta {
  dia: string;
  /** Centavos: positivo entra, negativo sai. */
  valor: number;
  descricao: string;
  tipo: "renda" | "entrada" | "saida" | "compra" | "conta" | "divida" | "fatura";
  /** No mesmo dia do saldo informado, mas registrado depois dele: conta. */
  depoisDoSaldo?: boolean;
}

/**
 * Saldo de quem não conectou o banco: o saldo informado numa data, mais a
 * renda nos dias de renda e as entradas, menos as saídas (compras na conta,
 * contas, parcelas e faturas pagas, saídas avulsas), só depois dessa data e
 * até hoje. O extrato vem do mais novo para o mais antigo.
 */
export function saldoDaConta(
  d: { saldoInformado: number; desde: string; renda: Renda | null; movimentos: MovimentoDaConta[] },
  hoje: string,
): { saldo: number; extrato: MovimentoDaConta[] } {
  const extrato = d.movimentos.filter((m) => (m.dia > d.desde || (m.dia === d.desde && m.depoisDoSaldo)) && m.dia <= hoje);
  if (d.renda && d.renda.valor > 0) {
    const [a, m] = partes(d.desde);
    for (let k = 0; ; k++) {
      const dia = noMes(a, m + k, d.renda.dia);
      if (dia > hoje) break;
      if (dia > d.desde) extrato.push({ dia, valor: d.renda.valor, descricao: "Renda", tipo: "renda" });
    }
  }
  extrato.sort((x, y) => y.dia.localeCompare(x.dia));
  return { saldo: d.saldoInformado + extrato.reduce((s, x) => s + x.valor, 0), extrato };
}

export interface PrevisaoDoDinheiro {
  saldo: number;
  /** Quanto sobra no último dia deste mês. */
  fimDoMes: number;
  /** Quanto sobra no fim do mês que vem. */
  mesQueVem: number;
  faturasDesteMes: number;
  faturaDoMesQueVem: number;
  rendaQueAindaEntra: number;
}

/**
 * Previsão: o saldo de hoje, mais a renda que ainda entra neste mês, menos
 * o que falta pagar (contas e parcelas) e as faturas que vencem até o fim do
 * mês; no mês que vem, mais a renda, menos os compromissos e as faturas de lá.
 */
export function previsaoDoDinheiro(d: {
  hoje: string;
  saldo: number;
  renda: Renda | null;
  /** Contas e parcelas deste mês ainda não pagas. */
  aPagarEsteMes: number;
  /** Contas e parcelas do mês que vem. */
  compromissosDoMesQueVem: number;
  /** Faturas ainda não pagas (de todos os cartões). */
  faturas: { vence: string; valor: number }[];
}): PrevisaoDoDinheiro {
  const [a, m, dia] = partes(d.hoje);
  const esteMes = d.hoje.slice(0, 7);
  const proximo = noMes(a, m + 1, 1).slice(0, 7);
  const renda = d.renda && d.renda.valor > 0 ? d.renda : null;
  const rendaQueAindaEntra = renda && Math.min(renda.dia, diasNoMes(a, m)) > dia ? renda.valor : 0;
  const faturasDesteMes = d.faturas.filter((f) => f.vence.slice(0, 7) <= esteMes).reduce((s, f) => s + f.valor, 0);
  const faturaDoMesQueVem = d.faturas.filter((f) => f.vence.slice(0, 7) === proximo).reduce((s, f) => s + f.valor, 0);
  const fimDoMes = d.saldo + rendaQueAindaEntra - d.aPagarEsteMes - faturasDesteMes;
  const mesQueVem = fimDoMes + (renda?.valor ?? 0) - d.compromissosDoMesQueVem - faturaDoMesQueVem;
  return { saldo: d.saldo, fimDoMes, mesQueVem, faturasDesteMes, faturaDoMesQueVem, rendaQueAindaEntra };
}
