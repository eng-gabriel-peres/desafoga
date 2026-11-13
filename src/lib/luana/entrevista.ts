import type { Conta } from "./resumo";

/**
 * Conversa guiada para quem não quer mandar extrato nem fatura: a Luana
 * pergunta o básico, uma coisa por vez, e pula o que a pessoa já contou.
 */

export const PASSOS = ["renda", "fixas", "variaveis", "reserva"] as const;
export type Passo = (typeof PASSOS)[number];

export interface Entrevista {
  /** Perguntas já feitas, para nenhuma se repetir. */
  perguntadas: Passo[];
  /** A pergunta que está esperando resposta. */
  pendente: Passo | null;
  concluida?: boolean;
}

export const PERGUNTA: Record<Passo, string> = {
  renda: "Quanto entra para você por mês, somando tudo? Pode ser aproximado.",
  fixas:
    "Quais são suas contas fixas e quanto é cada uma? Aluguel ou condomínio, luz, água, internet, celular, plano de saúde, escola.",
  variaveis:
    "E o que varia: quanto costuma dar a fatura do cartão, o mercado e o transporte no mês? Se não tiver algum, é só dizer.",
  reserva:
    "Tem algum dinheiro guardado à parte, tipo cofrinho, caixinha ou poupança? Quanto? Eu deixo ele fora da conta do mês.",
};

function respondido(passo: Passo, conta: Conta): boolean {
  const grupos = new Set((conta.plano?.itens ?? []).map((i) => i.grupo));
  if (passo === "renda") return !!conta.rendaMensal;
  if (passo === "fixas") return grupos.has("moradia_e_contas");
  if (passo === "variaveis") return grupos.has("cartao") || grupos.has("mercado");
  return conta.reserva != null;
}

/**
 * Avança a entrevista: devolve a próxima pergunta, ou null quando acabou
 * (ou quando não há entrevista em andamento). Altera `conta.entrevista`.
 */
export function proximaPergunta(conta: Conta): string | null {
  const e = conta.entrevista;
  if (!e || e.concluida) return null;
  const passo = PASSOS.find((p) => !e.perguntadas.includes(p) && !respondido(p, conta));
  if (!passo) {
    e.pendente = null;
    e.concluida = true;
    return null;
  }
  e.perguntadas.push(passo);
  e.pendente = passo;
  return PERGUNTA[passo];
}
