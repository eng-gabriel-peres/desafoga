/**
 * Conteúdos: o feed com as publicações dos profissionais do espaço (o REAL é
 * um só; cada demonstração tem o seu). Pessoas e profissionais curtem,
 * salvam, votam e comentam; pessoas seguem profissionais. Comentário de
 * pessoa mostra só o primeiro nome. Reexportado por `repositorio.ts`.
 */
import { mensagemDeConteudoNovo } from "@/lib/assistente/textos";
import { minutosDeLeitura, resultadoDaEnquete, type CorDaCapa, type ResultadoDaEnquete, type Tema, type TipoDeConteudo } from "@/lib/desafoga/conteudos";
import { prisma } from "./prisma";
import { mensagemDaLuana, NaoEncontrado } from "./repositorio";
import type { Quem } from "./repositorio-eventos";

export interface NovoConteudo {
  tipo: TipoDeConteudo;
  tema: Tema;
  cor: CorDaCapa;
  titulo: string;
  texto: string;
  corpo: string[];
  cartoes: string[];
  opcoes: string[];
}

export interface AutorDoConteudo {
  id: string;
  nome: string;
  papel: string;
  cor: string;
}

export interface ConteudoNoFeed extends NovoConteudo {
  id: string;
  autor: AutorDoConteudo;
  quando: string;
  minutos: number;
  curtidas: number;
  curti: boolean;
  salvei: boolean;
  enquete: ResultadoDaEnquete | null;
  comentarios: number;
  primeiroComentario: { nome: string; texto: string } | null;
  /** Publicado por quem está vendo. */
  meu: boolean;
}

export interface ComentarioVisto {
  id: string;
  /** Pessoa: só o primeiro nome. */
  autor: { nome: string; cor: string; profissional: boolean };
  texto: string;
  quando: string;
  meu: boolean;
  podeApagar: boolean;
}

export interface DetalheDoConteudo extends ConteudoNoFeed {
  listaDeComentarios: ComentarioVisto[];
}

export interface Criador extends AutorDoConteudo {
  bio: string;
  seguidores: number;
  sigo: boolean;
  publicacoes: number;
  curtidas: number;
  /** Publicou nos últimos 2 dias (anel colorido nos stories). */
  recente: boolean;
}

export interface FeedDeConteudos {
  conteudos: ConteudoNoFeed[];
  criadores: Criador[];
  /** Só para o profissional: comentários nas publicações dele ainda sem resposta dele. */
  paraResponder: { conteudoId: string; titulo: string; nome: string; cor: string; texto: string }[];
}

const quemId = (q: Quem) => q.pessoaId ?? q.profissionalId!;

const COMPLETO = {
  profissional: { select: { id: true, nome: true, papel: true, cor: true } },
  reacoes: true,
  comentarios: {
    include: { pessoa: { select: { apelido: true, cor: true } }, profissional: { select: { nome: true, cor: true } } },
    orderBy: { criadoEm: "asc" as const },
  },
};

type ConteudoDoBanco = NonNullable<Awaited<ReturnType<typeof buscar>>>;
const buscar = (id: string) => prisma().conteudo.findUnique({ where: { id }, include: COMPLETO });

function paraFeed(c: ConteudoDoBanco, quem: Quem): ConteudoNoFeed {
  const eu = quemId(quem);
  const curtidas = c.reacoes.filter((r) => r.tipo === "curtir");
  const votos = c.reacoes.filter((r) => r.tipo === "votar").map((r) => ({ quem: r.quem, opcao: r.opcao ?? -1 }));
  const primeiro = c.comentarios[0];
  return {
    id: c.id,
    tipo: c.tipo as TipoDeConteudo,
    tema: c.tema as Tema,
    cor: c.cor as CorDaCapa,
    titulo: c.titulo,
    texto: c.texto,
    corpo: c.corpo,
    cartoes: c.cartoes,
    opcoes: c.opcoes,
    autor: c.profissional,
    quando: c.criadoEm.toISOString(),
    minutos: minutosDeLeitura(c.corpo),
    curtidas: c.curtidasIniciais + curtidas.length,
    curti: curtidas.some((r) => r.quem === eu),
    salvei: c.reacoes.some((r) => r.tipo === "salvar" && r.quem === eu),
    enquete: c.tipo === "enquete" ? resultadoDaEnquete(c.opcoes, c.votosIniciais, votos, eu) : null,
    comentarios: c.comentarios.length,
    primeiroComentario: primeiro ? { nome: primeiro.pessoa?.apelido ?? primeiro.profissional?.nome ?? "", texto: primeiro.texto } : null,
    meu: c.profissionalId === quem.profissionalId,
  };
}

/** O conteúdo, se for do espaço de quem está vendo; senão "não encontrado". */
async function doEspaco(espacoId: string, id: string): Promise<ConteudoDoBanco> {
  const c = await buscar(id);
  if (!c) throw new NaoEncontrado("Conteúdo não encontrado.");
  const p = await prisma().profissional.findUnique({ where: { id: c.profissionalId }, select: { espacoId: true } });
  if (p?.espacoId !== espacoId) throw new NaoEncontrado("Conteúdo não encontrado.");
  return c;
}

export async function feedDeConteudos(espacoId: string, quem: Quem, agora = new Date()): Promise<FeedDeConteudos> {
  const [lista, profissionais, seguindo] = await Promise.all([
    prisma().conteudo.findMany({ where: { profissional: { espacoId } }, include: COMPLETO, orderBy: { criadoEm: "desc" } }),
    prisma().profissional.findMany({ where: { espacoId }, select: { id: true, nome: true, papel: true, cor: true, bio: true, _count: { select: { seguidores: true } } }, orderBy: { criadoEm: "asc" } }),
    quem.pessoaId ? prisma().seguir.findMany({ where: { pessoaId: quem.pessoaId }, select: { profissionalId: true } }) : Promise.resolve([]),
  ]);
  const conteudos = lista.map((c) => paraFeed(c, quem));
  const doisDias = agora.getTime() - 2 * 86_400_000;
  const criadores: Criador[] = profissionais.map((p) => {
    const dele = conteudos.filter((c) => c.autor.id === p.id);
    return {
      id: p.id,
      nome: p.nome,
      papel: p.papel,
      cor: p.cor,
      bio: p.bio,
      seguidores: p._count.seguidores,
      sigo: seguindo.some((s) => s.profissionalId === p.id),
      publicacoes: dele.length,
      curtidas: dele.reduce((s, c) => s + c.curtidas, 0),
      recente: dele.some((c) => Date.parse(c.quando) >= doisDias),
    };
  });
  const paraResponder = quem.profissionalId
    ? lista
        .filter((c) => c.profissionalId === quem.profissionalId)
        .flatMap((c) =>
          c.comentarios
            .filter((x) => x.pessoaId && !c.comentarios.some((r) => r.profissionalId === quem.profissionalId && r.criadoEm > x.criadoEm))
            .map((x) => ({ conteudoId: c.id, titulo: c.titulo, nome: x.pessoa?.apelido ?? "", cor: x.pessoa?.cor ?? "", texto: x.texto, quando: x.criadoEm.getTime() })),
        )
        .sort((a, b) => b.quando - a.quando)
        .slice(0, 4)
        .map((x) => ({ conteudoId: x.conteudoId, titulo: x.titulo, nome: x.nome, cor: x.cor, texto: x.texto }))
    : [];
  return { conteudos, criadores, paraResponder };
}

export async function detalheDoConteudo(espacoId: string, quem: Quem, id: string): Promise<DetalheDoConteudo> {
  const c = await doEspaco(espacoId, id);
  const eu = quemId(quem);
  const autorDoConteudo = c.profissionalId === quem.profissionalId;
  return {
    ...paraFeed(c, quem),
    listaDeComentarios: c.comentarios.map((x) => {
      const meu = (x.pessoaId ?? x.profissionalId) === eu;
      return {
        id: x.id,
        autor: x.pessoa
          ? { nome: x.pessoa.apelido, cor: x.pessoa.cor, profissional: false }
          : { nome: x.profissional?.nome ?? "", cor: x.profissional?.cor ?? "", profissional: true },
        texto: x.texto,
        quando: x.criadoEm.toISOString(),
        meu,
        podeApagar: meu || autorDoConteudo,
      };
    }),
  };
}

/** Publica; com `avisar`, a Luana conta no chat de quem segue o profissional. */
export async function publicarConteudo(profissionalId: string, novo: NovoConteudo, avisar: boolean, agora = new Date()): Promise<{ id: string }> {
  const c = await prisma().conteudo.create({ data: { profissionalId, ...novo, criadoEm: agora }, include: { profissional: { select: { nome: true } } } });
  if (avisar) {
    const seguidores = await prisma().seguir.findMany({ where: { profissionalId }, select: { pessoaId: true } });
    for (const s of seguidores) await mensagemDaLuana(s.pessoaId, mensagemDeConteudoNovo(c.profissional.nome, novo.titulo), agora);
  }
  return { id: c.id };
}

export async function apagarConteudo(profissionalId: string, id: string): Promise<void> {
  const r = await prisma().conteudo.deleteMany({ where: { id, profissionalId } });
  if (!r.count) throw new NaoEncontrado("Conteúdo não encontrado.");
}

/** Curtir ou salvar: alterna. */
export async function reagirAoConteudo(espacoId: string, quem: Quem, id: string, tipo: "curtir" | "salvar"): Promise<void> {
  await doEspaco(espacoId, id);
  const chave = { conteudoId_quem_tipo: { conteudoId: id, quem: quemId(quem), tipo } };
  const ja = await prisma().reacaoAoConteudo.findUnique({ where: chave });
  if (ja) await prisma().reacaoAoConteudo.delete({ where: chave });
  else await prisma().reacaoAoConteudo.createMany({ data: [{ conteudoId: id, quem: quemId(quem), tipo }], skipDuplicates: true });
}

/** Vota (ou troca o voto) numa enquete. */
export async function votarNaEnquete(espacoId: string, quem: Quem, id: string, opcao: number): Promise<void> {
  const c = await doEspaco(espacoId, id);
  if (c.tipo !== "enquete" || opcao < 0 || opcao >= c.opcoes.length) throw new NaoEncontrado("Opção não encontrada.");
  await prisma().reacaoAoConteudo.upsert({
    where: { conteudoId_quem_tipo: { conteudoId: id, quem: quemId(quem), tipo: "votar" } },
    create: { conteudoId: id, quem: quemId(quem), tipo: "votar", opcao },
    update: { opcao },
  });
}

export async function comentarConteudo(espacoId: string, quem: Quem, id: string, texto: string, agora = new Date()): Promise<{ id: string }> {
  await doEspaco(espacoId, id);
  const c = await prisma().comentarioDoConteudo.create({
    data: { conteudoId: id, pessoaId: quem.pessoaId ?? null, profissionalId: quem.profissionalId ?? null, texto, criadoEm: agora },
  });
  return { id: c.id };
}

/** Quem escreveu apaga; o autor do conteúdo também (moderação). */
export async function apagarComentario(espacoId: string, quem: Quem, comentarioId: string): Promise<void> {
  const x = await prisma().comentarioDoConteudo.findUnique({ where: { id: comentarioId }, include: { conteudo: { select: { id: true, profissionalId: true } } } });
  if (!x) throw new NaoEncontrado("Comentário não encontrado.");
  await doEspaco(espacoId, x.conteudo.id);
  const pode = (x.pessoaId ?? x.profissionalId) === quemId(quem) || x.conteudo.profissionalId === quem.profissionalId;
  if (!pode) throw new NaoEncontrado("Comentário não encontrado.");
  await prisma().comentarioDoConteudo.delete({ where: { id: comentarioId } });
}

/** A pessoa segue (ou deixa de seguir) um profissional do espaço. */
export async function seguirProfissional(espacoId: string, pessoaId: string, profissionalId: string): Promise<void> {
  const p = await prisma().profissional.findUnique({ where: { id: profissionalId }, select: { espacoId: true } });
  if (p?.espacoId !== espacoId) throw new NaoEncontrado("Profissional não encontrado.");
  const chave = { pessoaId_profissionalId: { pessoaId, profissionalId } };
  if (await prisma().seguir.findUnique({ where: chave })) await prisma().seguir.delete({ where: chave });
  else await prisma().seguir.createMany({ data: [{ pessoaId, profissionalId }], skipDuplicates: true });
}
