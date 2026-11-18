import { formatarReais } from "@/lib/dinheiro";
import type { Conquista, ContaFixa, Emocao, IconeDaConquista, Estrategia, Frequencia, Meta, Necessidade, Periodo, SituacaoDaMeta, SituacaoDoOrcamento } from "@/lib/finance";
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

/** "R$ 120" quando não há centavos; senão "R$ 120,50". */
export function reaisCurto(centavos: number): string {
  return centavos % 100 === 0 ? reais(centavos).replace(/,00$/, "") : reais(centavos);
}

/**
 * O aviso do orçamento que a pessoa lê: o que foi usado, o que resta e quanto
 * dá por dia. Com `pessoa`, o texto fala dela (para o profissional).
 */
export function explicarOrcamento(s: SituacaoDoOrcamento, pessoa?: string): string {
  const nome = s.categoria.toLowerCase();
  if (pessoa) {
    if (s.estado === "estourou") return `${pessoa} passou ${reaisCurto(s.passou)} do orçamento de ${nome} este mês.`;
    return `${pessoa} já usou ${Math.floor(s.usado * 100)}% do orçamento de ${nome}. Restam ${reaisCurto(s.restante)} até o final do mês${
      s.diasRestantes > 1 ? `, ${reaisCurto(s.porDia)} por dia` : ""
    }.`;
  }
  if (s.estado === "estourou") {
    const quanto = s.passou
      ? `Você passou ${reaisCurto(s.passou)} do seu orçamento de ${nome} este mês (${reaisCurto(s.gasto)} de ${reaisCurto(s.limite)}).`
      : `Você usou todo o orçamento de ${nome} deste mês.`;
    return `${quanto} Tudo bem, acontece. Se der, segure os gastos com ${nome} até o mês virar.`;
  }
  const dias =
    s.diasRestantes > 1
      ? ` Considerando os dias restantes, seu limite diário recomendado é de ${reaisCurto(s.porDia)}.`
      : " Hoje é o último dia do mês.";
  return `Você já utilizou ${Math.floor(s.usado * 100)}% do seu orçamento de ${nome}. Restam ${reaisCurto(s.restante)} até o final do mês.${dias}`;
}

export const NOME_DA_FREQUENCIA: Record<Frequencia, { unidade: string; por: string }> = {
  dia: { unidade: "dia", por: "por dia" },
  semana: { unidade: "semana", por: "por semana" },
  mes: { unidade: "mês", por: "por mês" },
};

const daChave = (chave: string) => {
  const [a, m, d] = chave.split("-").map(Number);
  return new Date(a, m - 1, d);
};

/** "16 de fevereiro de 2027" */
export const dataLonga = (chave: string) => daChave(chave).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

/** "16 de fev." */
export const dataCurta = (chave: string) => daChave(chave).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });

/** "Em dia", "Adiantada", "Faltam R$ 160 para ficar em dia" ou "Concluída". */
export function rotuloDoRitmo(s: SituacaoDaMeta): string {
  if (s.concluida) return "Concluída";
  if (s.ritmo === "atrasada") return `Faltam ${reaisCurto(s.atrasado)} para ficar em dia`;
  return s.ritmo === "adiantada" ? "Adiantada" : "Em dia";
}

/** Resposta da Luana depois de guardar dinheiro na meta. */
export function respostaDoDeposito(meta: Meta, valor: number, s: SituacaoDaMeta): string {
  if (s.concluida) return `🎉 Meta completa: ${meta.nome}! Você juntou ${reaisCurto(s.guardado)}. Que orgulho!`;
  return `Anotado ✅ ${reaisCurto(valor)} em ${meta.nome}. Agora você tem ${Math.floor(s.fracao * 100)}% e faltam ${reaisCurto(s.falta)}.`;
}

export const avisoDeMetaConcluida = (apelido: string, meta: Meta) => `${apelido} completou a meta ${meta.nome} (${reaisCurto(meta.alvo)}).`;

export function mensagemDeIncentivo(profissional: string, meta: Meta, s: SituacaoDaMeta): string {
  return s.concluida
    ? `👏 ${profissional} viu que você completou a meta ${meta.nome}. Parabéns pela conquista!`
    : `👏 ${profissional} está acompanhando sua meta ${meta.nome}: você já tem ${Math.floor(s.fracao * 100)}% (${reaisCurto(s.guardado)}). Continue assim!`;
}

export function mensagemDeLembrete(meta: Meta, s: SituacaoDaMeta): string {
  return `🐷 Hoje é dia de guardar para ${meta.nome}.\nPelo seu plano: ${reaisCurto(meta.valorPorPeriodo)}. Você já tem ${Math.floor(s.fracao * 100)}% da meta.\nQuando guardar, me responda: guardei ${Math.round(meta.valorPorPeriodo / 100)}`;
}

/** Uma linha por meta, com os números do código, para o contexto da IA. */
export function fatoDaMeta(meta: Meta, s: SituacaoDaMeta): string {
  const base = `${meta.nome}: meta ${reais(meta.alvo)}, guardado ${reais(s.guardado)} (${Math.floor(s.fracao * 100)}%)`;
  if (s.concluida) return `${base}, concluída`;
  const fim = s.previsao ? `, termina em ${dataLonga(s.previsao.data)}` : "";
  return `${base}, plano ${reais(meta.valorPorPeriodo)} ${NOME_DA_FREQUENCIA[meta.frequencia].por}, ${rotuloDoRitmo(s).toLowerCase()}${fim}`;
}

/** Lembrete de conta fixa, um dia antes do vencimento. */
export function lembreteDeConta(apelido: string, conta: ContaFixa): string {
  const valor = `${conta.variavel ? "cerca de " : ""}${reaisCurto(conta.valor)}`;
  return `📅 Oi, ${apelido}! ${conta.nome} vence amanhã: ${valor}.\nQuando pagar, me responda: paguei ${conta.nome.toLowerCase()} ${Math.round(conta.valor / 100)}`;
}

// ---------- conquistas ----------

/** No chat e no WhatsApp a conquista aparece com emoji, como no protótipo. */
export const EMOJI_DA_CONQUISTA: Record<IconeDaConquista, string> = {
  broto: "🌱",
  caderno: "📝",
  brilho: "☀️",
  estrela: "⭐",
  alvo: "🎯",
  raio: "💪",
  medalha: "🏅",
  festa: "🎉",
};

export function mensagemDeConquistaNova(c: Conquista): string {
  return `🎯 Nova conquista de ${c.autor ?? "quem te acompanha"} para você!\n${EMOJI_DA_CONQUISTA[c.icone]} ${c.titulo}${c.premio ? `\nPrêmio: ${c.premio}` : ""}`;
}

export function mensagemDeConquistaAlcancada(c: Conquista): string {
  return `🏆 Conquista desbloqueada!\n${EMOJI_DA_CONQUISTA[c.icone]} ${c.titulo}${c.premio ? `\nSeu prêmio: ${c.premio}` : ""}`;
}

// ---------- check-ins da rotina ----------

/** A pergunta de cada check-in, como a Luana manda no horário da rotina. */
export function perguntaDoCheckIn(apelido: string, periodo: Periodo): string {
  if (periodo === "manha") return `Bom dia, ${apelido}! Como você acordou hoje?`;
  if (periodo === "tarde") return `Oi, ${apelido}! Como está sendo o seu dia até agora?`;
  return `Boa noite, ${apelido}. Como você está se sentindo agora à noite?`;
}

/** Resposta ao check-in, adaptada ao humor e ao que os profissionais anotaram. */
export function respostaDoCheckIn(apelido: string, periodo: Periodo, humor: Emocao, caracteristicas: string[], objetivo: string): string {
  if (humor <= 2) {
    const base =
      periodo === "manha"
        ? `Obrigada por contar, ${apelido}. Começar o dia assim pesa. Vá no seu ritmo hoje.`
        : periodo === "tarde"
          ? "Sinto que o dia está difícil. Quer me contar o que aconteceu?"
          : "Noites assim cansam. Que bom que você me contou.";
    const compraTriste = caracteristicas.includes("Compra quando está triste") || (periodo === "noite" && caracteristicas.includes("Compra à noite"));
    return compraTriste
      ? `${base} Nos dias difíceis a vontade de comprar costuma aparecer ${periodo === "noite" ? "agora à noite" : "mais tarde"}. Se aparecer, coloque no carrinho e decida amanhã. Combinado?`
      : `${base} Se bater vontade de comprar algo, me chama antes.`;
  }
  if (humor === 3) {
    return periodo === "manha"
      ? `Um dia de cada vez, ${apelido}. Estou por aqui se precisar.`
      : periodo === "tarde"
        ? "Obrigada pela atualização. Seguimos juntos."
        : "Obrigada por contar. Descanse bem hoje.";
  }
  const base = periodo === "manha" ? `Que bom, ${apelido}! Aproveite essa energia.` : periodo === "tarde" ? "Que ótimo ouvir isso!" : "Que bom terminar o dia assim!";
  return [
    base,
    caracteristicas.includes("Responde bem a elogios") ? "Você está cuidando bem de si." : "",
    objetivo ? `Cada dia assim te deixa mais perto de: ${objetivo.charAt(0).toLowerCase()}${objetivo.slice(1)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

const NOME_DO_PERIODO_NA_FRASE: Record<Periodo, string> = { manha: "ao acordar", tarde: "do meio-dia", noite: "da noite" };

export const avisoDeCheckInTriste = (apelido: string, periodo: Periodo, humor: Emocao) =>
  `${apelido} respondeu "${NOME_DA_EMOCAO[humor].toLowerCase()}" no check-in ${NOME_DO_PERIODO_NA_FRASE[periodo]}.`;

// ---------- contas do mês ----------

/** "Anotado: Conta de luz paga: R$ 87,50. Falta pagar R$ 300 este mês." */
export function respostaDoPagamento(nome: string, valor: number | null, falta: number, variavelSemValor: boolean, apelidoDaConta: string): string {
  return [
    `Anotado: ${nome} paga${valor ? `, ${reais(valor)}` : ""}.`,
    falta > 0 ? `Falta pagar ${reaisCurto(falta)} este mês.` : "Tudo pago neste mês. Parabéns!",
    variavelSemValor ? `Se quiser registrar o valor exato, me escreva, por exemplo: paguei ${apelidoDaConta} 87,50` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Luana avisa no chat do app que chegou uma compra do banco para registrar. */
export function mensagemDeCompraDoBanco(item: string, valor: number): string {
  return `Vi ${reais(valor)} em ${item} agora. Como você estava? Me conta em Hoje, em "Compras para revisar".`;
}

export function avisoDeCompraDoBanco(item: string, valor: number): string {
  return `Compra no banco: ${item}, ${reais(valor)}. Registre como você estava.`;
}

export function avisoDeDividaEncontrada(nome: string, saldo: number): string {
  return `Achei uma dívida: ${nome}, saldo de ${reais(saldo)}. Confira em Dívidas.`;
}

export function avisoDeLimiteDoCartao(cartao: string, fracao: number, disponivel: number): string {
  return `Você já usou ${Math.round(fracao * 100)}% do limite do ${cartao}. Restam ${reais(disponivel)} até a fatura fechar.`;
}

export function avisoDeConsentimento(banco: string, dias: number): string {
  return dias <= 0
    ? `A autorização do ${banco} venceu. Reconecte em Contas para continuar vendo as compras.`
    : `A autorização do ${banco} vence em ${dias} ${dias === 1 ? "dia" : "dias"}. Renove em Contas para não perder as atualizações.`;
}

export function avisoDeSeguro(nome: string): string {
  return `${nome} tem seguro contratado junto. Vale perguntar ao banco se ele é obrigatório: muitas vezes dá para cancelar e baixar a parcela.`;
}
