import { formatarReais } from "@/lib/dinheiro";
import type { Emocao, Estrategia, Necessidade } from "@/lib/finance";
import type { Tom } from "@/services/tipos";

export const reais = formatarReais;

export const NOME_DA_EMOCAO: Record<Emocao, string> = {
  1: "Muito triste",
  2: "Triste",
  3: "Normal",
  4: "Feliz",
  5: "Muito feliz",
};

export const NOME_DA_NECESSIDADE: Record<Necessidade, string> = {
  sim: "Necessária",
  nao: "Não necessária",
  talvez: "Não sei",
};

export const RESPOSTA_DA_NECESSIDADE: Record<Necessidade, string> = {
  sim: "Sim",
  nao: "Não",
  talvez: "Não sei",
};

export const NOME_DA_ESTRATEGIA: Record<Estrategia, string> = {
  "mais-cara": "mais cara primeiro",
  menor: "menor primeiro",
};

export const TONS: Record<Tom, { nome: string; descricao: string }> = {
  acolhedor: { nome: "Acolhedor", descricao: "Calmo, sem pressa, valida o sentimento antes de sugerir algo." },
  direto: { nome: "Direto", descricao: "Curto e objetivo, vai direto ao ponto." },
  motivador: { nome: "Motivador", descricao: "Animado, celebra cada passo e lembra dos objetivos." },
};

/** 2,5 -> "2,5" */
export function umaCasa(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** 0,142 -> "14,2%" */
export function percentual(fracao: number): string {
  return `${umaCasa(fracao * 100)}%`;
}

export function meses(n: number): string {
  return `${n} ${n === 1 ? "mês" : "meses"}`;
}

/** Mês e ano daqui a `n` meses: "março de 2027". */
export function mesDaqui(hoje: Date, n: number): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + n, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export const AVISO_EDUCATIVO = "Simulação educativa. Não é recomendação de crédito ou investimento.";
