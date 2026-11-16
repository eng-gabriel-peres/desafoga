/**
 * Texto de contexto que a assistente recebe: a memória escrita pelos
 * profissionais mais os números calculados pelo código. É o que vai para o
 * modelo quando a IA real entrar; hoje aparece em "Ver o que o assistente recebe".
 */
import {
  chaveDoDia,
  compararExtra,
  comprasDoDia,
  custoEmocional,
  dividaMaisCara,
  encargosDasFaturas,
  jurosMensaisTotais,
  notaMedia,
  projecaoSoMinimo,
  rotuloDaNota,
  simularQuitacao,
  somaDosMinimos,
} from "@/lib/finance";
import type { ContextoAssistente } from "./conversa";
import { NOME_DA_ESTRATEGIA, TONS, mesDaqui, meses, percentual, reais, umaCasa } from "./textos";

function numerosDasDividas(ctx: ContextoAssistente): string {
  const { dividas, plano, faturas, agora } = ctx;
  if (!dividas.length) return "Sem dívidas cadastradas.";
  const minimos = somaDosMinimos(dividas);
  const valor = Math.max(plano.valorMensal, minimos);
  const doPlano = simularQuitacao(dividas, valor, plano.estrategia);
  const soMinimo = simularQuitacao(dividas, minimos, plano.estrategia);
  const enc = encargosDasFaturas(faturas);
  const mais = dividaMaisCara(dividas);
  const custo = custoEmocional(faturas, ctx.compras);
  const simulacoes = [10000, 20000, 50000].map((extra) => {
    const c = compararExtra(dividas, extra, plano.estrategia);
    return `pagando ${reais(extra)} a mais por mês: livre em ${meses(c.comExtra.meses)} (${mesDaqui(agora, c.comExtra.meses)}), economia de ${reais(c.economiaJuros)} em juros`;
  });

  return [
    `Dívidas: ${dividas.map((d) => `${d.nome} (${reais(d.saldo)}, ${percentual(d.taxaMensal)} ao mês, parcela mínima ${reais(d.parcelaMinima)})`).join("; ")}.`,
    `Soma das parcelas mínimas: ${reais(minimos)} por mês. Juros gerados por mês hoje: cerca de ${reais(jurosMensaisTotais(dividas))}.`,
    enc.total ? `Neste mês, pelas faturas lidas: ${reais(enc.juros)} de juros, ${reais(enc.iof)} de IOF e ${reais(enc.tarifas)} de tarifas.` : "",
    mais ? `A mais cara é ${mais.nome}, com ${percentual(mais.taxaMensal)} ao mês.` : "",
    `Pagando só o mínimo: ${soMinimo.quitavel ? `livre em ${meses(soMinimo.meses)}, com ${reais(soMinimo.jurosTotal)} de juros no total` : "a dívida não termina"}; nos próximos 12 meses seriam cerca de ${reais(projecaoSoMinimo(dividas).jurosTotal)} de juros.`,
    `Plano atual: pagar ${reais(valor)} por mês, ${NOME_DA_ESTRATEGIA[plano.estrategia]}: ${doPlano.quitavel ? `livre em ${meses(doPlano.meses)} (${mesDaqui(agora, doPlano.meses)}), ${reais(doPlano.jurosTotal)} de juros no total` : "não quita em 30 anos"}.`,
    custo ? `Custo emocional: cerca de ${reais(custo.custoTriste)} dos juros do cartão vêm de compras feitas com emoção 1 ou 2.` : "",
    `Simulações: ${simulacoes.join("; ")}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function montarContexto(ctx: ContextoAssistente): string {
  const { pessoa, memoria, profissionais } = ctx;
  const autor = (id: string) => profissionais.find((p) => p.id === id);
  const publicas = memoria.anotacoes.filter((a) => !a.privada);
  const privadas = memoria.anotacoes.filter((a) => a.privada);
  const quem = [...new Set(memoria.anotacoes.map((a) => a.autorId))]
    .map((id) => autor(id))
    .filter((p) => p !== undefined)
    .map((p) => `${p.nome} (${p.papel})`);
  if (!quem.length) quem.push(`${ctx.responsavel.nome} (${ctx.responsavel.papel})`);

  const hoje = comprasDoDia(ctx.compras, chaveDoDia(ctx.agora));
  const nota = notaMedia(hoje);
  const tom = TONS[memoria.tom];

  return `Você é a Luana, assistente do Desafoga, um app brasileiro que acompanha compras, emoções e dívidas. Você conversa com ${pessoa.nome} pelo app e pelo WhatsApp.

COMO RESPONDER
- No máximo 4 frases curtas, em português do Brasil simples, para qualquer idade.
- Tom: ${tom.nome}. ${tom.descricao}
- Nunca dê sermão nem faça diagnóstico. Valide o sentimento antes de sugerir algo.
- Sobre dinheiro, use SOMENTE os números da seção NÚMEROS DO SISTEMA, exatamente como estão. Nunca calcule nem invente valores. Ao citar números, diga que é uma simulação educativa.
- Não recomende empréstimo, cartão, investimento ou qualquer produto financeiro.
- Se a pessoa indicar sofrimento intenso, acolha, indique o CVV (188) e o SAMU (192) e avise que o profissional responsável foi chamado.

QUEM ACOMPANHA: ${quem.join(", ")}.
JEITO DE SER (registrado pelos profissionais): ${memoria.caracteristicas.join("; ") || "nada registrado"}.
OBJETIVO ATUAL: ${memoria.objetivo || "não definido"}.
EVITAR: ${memoria.evitar || "nada específico"}.
NOTAS DOS PROFISSIONAIS:
${publicas.map((a) => `- ${autor(a.autorId)?.nome ?? "Profissional"} (${autor(a.autorId)?.papel ?? ""}): ${a.texto}`).join("\n") || "- nenhuma"}${
    // O texto das notas privadas nunca vai para a IA: a resposta é vista pela
    // pessoa e um modelo não guarda segredo com confiança. Vai só o efeito no tom.
    privadas.length
      ? "\nOBSERVAÇÃO: há anotações privadas recentes dos profissionais. Seja ainda mais cuidadosa e acolhedora, sem mencionar isso."
      : ""
  }

COMO A PESSOA ESTÁ HOJE
- Compras hoje: ${hoje.length}${nota !== null ? `, nota do dia ${umaCasa(nota)} de 5 (${rotuloDaNota(nota)})` : ""}.

NÚMEROS DO SISTEMA (calculados por código; use exatamente)
${numerosDasDividas(ctx)}`;
}
