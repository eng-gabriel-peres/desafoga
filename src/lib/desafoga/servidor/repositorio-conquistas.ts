/**
 * Conquistas: metas com prêmio que o profissional cria para a pessoa.
 * Reexportado por `repositorio.ts`.
 */
import { mensagemDeConquistaAlcancada, mensagemDeConquistaNova } from "@/lib/assistente/textos";
import { conquistada, tituloAutomatico, type Conquista, type IconeDaConquista, type TipoDeConquista } from "@/lib/finance";
import { prisma } from "./prisma";
import { avisar, compras, mensagemDaLuana, NaoEncontrado } from "./repositorio";

export interface NovaConquista {
  icone: IconeDaConquista;
  tipo: TipoDeConquista;
  alvo: number;
  /** Vazio: o título automático ("Anotar 20 compras"). */
  titulo: string;
  premio: string;
}

const COM_AUTOR = { autor: { select: { nome: true } } } as const;

function paraConquista(c: {
  id: string;
  icone: string;
  titulo: string;
  tipo: string;
  alvo: number;
  premio: string;
  criadaEm: Date;
  concluidaEm: Date | null;
  autor: { nome: string } | null;
}): Conquista {
  return {
    id: c.id,
    icone: c.icone as IconeDaConquista,
    titulo: c.titulo,
    tipo: c.tipo as TipoDeConquista,
    alvo: c.alvo,
    premio: c.premio,
    criadaEm: c.criadaEm.toISOString(),
    concluidaEm: c.concluidaEm?.toISOString() ?? null,
    autor: c.autor?.nome ?? null,
  };
}

export async function conquistas(pessoaId: string): Promise<Conquista[]> {
  const lista = await prisma().conquista.findMany({ where: { pessoaId }, include: COM_AUTOR, orderBy: { criadaEm: "desc" } });
  return lista.map(paraConquista);
}

/** Cria e avisa a pessoa no chat (como no protótipo). */
export async function criarConquista(pessoaId: string, autorId: string, nova: NovaConquista, agora = new Date()): Promise<Conquista> {
  const titulo = nova.titulo.trim() || tituloAutomatico(nova.tipo, nova.alvo);
  const criada = paraConquista(
    await prisma().conquista.create({
      data: { pessoaId, autorId, icone: nova.icone, tipo: nova.tipo, alvo: nova.alvo, titulo, premio: nova.premio.trim(), criadaEm: agora },
      include: COM_AUTOR,
    }),
  );
  await mensagemDaLuana(pessoaId, mensagemDeConquistaNova(criada), agora);
  return criada;
}

export async function apagarConquista(pessoaId: string, id: string): Promise<void> {
  const r = await prisma().conquista.deleteMany({ where: { id, pessoaId } });
  if (!r.count) throw new NaoEncontrado("Conquista não encontrada.");
}

/**
 * Marca as conquistas alcançadas; a Luana dá os parabéns e quem acompanha
 * recebe um aviso, uma vez só (a marcação é condicional). Devolve as novas.
 */
export async function conferirConquistas(pessoaId: string, agora = new Date()): Promise<Conquista[]> {
  const abertas = (await prisma().conquista.findMany({ where: { pessoaId, concluidaEm: null }, include: COM_AUTOR })).map(paraConquista);
  if (!abertas.length) return [];
  const lista = await compras(pessoaId);
  const novas: Conquista[] = [];
  for (const c of abertas.filter((x) => conquistada(x, lista, agora))) {
    const r = await prisma().conquista.updateMany({ where: { id: c.id, concluidaEm: null }, data: { concluidaEm: agora } });
    if (!r.count) continue;
    const feita = { ...c, concluidaEm: agora.toISOString() };
    novas.push(feita);
    const p = await prisma().pessoa.findUniqueOrThrow({ where: { id: pessoaId }, select: { apelido: true } });
    await mensagemDaLuana(pessoaId, mensagemDeConquistaAlcancada(feita), agora);
    await avisar(pessoaId, "conquista", `${p.apelido} desbloqueou a conquista ${c.titulo}.`, agora);
  }
  return novas;
}
