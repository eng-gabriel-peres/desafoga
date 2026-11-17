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

/** Salário: entradas "renda", ou da mesma origem, em 2 ou mais meses, com valor parecido. */
export function rendaDetectada(movs: Movimento[]): { valor: number; dia: number } | null {
  const entradas = movs.filter((m) => m.direcao === "entrada" && (m.natureza === "renda" || m.natureza === "outra-entrada"));
  const grupos = new Map<string, Movimento[]>();
  for (const m of entradas) {
    const chave = m.natureza === "renda" ? `renda:${chaveDaDescricao(m.descricao)}` : (m.documentoContraparte ?? chaveDaDescricao(m.descricao));
    grupos.set(chave, [...(grupos.get(chave) ?? []), m]);
  }
  const candidatos = [...grupos.entries()]
    .map(([chave, lista]) => {
      const ordenada = [...lista].sort((a, b) => b.data.localeCompare(a.data));
      const ultima = ordenada[0];
      const parecidas = ordenada.filter((m) => parecido(m.valor, ultima.valor));
      const meses = new Set(parecidas.map((m) => mesDe(m.data)));
      return { renda: chave.startsWith("renda:"), ultima, parecidas, meses: meses.size };
    })
    .filter((c) => c.meses >= 2)
    .sort((a, b) => Number(b.renda) - Number(a.renda) || b.ultima.valor - a.ultima.valor);
  const melhor = candidatos[0];
  return melhor ? { valor: melhor.ultima.valor, dia: diaMaisComum(melhor.parecidas.map((m) => m.data)) } : null;
}

export interface Assinatura {
  nome: string;
  /** Valor da última cobrança (centavos). */
  valor: number;
  /** Meses seguidos cobrando. */
  meses: number;
  ultimaData: string;
}

/** A mesma loja cobrando um valor parecido todo mês, em meses seguidos. */
export function assinaturasDetectadas(movs: Movimento[]): Assinatura[] {
  const grupos = new Map<string, Movimento[]>();
  for (const m of movs) {
    if (m.direcao !== "saida" || m.natureza !== "compra" || m.parcela) continue;
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
    let meses = 1;
    for (let i = 1; i < ordenada.length; i++) {
      if (mesesEntre(mesDe(ordenada[i].data), mesDe(ordenada[i - 1].data)) !== 1 || !parecido(ordenada[i].valor, ultima.valor)) break;
      meses++;
    }
    if (meses >= 2) lista.push({ nome: legivel(ultima.descricao), valor: ultima.valor, meses, ultimaData: ultima.data });
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
