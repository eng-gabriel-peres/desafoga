/**
 * Próximos meses: quanto já está comprometido em cada mês (contas fixas,
 * fatura de cada cartão, parcelas de dívidas) e quando cada coisa acaba.
 * As parcelas de compras no cartão entram DENTRO da fatura do cartão, nunca
 * como item à parte.
 */
import type { CompraParcelada, ContaBancaria } from "@/lib/banco/tipos";
import { chaveDaInstituicao } from "@/lib/banco/instituicoes";
import { chaveDoMes } from "./datas";
import { simularQuitacao, somaDosMinimos } from "./dividas";
import type { ContaFixa, Divida, Estrategia, Fatura, Renda } from "./tipos";

export interface CartaoNoMes {
  origem: string;
  nome: string;
  vencimento: number;
  faturaAberta: { mes: string; valor: number } | null;
}

export interface ItemDoMes {
  tipo: "conta" | "fatura" | "divida";
  nome: string;
  valor: number;
  previsto: boolean;
  detalhe?: string;
}

export interface MesComprometido {
  mes: string;
  total: number;
  renda: number | null;
  sobra: number | null;
  itens: ItemDoMes[];
  /** Nomes de parcelamentos e dívidas cuja última parcela cai neste mês. */
  terminam: string[];
}

function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
const mesesEntre = (de: string, ate: string) => {
  const [a, m] = de.split("-").map(Number);
  const [b, n] = ate.split("-").map(Number);
  return (b - a) * 12 + (n - m);
};
const diaDe = (data: string | null | undefined) => (data ? Number(data.slice(8, 10)) : 10);

const valorDaFatura = (f: Fatura) =>
  f.total ?? f.lancamentos.filter((l) => l.tipo !== "pagamento" && l.tipo !== "parcela_emprestimo").reduce((s, l) => s + l.valor, 0);

const maisRecente = (lista: Fatura[]) => [...lista].sort((a, b) => b.mes.localeCompare(a.mes))[0];

/** Um cartão por origem: cartões conectados e faturas em PDF que ainda contam. */
export function cartoesDasFontes(contas: ContaBancaria[], faturas: Fatura[]): CartaoNoMes[] {
  const validas = faturas.filter((f) => f.tipo === "fatura" && !f.foraDosCalculos);
  const cartoes: CartaoNoMes[] = [];
  for (const c of contas.filter((x) => x.tipo === "cartao")) {
    const daConta = validas.filter((f) => f.contaId === c.id);
    const preferida = maisRecente(daConta.filter((f) => f.fonte === "pluggy")) ?? maisRecente(daConta);
    const faturaAberta = preferida
      ? { mes: preferida.mes, valor: valorDaFatura(preferida) }
      : c.vencimento
        ? { mes: c.vencimento.slice(0, 7), valor: c.saldo }
        : null;
    cartoes.push({ origem: c.id, nome: c.nome, vencimento: diaDe(c.vencimento ?? preferida?.vencimento), faturaAberta });
  }
  const ligadas = new Set(contas.map((c) => c.id));
  const porOrigem = new Map<string, Fatura[]>();
  for (const f of validas) {
    if (f.contaId && ligadas.has(f.contaId)) continue;
    const origem = `doc:${chaveDaInstituicao(f.origem)}`;
    porOrigem.set(origem, [...(porOrigem.get(origem) ?? []), f]);
  }
  for (const [origem, lista] of porOrigem) {
    const f = maisRecente(lista);
    cartoes.push({ origem, nome: f.origem, vencimento: diaDe(f.vencimento), faturaAberta: { mes: f.mes, valor: valorDaFatura(f) } });
  }
  return cartoes;
}

const ativaNoMes = (p: CompraParcelada, mes: string) => {
  const n = mesesEntre(p.mesDaPrimeira, mes);
  return n >= 0 && n < p.totalParcelas;
};
const ultimoMes = (p: CompraParcelada) => somarMeses(p.mesDaPrimeira, p.totalParcelas - 1);

export function proximosMeses(
  e: { contas: ContaFixa[]; dividas: Divida[]; plano: { valorMensal: number; estrategia: Estrategia }; parceladas: CompraParcelada[]; cartoes: CartaoNoMes[]; renda: Renda | null },
  agora: Date,
  quantos = 12,
): MesComprometido[] {
  const inicio = chaveDoMes(agora);
  const cartoes = [...e.cartoes];
  // Parcelas de uma origem sem cartão conhecido ainda aparecem, como "Compras parceladas".
  for (const origem of new Set(e.parceladas.map((p) => p.origem))) {
    if (!cartoes.some((c) => c.origem === origem)) cartoes.push({ origem, nome: "Compras parceladas", vencimento: 10, faturaAberta: null });
  }

  // Dívidas com parcela real e contagem conhecida usam o contrato; as outras, o plano.
  const doContrato = e.dividas.filter((d) => d.origem && d.origem !== "manual" && d.parcelasRestantes && d.parcelaMinima > 0 && d.saldo > 0);
  const peloPlano = e.dividas.filter((d) => d.saldo > 0 && !doContrato.includes(d));
  const simulacao = peloPlano.length
    ? simularQuitacao(peloPlano, Math.max(e.plano.valorMensal, somaDosMinimos(peloPlano)), e.plano.estrategia, quantos + 1)
    : null;

  return Array.from({ length: quantos }, (_, i) => {
    const mes = somarMeses(inicio, i);
    const itens: ItemDoMes[] = [];
    const terminam: string[] = [];

    for (const c of e.contas) itens.push({ tipo: "conta", nome: c.nome, valor: c.valor, previsto: c.variavel });

    for (const c of cartoes) {
      const ativas = e.parceladas.filter((p) => p.origem === c.origem && ativaNoMes(p, mes));
      for (const p of ativas) if (ultimoMes(p) === mes) terminam.push(p.nome);
      const detalhe = ativas.length ? `${ativas.length} ${ativas.length === 1 ? "parcela" : "parcelas"}` : undefined;
      if (c.faturaAberta?.mes === mes) {
        itens.push({ tipo: "fatura", nome: c.nome, valor: c.faturaAberta.valor, previsto: false, detalhe });
      } else if (!c.faturaAberta || mes > c.faturaAberta.mes) {
        const soma = ativas.reduce((s, p) => s + p.valorParcela, 0);
        if (soma > 0) itens.push({ tipo: "fatura", nome: c.nome, valor: soma, previsto: true, detalhe });
      }
    }

    for (const d of doContrato) {
      if (i < d.parcelasRestantes!) itens.push({ tipo: "divida", nome: d.nome, valor: d.parcelaMinima, previsto: false });
      if (i === d.parcelasRestantes! - 1) terminam.push(d.nome);
    }
    if (simulacao) {
      for (const d of peloPlano) {
        const valor = simulacao.pagamentoPrimeiroMes[d.id] ?? 0;
        const quitada = simulacao.quitadaNoMes[d.id];
        if (!valor || (quitada !== undefined && i >= quitada)) continue;
        itens.push({ tipo: "divida", nome: d.nome, valor, previsto: true });
        if (quitada !== undefined && i === quitada - 1) terminam.push(d.nome);
      }
    }

    const total = itens.reduce((s, x) => s + x.valor, 0);
    const renda = e.renda?.valor ?? null;
    return { mes, total, renda, sobra: renda === null ? null : renda - total, itens, terminam };
  });
}
