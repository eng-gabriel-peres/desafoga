/**
 * Sessão de quem usa o Desafoga, sem senha (decisão para o hackathon: quem
 * avalia entra e testa sem cadastro). O cookie guarda um token aleatório;
 * o banco guarda só o hash dele, para um vazamento do banco não abrir sessões.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Persona, Profissional } from "@/services/tipos";
import { clientePluggy, pluggyConfigurado } from "@/lib/banco/pluggy";
import { prisma } from "./prisma";
import { criarEspacoDemo, novoConvite } from "./semente";

export const COOKIE_DA_SESSAO = "desafoga_sessao";
export const DURACAO_DA_SESSAO_MS = 30 * 24 * 60 * 60_000;
/** Espaços de demonstração mais velhos que isso são apagados (com tudo dentro). */
const VIDA_DA_DEMO_MS = 7 * 24 * 60 * 60_000;

export interface SessaoAtual {
  id: string;
  espacoId: string;
  demo: boolean;
  /** Persona da demonstração ("ana", "paula"); null em conta real. */
  slug: string | null;
  pessoa: (Persona & { telefone: string | null }) | null;
  profissional: (Profissional & { convite: string }) | null;
}

export interface NovaSessao {
  token: string;
  expira: Date;
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function lerSessao(token: string | undefined): Promise<SessaoAtual | null> {
  if (!token || token.length > 100) return null;
  const s = await prisma().sessao.findUnique({
    where: { id: hash(token) },
    include: { espaco: true, pessoa: true, profissional: true },
  });
  if (!s || s.expiraEm < new Date()) return null;
  return {
    id: s.id,
    espacoId: s.espacoId,
    demo: s.espaco.tipo === "DEMO",
    slug: s.pessoa?.slug ?? s.profissional?.slug ?? null,
    pessoa: s.pessoa
      ? { id: s.pessoa.id, nome: s.pessoa.nome, apelido: s.pessoa.apelido, idade: s.pessoa.idade, cor: s.pessoa.cor, perfil: s.pessoa.perfil, telefone: s.pessoa.telefone }
      : null,
    profissional: s.profissional
      ? { id: s.profissional.id, nome: s.profissional.nome, papel: s.profissional.papel, cor: s.profissional.cor, convite: s.profissional.convite }
      : null,
  };
}

async function criarSessao(dados: { espacoId: string; pessoaId?: string; profissionalId?: string }): Promise<NovaSessao> {
  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + DURACAO_DA_SESSAO_MS);
  await prisma().sessao.create({ data: { id: hash(token), expiraEm: expira, ...dados } });
  return { token, expira };
}

export async function encerrarSessao(sessaoId: string): Promise<void> {
  await prisma().sessao.deleteMany({ where: { id: sessaoId } });
}

export type PerfilDaDemo = "ana" | "carlos" | "lucia" | "rafael" | "paula" | "marcos";

/**
 * Antes de apagar espaços de demonstração, apaga na Pluggy os bancos de teste
 * conectados neles: a conta de desenvolvimento tem limite de 100 conexões.
 * Falha na Pluggy não impede a limpeza.
 */
async function apagarBancosDaPluggy(espacos: { id?: string; tipo: "DEMO"; criadoEm?: { lt: Date } }): Promise<void> {
  const itens = await prisma().conexaoBancaria.findMany({
    where: { pluggyItemId: { not: null }, pessoa: { espaco: espacos } },
    select: { pluggyItemId: true },
  });
  if (!itens.length || !pluggyConfigurado()) return;
  await Promise.allSettled(itens.map((i) => clientePluggy().apagarItem(i.pluggyItemId!)));
}
const PROFISSIONAIS_DA_DEMO = new Set(["paula", "marcos"]);

/**
 * Entra na demonstração como uma persona. Quem já está numa demo continua no
 * mesmo espaço (entrar como Ana e depois como Paula mostra os mesmos dados);
 * senão, ganha uma cópia nova dos dados fictícios.
 */
export async function entrarNaDemo(perfil: PerfilDaDemo, atual: SessaoAtual | null): Promise<NovaSessao> {
  let espacoId = atual?.demo ? atual.espacoId : null;
  if (!espacoId) {
    const vencidas = { tipo: "DEMO" as const, criadoEm: { lt: new Date(Date.now() - VIDA_DA_DEMO_MS) } };
    await apagarBancosDaPluggy(vencidas);
    await prisma().espaco.deleteMany({ where: vencidas });
    espacoId = (await prisma().$transaction((tx) => criarEspacoDemo(tx), { timeout: 60_000 })).espacoId;
  }
  if (atual) await prisma().sessao.deleteMany({ where: { id: atual.id } });
  if (PROFISSIONAIS_DA_DEMO.has(perfil)) {
    const p = await prisma().profissional.findUniqueOrThrow({ where: { espacoId_slug: { espacoId, slug: perfil } } });
    return criarSessao({ espacoId, profissionalId: p.id });
  }
  const p = await prisma().pessoa.findUniqueOrThrow({ where: { espacoId_slug: { espacoId, slug: perfil } } });
  return criarSessao({ espacoId, pessoaId: p.id });
}

/** Volta a demonstração ao começo: um espaço novo, na mesma persona. */
export async function recomecarDemo(atual: SessaoAtual): Promise<NovaSessao> {
  const perfil = (atual.slug ?? "ana") as PerfilDaDemo;
  // O espaço antigo some com tudo dentro (e a sessão junto): recomeçar não acumula cópias.
  await apagarBancosDaPluggy({ id: atual.espacoId, tipo: "DEMO" });
  await prisma().espaco.deleteMany({ where: { id: atual.espacoId, tipo: "DEMO" } });
  return entrarNaDemo(perfil, null);
}

/** Espaço das contas reais: um só, criado no primeiro cadastro. */
async function espacoReal(): Promise<string> {
  const existente = await prisma().espaco.findFirst({ where: { tipo: "REAL" }, orderBy: { criadoEm: "asc" } });
  return existente?.id ?? (await prisma().espaco.create({ data: { tipo: "REAL" } })).id;
}

const CORES = ["#2350C8", "#17804F", "#8E44AD", "#C2410C", "#0F766E", "#B45309", "#9D174D"];
const corAleatoria = () => CORES[randomBytes(1)[0] % CORES.length];

export type NovaConta =
  | { tipo: "pessoa"; nome: string; apelido: string; idade: number | null }
  | { tipo: "profissional"; nome: string; papel: string };

/** Cria uma conta real (sem senha, decisão do hackathon) e já entra nela. */
export async function criarConta(conta: NovaConta, atual: SessaoAtual | null): Promise<NovaSessao> {
  const espacoId = await espacoReal();
  if (atual) await prisma().sessao.deleteMany({ where: { id: atual.id } });
  if (conta.tipo === "profissional") {
    const p = await prisma().profissional.create({
      data: { espacoId, nome: conta.nome, papel: conta.papel, cor: corAleatoria(), convite: novoConvite() },
    });
    return criarSessao({ espacoId, profissionalId: p.id });
  }
  const p = await prisma().pessoa.create({
    data: {
      espacoId,
      nome: conta.nome,
      apelido: conta.apelido,
      idade: conta.idade,
      cor: corAleatoria(),
      plano: { create: {} },
      memoria: { create: { caracteristicas: [] } },
      mensagens: {
        create: {
          canal: "app",
          de: "assistente",
          texto: `Oi, ${conta.apelido}! Eu sou a Luana, assistente do Desafoga.\nComprou alguma coisa? É só me mandar, do seu jeito.\nExemplo: comprei pão 12`,
        },
      },
    },
  });
  return criarSessao({ espacoId, pessoaId: p.id });
}

/** A pessoa aceita ser acompanhada pelo profissional dono do código de convite. */
export async function aceitarConvite(pessoaId: string, espacoId: string, convite: string): Promise<Profissional | null> {
  const p = await prisma().profissional.findUnique({ where: { convite: convite.trim().toUpperCase() } });
  if (!p || p.espacoId !== espacoId) return null;
  await prisma().acompanhamento.upsert({
    where: { pessoaId_profissionalId: { pessoaId, profissionalId: p.id } },
    create: { pessoaId, profissionalId: p.id },
    update: {},
  });
  return { id: p.id, nome: p.nome, papel: p.papel, cor: p.cor };
}

/** LGPD: apaga a pessoa e tudo dela (compras, dívidas, conversas, notas). */
export async function apagarConta(atual: SessaoAtual): Promise<void> {
  if (atual.pessoa) {
    // Os bancos conectados também saem da Pluggy.
    const itens = await prisma().conexaoBancaria.findMany({ where: { pessoaId: atual.pessoa.id, pluggyItemId: { not: null } }, select: { pluggyItemId: true } });
    if (itens.length && pluggyConfigurado()) await Promise.allSettled(itens.map((i) => clientePluggy().apagarItem(i.pluggyItemId!)));
    await prisma().pessoa.delete({ where: { id: atual.pessoa.id } });
  }
  else if (atual.profissional) await prisma().profissional.delete({ where: { id: atual.profissional.id } });
}
