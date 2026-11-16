/**
 * Quem pode ver e mudar o quê. A pessoa só mexe nos próprios dados. O
 * profissional só vê quem aceitou ser acompanhado por ele (convite). Toda
 * ação da API passa por aqui antes de tocar no banco.
 */
import { prisma } from "./prisma";
import type { SessaoAtual } from "./sessao";

export class SemSessao extends Error {}
export class SemPermissao extends Error {}

export function exigirSessao(s: SessaoAtual | null): SessaoAtual {
  if (!s) throw new SemSessao("Entre no Desafoga para continuar.");
  return s;
}

/** A própria pessoa (ações como registrar compra, mudar o plano, conversar com a Luana). */
export function exigirAPropriaPessoa(s: SessaoAtual | null, pessoaId: string): SessaoAtual {
  const sessao = exigirSessao(s);
  if (sessao.pessoa?.id !== pessoaId) throw new SemPermissao("Você só pode mudar os seus próprios dados.");
  return sessao;
}

async function acompanha(profissionalId: string, pessoaId: string): Promise<boolean> {
  return (await prisma().acompanhamento.count({ where: { profissionalId, pessoaId } })) > 0;
}

/** Profissional que acompanha a pessoa (memória, anotações, sugestão de valor). */
export async function exigirProfissionalDe(s: SessaoAtual | null, pessoaId: string): Promise<SessaoAtual & { profissional: NonNullable<SessaoAtual["profissional"]> }> {
  const sessao = exigirSessao(s);
  if (!sessao.profissional || !(await acompanha(sessao.profissional.id, pessoaId))) {
    throw new SemPermissao("Você não acompanha esta pessoa.");
  }
  return sessao as SessaoAtual & { profissional: NonNullable<SessaoAtual["profissional"]> };
}

/** Ver os dados: a própria pessoa ou quem a acompanha. */
export async function exigirVer(s: SessaoAtual | null, pessoaId: string): Promise<SessaoAtual> {
  const sessao = exigirSessao(s);
  if (sessao.pessoa?.id === pessoaId) return sessao;
  if (sessao.profissional && (await acompanha(sessao.profissional.id, pessoaId))) return sessao;
  throw new SemPermissao("Você não tem acesso aos dados desta pessoa.");
}
