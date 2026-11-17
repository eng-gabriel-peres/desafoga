/**
 * O que dá para perceber nos dados do banco além das compras: melhor dia de
 * compra, limite do cartão, salário, assinaturas, tarifas e juros de boleto.
 * Nada aqui registra nada: vira aviso ou sugestão.
 */
import { chaveDaDescricao } from "./classificar";
import type { ContaBancaria, Movimento } from "./tipos";

const legivel = (d: string) => {
  const t = d.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const mesDe = (data: string) => data.slice(0, 7);
const mesesEntre = (de: string, ate: string) => {
  const [a, m] = de.split("-").map(Number);
  const [b, n] = ate.split("-").map(Number);
  return (b - a) * 12 + (n - m);
};
const parecido = (a: number, b: number) => Math.abs(a - b) <= Math.max(a, b) * 0.1;

/** Comprando no dia seguinte ao fechamento, a compra só vence na fatura do mês seguinte. */
export function melhorDiaDeCompra(c: ContaBancaria): number | null {
  if (c.tipo !== "cartao" || !c.fechamento) return null;
  const d = new Date(`${c.fechamento}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.getUTCDate();
}

export function usoDoLimite(c: ContaBancaria): { usado: number; limite: number; fracao: number } | null {
  if (c.tipo !== "cartao" || !c.limite) return null;
  const usado = c.limiteDisponivel !== null ? Math.max(0, c.limite - c.limiteDisponivel) : c.saldo;
  return { usado, limite: c.limite, fracao: Math.round((usado / c.limite) * 100) / 100 };
}

function diaMaisComum(datas: string[]): number {
  const contagem = new Map<number, number>();
  for (const d of datas) {
    const dia = Number(d.slice(8, 10));
    contagem.set(dia, (contagem.get(dia) ?? 0) + 1);
  }
  return [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

/**
 * Salário: entradas "renda" (somadas no mês: salário pago em partes conta inteiro),
 * ou entradas da mesma origem, em 2 ou mais meses com total parecido. O mês atual
 * pode estar pela metade, então o valor vem do grupo de meses que se repete.
 */
export function rendaDetectada(movs: Movimento[]): { valor: number; dia: number } | null {
  const entradas = movs.filter((m) => m.direcao === "entrada" && m.situacao !== "ignorada" && (m.natureza === "renda" || m.natureza === "outra-entrada"));
  const grupos = new Map<string, Movimento[]>();
  for (const m of entradas) {
    const chave = m.natureza === "renda" ? "renda" : (m.documentoContraparte ?? chaveDaDescricao(m.descricao));
    grupos.set(chave, [...(grupos.get(chave) ?? []), m]);
  }
  const candidatos: { renda: boolean; valor: number; dia: number }[] = [];
  for (const [chave, lista] of grupos) {
    const porMes = new Map<string, Movimento[]>();
    for (const m of lista) porMes.set(mesDe(m.data), [...(porMes.get(mesDe(m.data)) ?? []), m]);
    const meses = [...porMes.entries()].map(([mes, l]) => ({ mes, total: l.reduce((s, m) => s + m.valor, 0), maior: l.reduce((a, b) => (b.valor > a.valor ? b : a)) })).sort((a, b) => b.mes.localeCompare(a.mes));
    const grupo = meses.map((m) => meses.filter((x) => parecido(x.total, m.total))).find((g) => g.length >= 2);
    if (!grupo) continue;
    candidatos.push({ renda: chave === "renda", valor: grupo[0].total, dia: diaMaisComum(grupo.map((m) => m.maior.data)) });
  }
  candidatos.sort((a, b) => Number(b.renda) - Number(a.renda) || b.valor - a.valor);
  return candidatos[0] ? { valor: candidatos[0].valor, dia: candidatos[0].dia } : null;
}

export interface Assinatura {
  nome: string;
  /** Valor da última cobrança (centavos). */
  valor: number;
  /** Meses seguidos cobrando. */
  meses: number;
  ultimaData: string;
  /** Conta da última cobrança (cartão ou conta corrente). */
  contaId: string;
}

/** Assinatura cobra o mesmo valor (até 2% de diferença); compra comum muda mais. */
const mesmoValor = (a: number, b: number) => Math.abs(a - b) <= Math.max(a, b) * 0.02;

/** A mesma loja cobrando o mesmo valor todo mês, em meses seguidos, e cobrando ainda (últimos 35 dias). */
export function assinaturasDetectadas(movs: Movimento[], hoje: string): Assinatura[] {
  const limite = new Date(`${hoje}T12:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() - 35);
  const desde = limite.toISOString().slice(0, 10);
  const grupos = new Map<string, Movimento[]>();
  for (const m of movs) {
    if (m.direcao !== "saida" || m.natureza !== "compra" || m.parcela || m.situacao === "ignorada") continue;
    const chave = chaveDaDescricao(m.descricao);
    grupos.set(chave, [...(grupos.get(chave) ?? []), m]);
  }
  const lista: Assinatura[] = [];
  for (const cobrancas of grupos.values()) {
    const porMes = new Map<string, Movimento[]>();
    for (const m of cobrancas) porMes.set(mesDe(m.data), [...(porMes.get(mesDe(m.data)) ?? []), m]);
    // Mais de uma vez no mesmo mês é compra comum, não assinatura.
    if ([...porMes.values()].some((l) => l.length > 1)) continue;
    const ordenada = [...cobrancas].sort((a, b) => b.data.localeCompare(a.data));
    const ultima = ordenada[0];
    if (ultima.data < desde) continue;
    let meses = 1;
    for (let i = 1; i < ordenada.length; i++) {
      if (mesesEntre(mesDe(ordenada[i].data), mesDe(ordenada[i - 1].data)) !== 1 || !mesmoValor(ordenada[i].valor, ultima.valor)) break;
      meses++;
    }
    if (meses >= 2) lista.push({ nome: legivel(ultima.descricao), valor: ultima.valor, meses, ultimaData: ultima.data, contaId: ultima.contaId });
  }
  return lista.sort((a, b) => b.valor - a.valor);
}

export function tarifasDoMes(movs: Movimento[], mes: string): { total: number; itens: { nome: string; valor: number }[] } {
  const itens = movs.filter((m) => m.natureza === "tarifa" && mesDe(m.data) === mes).map((m) => ({ nome: legivel(m.descricao), valor: m.valor }));
  return { total: itens.reduce((s, i) => s + i.valor, 0), itens };
}

export function jurosDeBoletoDoMes(movs: Movimento[], mes: string): number {
  return movs.filter((m) => mesDe(m.data) === mes).reduce((s, m) => s + (m.jurosBoleto ?? 0), 0);
}
