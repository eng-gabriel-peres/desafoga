/**
 * Conversa da Luana, a assistente do Desafoga, por regras locais.
 *
 * `responder` é pura: recebe o estado da conversa, a mensagem e o contexto, e
 * devolve o novo estado, as respostas e os efeitos (registrar compra, avisar o
 * responsável). Quem chama aplica os efeitos. Todo número vem de `lib/finance`.
 */
import { lerValorEmReais } from "@/lib/dinheiro";
import {
  compararExtra,
  chaveDoDia,
  comprasDoDia,
  dividaMaisCara,
  encargosDasFaturas,
  jurosMensaisTotais,
  notaMedia,
  rotuloDaNota,
  simularQuitacao,
  somaDosMinimos,
  somaDosValores,
  type Categoria,
  type Compra,
  type Divida,
  type Emocao,
  type Fatura,
  type Necessidade,
} from "@/lib/finance";
import type {
  Memoria,
  NovaCompra,
  Persona,
  Plano,
  Profissional,
  RespostaRapida,
  TipoAviso,
} from "@/services/tipos";
import { adivinharCategoria, entender, lerEmocao, lerNecessidade } from "./entender";
import {
  AVISO_EDUCATIVO,
  NOME_DA_EMOCAO,
  NOME_DA_ESTRATEGIA,
  RESPOSTA_DA_NECESSIDADE,
  mesDaqui,
  meses,
  reais,
  umaCasa,
} from "./textos";

export interface ContextoAssistente {
  pessoa: Persona;
  memoria: Memoria;
  profissionais: Profissional[];
  /** Quem recebe os avisos de sofrimento intenso. */
  responsavel: Profissional;
  compras: Compra[];
  dividas: Divida[];
  plano: Plano;
  faturas: Fatura[];
  agora: Date;
  /** Por onde a conversa acontece: a compra registrada guarda a origem. */
  canal: "app" | "whatsapp";
}

/** Compra que a pessoa contou e ainda falta classificar. */
export interface CompraContada {
  item: string;
  valor: number;
  categoria?: Categoria;
}

export type EstadoConversa =
  | { etapa: "livre" }
  | { etapa: "valor"; item: string }
  | { etapa: "emocao"; compras: CompraContada[] }
  | { etapa: "necessidade"; compras: CompraContada[]; emocao: Emocao };

export const ESTADO_INICIAL: EstadoConversa = { etapa: "livre" };

export type Efeito =
  | { tipo: "registrar-compra"; compra: NovaCompra }
  | { tipo: "avisar-responsavel"; aviso: { tipo: TipoAviso; texto: string } };

export interface Resposta {
  texto: string;
  respostasRapidas?: RespostaRapida[];
}

export interface Resultado {
  estado: EstadoConversa;
  respostas: Resposta[];
  efeitos: Efeito[];
}

export const RAPIDAS_EMOCAO: RespostaRapida[] = ([1, 2, 3, 4, 5] as Emocao[]).map((e) => ({
  rotulo: NOME_DA_EMOCAO[e],
  emocao: e,
}));
export const RAPIDAS_NECESSIDADE: RespostaRapida[] = (["sim", "nao", "talvez"] as Necessidade[]).map((n) => ({
  rotulo: RESPOSTA_DA_NECESSIDADE[n],
}));

const PERGUNTA_EMOCAO = "Como você estava na hora da compra? Toque numa carinha ou responda de 1 (muito triste) a 5 (muito feliz).";

const tem = (ctx: ContextoAssistente, caracteristica: string) =>
  ctx.memoria.caracteristicas.includes(caracteristica);

const so = (estado: EstadoConversa, ...respostas: Resposta[]): Resultado => ({ estado, respostas, efeitos: [] });

/** Mais de uma frase vira só a primeira quando a pessoa prefere mensagens curtas. */
function encurtar(ctx: ContextoAssistente, frases: string[]): string {
  const lista = frases.filter(Boolean);
  return (tem(ctx, "Prefere mensagens curtas") ? lista.slice(0, 2) : lista).join(" ");
}

function valorDoPlano(ctx: ContextoAssistente): number {
  return Math.max(ctx.plano.valorMensal, somaDosMinimos(ctx.dividas));
}

function respostaPlano(ctx: ContextoAssistente): string {
  if (!ctx.dividas.length) return "Você não tem dívidas cadastradas. Se quiser, me mande uma fatura para eu ler.";
  const valor = valorDoPlano(ctx);
  const r = simularQuitacao(ctx.dividas, valor, ctx.plano.estrategia);
  const primeira = ctx.dividas.find((d) => d.id === r.ordemDeQuitacao[0]);
  const fim = r.quitavel
    ? `Você fica livre das dívidas em ${meses(r.meses)} (${mesDaqui(ctx.agora, r.meses)})`
    : "Com esse valor, as dívidas não terminam em 30 anos";
  // Para quem se assusta com números grandes, mostramos só valores por mês.
  const juros = tem(ctx, "Se assusta com números grandes") || !r.quitavel ? "" : `, com ${reais(r.jurosTotal)} de juros até lá`;
  return [
    `Seu plano: pagar ${reais(valor)} por mês, ${NOME_DA_ESTRATEGIA[ctx.plano.estrategia]}${primeira ? ` (começando por ${primeira.nome})` : ""}.`,
    `${fim}${juros}.`,
    AVISO_EDUCATIVO,
    "Quer testar outro valor? Pergunte, por exemplo: e se eu pagar 200 a mais?",
  ].join("\n");
}

function respostaExtra(ctx: ContextoAssistente, extra: number): string {
  if (!ctx.dividas.length) return "Você não tem dívidas cadastradas, então não há o que simular.";
  const c = compararExtra(ctx.dividas, extra, ctx.plano.estrategia);
  const nome = ctx.pessoa.apelido;
  if (!c.comExtra.quitavel) {
    return `${nome}, mesmo com ${reais(extra)} a mais por mês as dívidas não terminam em 30 anos. Vale conversar com quem te acompanha. ${AVISO_EDUCATIVO}`;
  }
  const antes = c.soMinimo.quitavel && c.mesesAMenos > 0 ? `, ${meses(c.mesesAMenos)} antes do que pagando só o mínimo` : "";
  return [
    `Boa pergunta, ${nome}. Pagando ${reais(extra)} a mais por mês, você fica livre das dívidas em ${meses(c.comExtra.meses)} (${mesDaqui(ctx.agora, c.comExtra.meses)})${antes}.`,
    `Isso economiza ${reais(c.economiaJuros)} em juros.`,
    AVISO_EDUCATIVO,
  ].join("\n");
}

function respostaJuros(ctx: ContextoAssistente): string {
  if (!ctx.dividas.length) return "Você não tem dívidas cadastradas. Se quiser, me mande uma fatura para eu ler.";
  const enc = encargosDasFaturas(ctx.faturas);
  const mais = dividaMaisCara(ctx.dividas);
  const doMes = enc.total
    ? `Neste mês, pelas faturas lidas, foram ${reais(enc.total)} em juros, IOF e tarifas.`
    : `Hoje suas dívidas geram cerca de ${reais(jurosMensaisTotais(ctx.dividas))} de juros por mês.`;
  return [
    doMes,
    mais ? `A mais cara é ${mais.nome}.` : "",
    "Quer ver o que muda pagando um pouco mais? Pergunte, por exemplo: e se eu pagar 200 a mais?",
  ]
    .filter(Boolean)
    .join("\n");
}

function respostaResumo(ctx: ContextoAssistente, compras = ctx.compras): string {
  const hoje = comprasDoDia(compras, chaveDoDia(ctx.agora));
  const nota = notaMedia(hoje);
  if (nota === null) return "Hoje você ainda não registrou compras. Comprou algo? É só me contar.";
  return [
    `Hoje você registrou ${hoje.length} ${hoje.length === 1 ? "compra" : "compras"}, total de ${reais(somaDosValores(hoje))}.`,
    `Sua nota do dia: ${umaCasa(nota)} (${rotuloDaNota(nota)}).`,
  ].join("\n");
}

function respostaLivre(ctx: ContextoAssistente, texto: string): string {
  const nome = ctx.pessoa.apelido;
  const t = texto.toLowerCase();
  const noite = ctx.agora.getHours() >= 21 || ctx.agora.getHours() < 5;
  const triste = /(triste|mal\b|ansios|chatead|cansad|sozinh|estressad|nervos|pra baixo|desanimad)/.test(t);
  const bem = /(feliz|bem\b|otimo|ótimo|consegui|paguei|melhor)/.test(t);

  if (triste) {
    const abertura = {
      acolhedor: `Sinto muito que você esteja assim, ${nome}. Obrigada por me contar.`,
      direto: `Entendi, ${nome}. Dias assim acontecem.`,
      motivador: `${nome}, que bom que você me chamou. Isso já é cuidar de si.`,
    }[ctx.memoria.tom];
    return encurtar(ctx, [
      abertura,
      "Quer me contar o que aconteceu?",
      tem(ctx, "Compra quando está triste") || tem(ctx, "Compra quando está ansiosa")
        ? "E se bater vontade de comprar algo, me chama antes, combinado?"
        : "",
      noite && tem(ctx, "Compra à noite") ? "A noite costuma ser a hora mais difícil. Que tal deixar o celular longe das lojas até amanhã?" : "",
    ]);
  }
  if (bem) {
    return encurtar(ctx, [
      `Que bom ouvir isso, ${nome}!`,
      tem(ctx, "Responde bem a elogios") ? "Você está mandando muito bem." : "",
      ctx.memoria.tom === "motivador" && ctx.memoria.objetivo ? `Cada passo conta para: ${ctx.memoria.objetivo.toLowerCase()}.` : "",
      "Quer me contar mais?",
    ]);
  }
  return encurtar(ctx, [
    `Estou aqui para te ouvir, ${nome}.`,
    "Pode me contar como está, registrar uma compra (comprei pão 12), pedir seu resumo ou perguntar das dívidas, por exemplo: e se eu pagar 200 a mais?",
  ]);
}

function respostaVontade(ctx: ContextoAssistente): string {
  const nome = ctx.pessoa.apelido;
  return encurtar(ctx, [
    `Obrigada por me chamar antes, ${nome}. Isso já é um grande passo.`,
    tem(ctx, "Compra quando está triste") ? "Como você está se sentindo agora? Às vezes a vontade vem junto com um dia difícil." : "",
    "Que tal deixar no carrinho e decidir amanhã?",
  ]);
}

function respostaSofrimento(ctx: ContextoAssistente): Resultado {
  const nome = ctx.pessoa.apelido;
  return {
    estado: ESTADO_INICIAL,
    respostas: [
      {
        texto: [
          `${nome}, obrigada por me contar. Você não precisa passar por isso sem companhia.`,
          "Se estiver em perigo agora, ligue 192 (SAMU). Para conversar com alguém agora, ligue 188 (CVV), de graça e 24 horas por dia.",
          `Avisei ${ctx.responsavel.nome} para entrar em contato com você.`,
        ].join("\n"),
      },
    ],
    efeitos: [
      {
        tipo: "avisar-responsavel",
        aviso: {
          tipo: "sofrimento",
          texto: `${nome} escreveu algo que indica sofrimento intenso no chat. Entre em contato o quanto antes.`,
        },
      },
    ],
  };
}

function registrar(ctx: ContextoAssistente, contadas: CompraContada[], emocao: Emocao, necessidade: Necessidade): Resultado {
  const novas: NovaCompra[] = contadas.map((c) => ({
    item: c.item,
    categoria: c.categoria ?? adivinharCategoria(c.item),
    valor: c.valor,
    emocao,
    necessidade,
    via: ctx.canal,
  }));
  const registradas: Compra[] = novas.map((c, i) => ({ ...c, id: `nova-${i}`, quando: ctx.agora.toISOString(), avaliacaoProfissional: null }));
  const hoje = comprasDoDia([...ctx.compras, ...registradas], chaveDoDia(ctx.agora));
  const nota = notaMedia(hoje) ?? emocao;
  const linhas = [
    novas.length === 1
      ? `Anotado: ${novas[0].item}, ${reais(novas[0].valor)}.`
      : `Anotado:\n${novas.map((c) => `• ${c.item}, ${reais(c.valor)}`).join("\n")}`,
    `Você estava: ${NOME_DA_EMOCAO[emocao]}`,
    `${novas.length === 1 ? "Era necessária" : "Eram necessárias"}: ${RESPOSTA_DA_NECESSIDADE[necessidade]}`,
    "",
    `Sua nota de hoje agora é ${umaCasa(nota)} (${rotuloDaNota(nota)}).`,
  ];
  if (emocao <= 2 && necessidade === "nao") {
    linhas.push("", "Se quiser, me conta o que aconteceu antes dessa compra. Isso ajuda a entender o padrão.");
  }
  return {
    estado: ESTADO_INICIAL,
    respostas: [{ texto: linhas.join("\n") }],
    efeitos: novas.map((compra) => ({ tipo: "registrar-compra" as const, compra })),
  };
}

/** Começa o registro de compras já com valor: pergunta a emoção. */
export function iniciarRegistro(compras: CompraContada[]): Resultado {
  const texto =
    compras.length === 1
      ? PERGUNTA_EMOCAO
      : `Anotei ${compras.length} compras: ${compras.map((c) => `${c.item} (${reais(c.valor)})`).join(", ")}. Como você estava quando fez essas compras? Toque numa carinha ou responda de 1 (muito triste) a 5 (muito feliz).`;
  return so({ etapa: "emocao", compras }, { texto, respostasRapidas: RAPIDAS_EMOCAO });
}

/** Continua o registro de uma compra começado numa mensagem anterior. */
function continuarCompra(estado: Exclude<EstadoConversa, { etapa: "livre" }>, texto: string, ctx: ContextoAssistente): Resultado {
  if (estado.etapa === "valor") {
    const valor = lerValorEmReais(texto);
    if (!valor) return so(estado, { texto: "Não entendi o valor. Escreva só o número, por exemplo: 49,90" });
    return iniciarRegistro([{ item: estado.item, valor }]);
  }
  if (estado.etapa === "emocao") {
    const emocao = lerEmocao(texto);
    if (!emocao) return so(estado, { texto: "Responda com um número de 1 a 5, ou toque numa carinha.", respostasRapidas: RAPIDAS_EMOCAO });
    const pergunta = estado.compras.length === 1 ? "Essa compra era necessária?" : "Essas compras eram necessárias?";
    return so({ ...estado, etapa: "necessidade", emocao }, { texto: pergunta, respostasRapidas: RAPIDAS_NECESSIDADE });
  }
  const necessidade = lerNecessidade(texto);
  if (!necessidade) return so(estado, { texto: "Responda Sim, Não ou Não sei.", respostasRapidas: RAPIDAS_NECESSIDADE });
  return registrar(ctx, estado.compras, estado.emocao, necessidade);
}

export function responder(estado: EstadoConversa, texto: string, ctx: ContextoAssistente): Resultado {
  const intencao = entender(texto);
  if (intencao.tipo === "sofrimento") return respostaSofrimento(ctx);
  if (estado.etapa !== "livre") return continuarCompra(estado, texto, ctx);

  switch (intencao.tipo) {
    case "plano":
      return so(estado, { texto: respostaPlano(ctx) });
    case "extra":
      return so(estado, { texto: respostaExtra(ctx, intencao.valor) });
    case "juros":
      return so(estado, { texto: respostaJuros(ctx) });
    case "resumo":
      return so(estado, { texto: respostaResumo(ctx) });
    case "compra":
      if (intencao.valor === null) {
        return so({ etapa: "valor", item: intencao.item }, { texto: `Quanto custou ${intencao.item.toLowerCase()}?` });
      }
      return iniciarRegistro([{ item: intencao.item, valor: intencao.valor }]);
    case "vontade-de-comprar":
      return so(estado, { texto: respostaVontade(ctx) });
    default:
      return so(estado, { texto: respostaLivre(ctx, texto) });
  }
}
