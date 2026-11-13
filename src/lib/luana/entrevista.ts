import type { ItemDoPlano } from "./plano";
import type { Conta } from "./resumo";

/**
 * Conversa guiada para quem não quer mandar extrato nem fatura: a Luana
 * pergunta o básico, uma coisa por vez, e pula o que a pessoa já contou.
 */

export const PASSOS = ["renda", "fixas", "variaveis", "reserva"] as const;
export type Passo = (typeof PASSOS)[number];

export interface Entrevista {
  /** Perguntas encerradas: respondidas ou puladas pela pessoa. Só estas não voltam. */
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
 * Uma pergunta que ficou sem resposta (a mensagem se perdeu, ou a pessoa falou
 * de outra coisa) volta a ser feita até ser respondida ou pulada.
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
  e.pendente = passo;
  return PERGUNTA[passo];
}

/** A pessoa disse que não tem ou não quer responder: a pergunta pendente não volta. */
export function pular(conta: Conta): void {
  const e = conta.entrevista;
  if (!e?.pendente) return;
  e.perguntadas.push(e.pendente);
  e.pendente = null;
}

const VARIAVEIS = ["cartao", "mercado", "transporte"];

/**
 * Encerra a pergunta pendente quando a mensagem trouxe o tipo de dado que ela
 * pedia. Se trouxe outra coisa, a pergunta continua aberta e volta depois.
 */
export function registrarResposta(
  conta: Conta,
  dados: { renda: boolean; despesas: ItemDoPlano[]; reserva: boolean },
): void {
  const e = conta.entrevista;
  if (!e?.pendente) return;
  const respondeu: Record<Passo, boolean> = {
    renda: dados.renda,
    fixas: dados.despesas.some((d) => !VARIAVEIS.includes(d.grupo)),
    variaveis: dados.despesas.length > 0,
    reserva: dados.reserva,
  };
  if (respondeu[e.pendente]) pular(conta);
}
