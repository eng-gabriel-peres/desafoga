/**
 * Eventos: desafios em grupo e encontros presenciais criados por um
 * profissional, com mural e ranking. Quem vê: o profissional dono e quem
 * participa. Dos outros participantes a pessoa vê só nome e pontos, nunca as
 * compras nem os dias. Reexportado por `repositorio.ts`.
 */
import { mensagemDeConviteParaEncontro, mensagemDeEntradaNoDesafio } from "@/lib/assistente/textos";
import {
  andamentoNoDesafio,
  classificar,
  situacaoDoEvento,
  type AndamentoNoDesafio,
  type Categoria,
  type CompraNoDia,
  type Emocao,
  type Necessidade,
  type RegraDoDesafio,
  type SituacaoDoEvento,
} from "@/lib/finance";
import { hojeEmBrasilia } from "@/lib/luana/lancamentos";
import { prisma } from "./prisma";
import { mensagemDaLuana, NaoEncontrado } from "./repositorio";

export type TipoDeEvento = "desafio" | "presencial";
export type TipoDePost = "recado" | "dica" | "conquista" | "desabafo" | "aviso" | "sistema";
export type RespostaAoEncontro = "vou" | "talvez" | "nao";

export interface DadosDoEvento {
  tipo: TipoDeEvento;
  nome: string;
  descricao: string;
  regra: RegraDoDesafio | null;
  categoria: Categoria | null;
  /** Centavos (regra "limite-dia"). */
  limite: number | null;
  /** "YYYY-MM-DD" (desafio). */
  inicio: string | null;
  fim: string | null;
  /** "YYYY-MM-DD" e "HH:MM" (presencial). */
  data: string | null;
  hora: string | null;
  local: string | null;
  premio: string;
  mostrarRanking: boolean;
}

export interface ParticipanteVisto {
  pessoaId: string;
  nome: string;
  apelido: string;
  cor: string;
  entrouEm: string;
  resposta: RespostaAoEncontro | null;
}

export interface PostDoMural {
  id: string;
  autor: { tipo: "pessoa" | "profissional" | "sistema"; nome: string; cor: string; papel: string | null };
  tipo: TipoDePost;
  texto: string;
  fixado: boolean;
  quando: string;
  apoios: number;
  apoiei: boolean;
  /** Escrito por quem está vendo. */
  meu: boolean;
}

export interface LinhaDoRanking {
  pessoaId: string;
  nome: string;
  apelido: string;
  cor: string;
  pontos: number;
  ok: number;
  contados: number;
  sequencia: number;
  posicao: number;
}

export interface SalaDoEvento extends DadosDoEvento {
  id: string;
  profissional: { nome: string; cor: string };
  participantes: ParticipanteVisto[];
  situacao: SituacaoDoEvento;
  /** Porcentagem dos dias cumpridos pelo grupo; null sem dias para contar. */
  grupo: number | null;
  /** null: presencial, ou ranking escondido para quem participa. */
  ranking: LinhaDoRanking[] | null;
  /** Dias de cada um: todos para o dono, só os próprios para quem participa. */
  andamento: (AndamentoNoDesafio & { pessoaId: string })[];
  posts: PostDoMural[];
  totalDePosts: number;
  souDono: boolean;
}

/** Quem está olhando: uma pessoa ou um profissional. */
export type Quem = { pessoaId: string; profissionalId?: undefined } | { profissionalId: string; pessoaId?: undefined };

const quemId = (q: Quem) => q.pessoaId ?? q.profissionalId!;
const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const COMPLETO = {
  profissional: { select: { nome: true, cor: true } },
  participantes: { include: { pessoa: { select: { nome: true, apelido: true, cor: true } } }, orderBy: { entrouEm: "asc" as const } },
  _count: { select: { posts: { where: { tipo: { not: "sistema" } } } } },
};

type EventoDoBanco = NonNullable<Awaited<ReturnType<typeof buscar>>>;
const buscar = (id: string) => prisma().evento.findUnique({ where: { id }, include: COMPLETO });

function dadosDe(e: EventoDoBanco): DadosDoEvento {
  return {
    tipo: e.tipo as TipoDeEvento,
    nome: e.nome,
    descricao: e.descricao,
    regra: e.regra as RegraDoDesafio | null,
    categoria: e.categoria as Categoria | null,
    limite: e.limite,
    inicio: e.inicio,
    fim: e.fim,
    data: e.data,
    hora: e.hora,
    local: e.local,
    premio: e.premio,
    mostrarRanking: e.mostrarRanking,
  };
}

/** O evento, se `quem` pode ver; senão "não encontrado" (não revela que existe). */
async function visivel(id: string, quem: Quem): Promise<EventoDoBanco> {
  const e = await buscar(id);
  const pode = e && (quem.profissionalId ? e.profissionalId === quem.profissionalId : e.participantes.some((p) => p.pessoaId === quem.pessoaId));
  if (!pode) throw new NaoEncontrado("Evento não encontrado.");
  return e;
}

async function doDono(id: string, profissionalId: string): Promise<EventoDoBanco> {
  return visivel(id, { profissionalId });
}

async function montarSala(e: EventoDoBanco, quem: Quem, agora: Date, comPosts: boolean): Promise<SalaDoEvento> {
  const hoje = hojeEmBrasilia(agora);
  const dados = dadosDe(e);
  const souDono = quem.profissionalId === e.profissionalId;
  const participantes: ParticipanteVisto[] = e.participantes.map((p) => ({
    pessoaId: p.pessoaId,
    nome: p.pessoa.nome,
    apelido: p.pessoa.apelido,
    cor: p.pessoa.cor,
    entrouEm: p.entrouEm,
    resposta: p.resposta as RespostaAoEncontro | null,
  }));

  let ranking: LinhaDoRanking[] | null = null;
  let andamento: SalaDoEvento["andamento"] = [];
  let grupo: number | null = null;
  if (dados.tipo === "desafio" && dados.inicio && dados.fim && dados.regra) {
    const desafio = { inicio: dados.inicio, fim: dados.fim, regra: dados.regra, categoria: dados.categoria, limite: dados.limite };
    const compras = await prisma().compra.findMany({
      where: { pessoaId: { in: participantes.map((p) => p.pessoaId) }, quando: { gte: new Date(`${somarDias(dados.inicio, -1)}T00:00:00Z`) } },
      select: { pessoaId: true, categoria: true, valor: true, emocao: true, necessidade: true, quando: true },
    });
    const todos = participantes.map((p) => {
      const minhas: CompraNoDia[] = compras
        .filter((c) => c.pessoaId === p.pessoaId)
        .map((c) => ({
          dia: hojeEmBrasilia(c.quando),
          categoria: c.categoria as Categoria,
          valor: c.valor,
          emocao: c.emocao as Emocao | null,
          necessidade: c.necessidade as Necessidade | null,
        }));
      return { p, a: andamentoNoDesafio(desafio, p.entrouEm, minhas, hoje) };
    });
    const ok = todos.reduce((s, x) => s + x.a.ok, 0);
    const contados = todos.reduce((s, x) => s + x.a.contados, 0);
    grupo = contados ? Math.round((ok / contados) * 100) : null;
    if (souDono || dados.mostrarRanking) {
      ranking = classificar(
        todos.map(({ p, a }) => ({ pessoaId: p.pessoaId, nome: p.nome, apelido: p.apelido, cor: p.cor, pontos: a.pontos, ok: a.ok, contados: a.contados, sequencia: a.sequencia })),
      );
    }
    andamento = todos.filter(({ p }) => souDono || p.pessoaId === quem.pessoaId).map(({ p, a }) => ({ pessoaId: p.pessoaId, ...a }));
  }

  let posts: PostDoMural[] = [];
  if (comPosts) {
    const lista = await prisma().postDoEvento.findMany({
      where: { eventoId: e.id },
      include: {
        pessoa: { select: { nome: true, cor: true } },
        profissional: { select: { nome: true, cor: true, papel: true } },
        apoios: { select: { quem: true } },
      },
      orderBy: [{ fixado: "desc" }, { criadoEm: "desc" }],
    });
    const eu = quemId(quem);
    posts = lista.map((x) => ({
      id: x.id,
      autor: x.pessoa
        ? { tipo: "pessoa" as const, nome: x.pessoa.nome, cor: x.pessoa.cor, papel: null }
        : x.profissional
          ? { tipo: "profissional" as const, nome: x.profissional.nome, cor: x.profissional.cor, papel: x.profissional.papel }
          : { tipo: "sistema" as const, nome: "Desafoga", cor: "", papel: null },
      tipo: x.tipo as TipoDePost,
      texto: x.texto,
      fixado: x.fixado,
      quando: x.criadoEm.toISOString(),
      apoios: x.apoios.length,
      apoiei: x.apoios.some((a) => a.quem === eu),
      meu: (x.pessoaId ?? x.profissionalId) === eu,
    }));
  }

  return {
    id: e.id,
    ...dados,
    profissional: e.profissional,
    participantes,
    situacao: situacaoDoEvento(dados, hoje),
    grupo,
    ranking,
    andamento,
    posts,
    totalDePosts: e._count.posts,
    souDono,
  };
}

export async function salaDoEvento(id: string, quem: Quem, agora = new Date()): Promise<SalaDoEvento> {
  return montarSala(await visivel(id, quem), quem, agora, true);
}

/** Os eventos do profissional, ou aqueles de que a pessoa participa (sem os posts). */
export async function eventosDe(quem: Quem, agora = new Date()): Promise<SalaDoEvento[]> {
  const lista = await prisma().evento.findMany({
    where: quem.profissionalId ? { profissionalId: quem.profissionalId } : { participantes: { some: { pessoaId: quem.pessoaId } } },
    include: COMPLETO,
    orderBy: { criadoEm: "asc" },
  });
  return Promise.all(lista.map((e) => montarSala(e, quem, agora, false)));
}

/** Põe a pessoa no evento, avisa pela Luana e deixa um post do sistema no mural. */
async function incluir(e: { id: string } & DadosDoEvento, pessoaId: string, entrouEm: string, agora: Date): Promise<void> {
  const r = await prisma().participanteDoEvento.createMany({ data: [{ eventoId: e.id, pessoaId, entrouEm }], skipDuplicates: true });
  if (!r.count) return;
  const p = await prisma().pessoa.findUniqueOrThrow({ where: { id: pessoaId }, select: { apelido: true } });
  await prisma().postDoEvento.create({ data: { eventoId: e.id, tipo: "sistema", texto: `${p.apelido} entrou no evento.`, criadoEm: agora } });
  const texto =
    e.tipo === "desafio" && e.regra && e.inicio && e.fim
      ? mensagemDeEntradaNoDesafio({ nome: e.nome, regra: e.regra, categoria: e.categoria, limite: e.limite, inicio: e.inicio, fim: e.fim, premio: e.premio })
      : mensagemDeConviteParaEncontro({ nome: e.nome, data: e.data ?? entrouEm, hora: e.hora ?? "", local: e.local ?? "" });
  await mensagemDaLuana(pessoaId, texto, agora);
}

/** Na criação, quem entra no desafio conta desde o início (o profissional escolheu as datas). */
export async function criarEvento(profissionalId: string, dados: DadosDoEvento, participantes: string[], agora = new Date()): Promise<{ id: string }> {
  const e = await prisma().evento.create({ data: { profissionalId, ...dados } });
  const entrouEm = dados.tipo === "desafio" && dados.inicio ? dados.inicio : hojeEmBrasilia(agora);
  for (const pessoaId of [...new Set(participantes)]) await incluir({ id: e.id, ...dados }, pessoaId, entrouEm, agora);
  return { id: e.id };
}

/** Quem entra depois conta a partir de hoje (ou do início, se ainda não começou). */
export async function adicionarAoEvento(id: string, profissionalId: string, pessoaId: string, agora = new Date()): Promise<void> {
  const e = await doDono(id, profissionalId);
  const hoje = hojeEmBrasilia(agora);
  const entrouEm = e.tipo === "desafio" && e.inicio && e.inicio > hoje ? e.inicio : hoje;
  await incluir({ id: e.id, ...dadosDe(e) }, pessoaId, entrouEm, agora);
}

export async function removerDoEvento(id: string, profissionalId: string, pessoaId: string): Promise<void> {
  await doDono(id, profissionalId);
  await prisma().participanteDoEvento.deleteMany({ where: { eventoId: id, pessoaId } });
}

export async function configurarEvento(id: string, profissionalId: string, mudancas: { mostrarRanking?: boolean }): Promise<void> {
  await doDono(id, profissionalId);
  await prisma().evento.update({ where: { id }, data: mudancas });
}

export async function apagarEvento(id: string, profissionalId: string): Promise<void> {
  await doDono(id, profissionalId);
  await prisma().evento.delete({ where: { id } });
}

export async function responderEncontro(id: string, pessoaId: string, resposta: RespostaAoEncontro): Promise<void> {
  const e = await visivel(id, { pessoaId });
  if (e.tipo !== "presencial") throw new NaoEncontrado("Só encontros pedem confirmação.");
  await prisma().participanteDoEvento.update({ where: { eventoId_pessoaId: { eventoId: id, pessoaId } }, data: { resposta } });
}

export async function postarNoEvento(id: string, quem: Quem, tipo: Exclude<TipoDePost, "sistema">, texto: string, agora = new Date()): Promise<{ id: string }> {
  await visivel(id, quem);
  if (tipo === "aviso" && !quem.profissionalId) throw new NaoEncontrado("Só quem organiza pode publicar avisos.");
  const p = await prisma().postDoEvento.create({
    data: { eventoId: id, pessoaId: quem.pessoaId ?? null, profissionalId: quem.profissionalId ?? null, tipo, texto, criadoEm: agora },
  });
  return { id: p.id };
}

async function postDoEvento(id: string, postId: string) {
  const p = await prisma().postDoEvento.findFirst({ where: { id: postId, eventoId: id } });
  if (!p) throw new NaoEncontrado("Post não encontrado.");
  return p;
}

/** Apoiar ou desfazer o apoio. */
export async function apoiarPost(id: string, quem: Quem, postId: string): Promise<void> {
  await visivel(id, quem);
  await postDoEvento(id, postId);
  const chave = { postId_quem: { postId, quem: quemId(quem) } };
  const ja = await prisma().apoioDoPost.findUnique({ where: chave });
  if (ja) await prisma().apoioDoPost.delete({ where: chave });
  else await prisma().apoioDoPost.createMany({ data: [{ postId, quem: quemId(quem) }], skipDuplicates: true });
}

export async function fixarPost(id: string, profissionalId: string, postId: string): Promise<void> {
  await doDono(id, profissionalId);
  const p = await postDoEvento(id, postId);
  await prisma().postDoEvento.update({ where: { id: postId }, data: { fixado: !p.fixado } });
}

/** O dono apaga qualquer post; quem participa, só os seus. */
export async function apagarPost(id: string, quem: Quem, postId: string): Promise<void> {
  const e = await visivel(id, quem);
  const p = await postDoEvento(id, postId);
  const dono = quem.profissionalId === e.profissionalId;
  if (!dono && p.pessoaId !== quem.pessoaId) throw new NaoEncontrado("Post não encontrado.");
  await prisma().postDoEvento.delete({ where: { id: postId } });
}
