import { formatarReais, lerValorEmReais } from "@/lib/dinheiro";
import {
  jurosDoMes,
  jurosEmMeses,
  jurosMensaisTotais,
  ordenarPorCusto,
  simularQuitacao,
  somaDosMinimos,
} from "@/lib/motor/juros";
import { buscarPersona, PERSONAS, type Persona } from "@/lib/personas";
import { AVISO, BOAS_VINDAS } from "./textos";

export interface Resposta {
  /** Mensagens a enviar, na ordem. */
  mensagens: string[];
  /** Persona ativa depois desta mensagem; o canal guarda e devolve na próxima. */
  persona: string | null;
}

/**
 * Decide a resposta para uma mensagem de texto. É o mesmo código para o
 * WhatsApp e para o chat web, e não guarda estado: quem chama informa a
 * persona ativa.
 *
 * Versão por regras, sem modelo de linguagem. O agente com IA entra aqui
 * depois, mantendo os números vindos do motor.
 */
export function responder(texto: string, personaAtual: string | null): Resposta {
  const t = normalizar(texto);

  const escolhida = PERSONAS.find((p) => new RegExp(`\\b${p.id}\\b`).test(t));
  if (escolhida) {
    return { mensagens: [raioX(escolhida)], persona: escolhida.id };
  }

  const persona = buscarPersona(personaAtual);
  if (!persona || /\b(trocar|menu|inicio|comecar|oi|ola|ajuda)\b/.test(t)) {
    return { mensagens: [BOAS_VINDAS], persona: null };
  }

  const valor = lerValorEmReais(t);
  if (valor !== null) {
    const aMais = /\ba mais\b|\bextra\b/.test(t);
    const orcamento = aMais ? somaDosMinimos(persona.dividas) + valor : valor;
    return { mensagens: [plano(persona, orcamento)], persona: persona.id };
  }

  if (/\b(plano|pagar|quitar|sair|zerar)\b/.test(t)) {
    return { mensagens: [perguntarOrcamento(persona)], persona: persona.id };
  }

  return {
    mensagens: [
      `Não entendi. Você pode:\n• dizer quanto consegue pagar por mês (ex.: *900*)\n• perguntar *e se eu pagar 200 a mais?*\n• escrever *trocar* para ver outra pessoa`,
    ],
    persona: persona.id,
  };
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function raioX(p: Persona): string {
  const jurosMes = jurosMensaisTotais(p.dividas);
  const linhas = ordenarPorCusto(p.dividas).map((d) => {
    const taxa = (d.taxaMensal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    return `• ${d.nome}: deve ${formatarReais(d.saldo)} a ${taxa}% ao mês → *${formatarReais(jurosDoMes(d))}* de juros por mês`;
  });

  const partes = [
    `*${p.nome}*\n${p.perfil}`,
    linhas.join("\n"),
    `Total: *${formatarReais(jurosMes)} de juros por mês*. Se as dívidas ficarem desse tamanho, são ${formatarReais(jurosEmMeses(p.dividas, 12))} em um ano.`,
  ];
  if (p.encargosDaFatura > 0) {
    partes.push(`Na última fatura do cartão, ${formatarReais(p.encargosDaFatura)} foram só encargos.`);
  }
  partes.push(perguntarOrcamento(p), AVISO);
  return partes.join("\n\n");
}

function perguntarOrcamento(p: Persona): string {
  return `Quanto dá para pagar por mês no total? Os mínimos somam ${formatarReais(somaDosMinimos(p.dividas))}.`;
}

function plano(p: Persona, orcamento: number): string {
  const minimos = somaDosMinimos(p.dividas);
  if (orcamento < minimos) {
    return `Com ${formatarReais(orcamento)} não dá para cobrir os pagamentos mínimos, que somam ${formatarReais(minimos)}. Me diga um valor a partir disso.`;
  }

  const sim = simularQuitacao(p.dividas, orcamento);
  if (!sim.quitavel) {
    return `Pagando ${formatarReais(orcamento)} por mês, os juros crescem mais rápido que o pagamento e a dívida não acaba. Tente um valor maior.`;
  }

  const ordem = ordenarPorCusto(p.dividas)
    .map((d, i) => `${i + 1}. ${d.nome}`)
    .join("\n");

  const partes = [
    `Pagando *${formatarReais(orcamento)} por mês*, você quita tudo em *${prazo(sim.meses)}* e paga ${formatarReais(sim.jurosTotal)} de juros no caminho.`,
    `Ordem de ataque, da mais cara para a mais barata:\n${ordem}\nPague o mínimo de todas e jogue o que sobrar na primeira.`,
  ];

  if (orcamento > minimos) {
    const soMinimo = simularQuitacao(p.dividas, minimos);
    partes.push(
      soMinimo.quitavel
        ? `Só com o mínimo seriam ${prazo(soMinimo.meses)} e ${formatarReais(soMinimo.jurosTotal)} de juros. A diferença é de *${formatarReais(soMinimo.jurosTotal - sim.jurosTotal)}*.`
        : `Só com o mínimo (${formatarReais(minimos)}) a dívida não acaba nunca.`,
    );
  }
  partes.push(AVISO);
  return partes.join("\n\n");
}

function prazo(meses: number): string {
  return meses === 1 ? "1 mês" : `${meses} meses`;
}
