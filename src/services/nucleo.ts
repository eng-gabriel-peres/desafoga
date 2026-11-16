/**
 * Operações sobre os dados do Desafoga, sem rede e sem armazenamento.
 * O servidor (API e WhatsApp) e a versão local da demonstração usam as mesmas
 * funções: quem chama carrega o banco, aplica a operação e salva.
 */
import {
  materializar,
  PROFISSIONAIS,
  RESPONSAVEL_DA_DEMO,
  SEMENTES,
  type DadosDaPessoa,
} from "@/fixtures/desafoga";
import { ESTADO_INICIAL, type ContextoAssistente, type Efeito, type EstadoConversa, type Resposta } from "@/lib/assistente/conversa";
import { reais } from "@/lib/assistente/textos";
import type { Fatura } from "@/lib/finance";
import type { Anotacao, Aviso, Classificacao, Compra, Memoria, Mensagem, NovaCompra, Plano, Profissional } from "./tipos";

export type Canal = "app" | "whatsapp";

export interface Banco {
  versao: 2;
  pessoas: Record<string, DadosDaPessoa>;
  /** Conversa em andamento (compra esperando emoção, por exemplo), por canal. */
  estados: Record<string, Record<Canal, EstadoConversa>>;
  /** Últimas trocas do WhatsApp, para a IA dar continuidade. A conversa do app fica em `conversa`. */
  historicoWhatsapp: Record<string, { de: "pessoa" | "assistente"; texto: string }[]>;
  /** Número de WhatsApp cadastrado por pessoa (só dígitos, com 55). */
  telefones: Record<string, string | null>;
}

/** A partir deste valor, o responsável recebe um aviso de compra alta. */
export const COMPRA_ALTA = 20000;
const TAMANHO_DO_HISTORICO = 12;

export function novoBanco(agora = new Date()): Banco {
  const ids = SEMENTES.map((s) => s.persona.id);
  return {
    versao: 2,
    pessoas: Object.fromEntries(SEMENTES.map((s) => [s.persona.id, materializar(s, agora)])),
    estados: Object.fromEntries(ids.map((id) => [id, { app: ESTADO_INICIAL, whatsapp: ESTADO_INICIAL }])),
    historicoWhatsapp: Object.fromEntries(ids.map((id) => [id, []])),
    telefones: Object.fromEntries(ids.map((id) => [id, null])),
  };
}

export function responsavel(): Profissional {
  return PROFISSIONAIS.find((p) => p.id === RESPONSAVEL_DA_DEMO) ?? PROFISSIONAIS[0];
}

export function pessoa(banco: Banco, id: string): DadosDaPessoa {
  // hasOwn: um id como "__proto__" não pode chegar ao protótipo do objeto.
  if (!Object.hasOwn(banco.pessoas, id)) throw new Error(`Pessoa não encontrada: ${id}`);
  return banco.pessoas[id];
}

let contador = 0;
export function novoId(prefixo: string): string {
  contador = (contador + 1) % 1e6;
  return `${prefixo}-${Date.now().toString(36)}-${contador}-${Math.random().toString(36).slice(2, 6)}`;
}

export function avisar(banco: Banco, id: string, tipo: Aviso["tipo"], texto: string, agora = new Date()): void {
  pessoa(banco, id).avisos.unshift({ id: novoId("aviso"), pessoaId: id, tipo, texto, quando: agora.toISOString() });
}

export function registrarCompra(banco: Banco, id: string, nova: NovaCompra, quando = new Date()): Compra {
  const dados = pessoa(banco, id);
  const compra: Compra = { ...nova, id: novoId("compra"), quando: quando.toISOString(), avaliacaoProfissional: null };
  dados.compras.push(compra);
  if (compra.valor >= COMPRA_ALTA) {
    avisar(banco, id, "gasto-alto", `${dados.persona.apelido} registrou uma compra de ${reais(compra.valor)} (${compra.item}).`, quando);
  }
  return compra;
}

export function salvarPlano(banco: Banco, id: string, mudancas: Partial<Pick<Plano, "valorMensal" | "estrategia">>): Plano {
  const dados = pessoa(banco, id);
  dados.plano = { ...dados.plano, ...mudancas };
  return dados.plano;
}

export function mensagem(de: Mensagem["de"], texto: string, extra: Partial<Mensagem> = {}, agora = new Date()): Mensagem {
  return { id: novoId("msg"), de, texto, quando: agora.toISOString(), ...extra };
}

/** O profissional sugere um valor mensal: vira aviso e mensagem da Luana para a pessoa. */
export function sugerirValor(banco: Banco, id: string, valor: number): void {
  const dados = pessoa(banco, id);
  dados.plano.valorSugerido = valor;
  avisar(banco, id, "sugestao", `${responsavel().nome} sugeriu pagar ${reais(valor)} por mês nas dívidas.`);
  dados.conversa.push(
    mensagem(
      "assistente",
      `${responsavel().nome} sugeriu pagar ${reais(valor)} por mês nas dívidas. Quer ver como fica? Abra Dívidas ou me escreva: plano.`,
    ),
  );
}

/** Guarda a fatura lida e registra as compras novas que ganharam emoção e necessidade. */
export function salvarFatura(banco: Banco, id: string, fatura: Fatura, classificacoes: Record<string, Classificacao> = {}): void {
  const lancamentos = fatura.lancamentos.map((l) => {
    const c = classificacoes[l.id];
    if (l.tipo !== "compra" || l.compraId || !c?.emocao || !c.necessidade) return l;
    const compra = registrarCompra(
      banco,
      id,
      {
        item: l.descricao.charAt(0) + l.descricao.slice(1).toLowerCase(),
        categoria: l.categoria ?? "Outro",
        valor: l.valor,
        emocao: c.emocao,
        necessidade: c.necessidade,
        via: "fatura",
      },
      new Date(`${l.data}T12:00:00`),
    );
    return { ...l, compraId: compra.id };
  });
  pessoa(banco, id).faturas.push({ ...fatura, lancamentos });
}

export function salvarMemoria(banco: Banco, id: string, mudancas: Partial<Omit<Memoria, "anotacoes">>): Memoria {
  const dados = pessoa(banco, id);
  dados.memoria = { ...dados.memoria, ...mudancas };
  return dados.memoria;
}

export function anotar(banco: Banco, id: string, nova: Omit<Anotacao, "id" | "quando">): Anotacao {
  const anotacao = { ...nova, id: novoId("nota"), quando: new Date().toISOString() };
  pessoa(banco, id).memoria.anotacoes.push(anotacao);
  return anotacao;
}

export function apagarAnotacao(banco: Banco, id: string, anotacaoId: string): void {
  const memoria = pessoa(banco, id).memoria;
  memoria.anotacoes = memoria.anotacoes.filter((a) => a.id !== anotacaoId);
}

export function avisosDe(banco: Banco, id?: string): Aviso[] {
  const lista = id ? [pessoa(banco, id)] : Object.values(banco.pessoas);
  return lista.flatMap((d) => d.avisos).sort((a, b) => b.quando.localeCompare(a.quando));
}

export function contextoDoAssistente(banco: Banco, id: string, canal: Canal, agora = new Date()): ContextoAssistente {
  const d = pessoa(banco, id);
  return {
    pessoa: d.persona,
    memoria: d.memoria,
    profissionais: PROFISSIONAIS,
    responsavel: responsavel(),
    compras: d.compras,
    dividas: d.dividas,
    plano: d.plano,
    faturas: d.faturas,
    agora,
    canal,
  };
}

export function estadoDa(banco: Banco, id: string, canal: Canal): EstadoConversa {
  return banco.estados[id]?.[canal] ?? ESTADO_INICIAL;
}

export function guardarEstado(banco: Banco, id: string, canal: Canal, estado: EstadoConversa): void {
  banco.estados[id] = { ...(banco.estados[id] ?? { app: ESTADO_INICIAL, whatsapp: ESTADO_INICIAL }), [canal]: estado };
}

export function aplicarEfeitos(banco: Banco, id: string, efeitos: Efeito[], agora = new Date()): void {
  for (const e of efeitos) {
    if (e.tipo === "registrar-compra") registrarCompra(banco, id, e.compra, agora);
    else avisar(banco, id, e.aviso.tipo, e.aviso.texto, agora);
  }
}

/** Grava a troca na conversa do canal: no app, as bolhas; no WhatsApp, o histórico curto da IA. */
export function guardarTroca(banco: Banco, id: string, canal: Canal, texto: string, respostas: Resposta[], agora = new Date()): Mensagem[] {
  const dados = pessoa(banco, id);
  const novas = respostas.map((r) =>
    mensagem("assistente", r.texto, r.respostasRapidas ? { respostasRapidas: r.respostasRapidas } : {}, agora),
  );
  if (canal === "app") {
    dados.conversa.push(...novas);
  } else {
    banco.historicoWhatsapp[id] = [
      ...(banco.historicoWhatsapp[id] ?? []),
      { de: "pessoa" as const, texto: texto.slice(0, 400) },
      ...respostas.map((r) => ({ de: "assistente" as const, texto: r.texto.slice(0, 400) })),
    ].slice(-TAMANHO_DO_HISTORICO);
  }
  return novas;
}

/** Mensagem da pessoa no chat do app, antes da resposta (as respostas rápidas antigas somem). */
export function guardarMensagemDoApp(banco: Banco, id: string, texto: string): void {
  const dados = pessoa(banco, id);
  dados.conversa.forEach((m) => delete m.respostasRapidas);
  dados.conversa.push(mensagem("pessoa", texto));
}

/** Conversa recente do canal, em texto, para a IA. */
export function conversaRecente(banco: Banco, id: string, canal: Canal): string {
  const linhas =
    canal === "app"
      ? pessoa(banco, id).conversa.slice(-TAMANHO_DO_HISTORICO).map((m) => ({ de: m.de, texto: m.texto }))
      : (banco.historicoWhatsapp[id] ?? []);
  return linhas.map((l) => `${l.de === "pessoa" ? "Pessoa" : "Luana"}: ${l.texto}`).join("\n");
}
