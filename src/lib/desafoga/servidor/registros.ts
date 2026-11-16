/**
 * Dados curtos e temporários (códigos e links do WhatsApp, contato recente),
 * na tabela `registros`. Nos testes sem banco, ficam em memória.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

export interface Registros {
  ler(chave: string): Promise<unknown | null>;
  gravar(chave: string, dados: unknown): Promise<void>;
  apagar(chave: string): Promise<void>;
  /** Grava só se a chave ainda não existe, de forma atômica. Diz se gravou. */
  criarSeNaoExiste(chave: string, dados: unknown): Promise<boolean>;
}

const json = (dados: unknown) => dados as Prisma.InputJsonValue;

function registrosNoBanco(): Registros {
  return {
    async ler(chave) {
      return (await prisma().registro.findUnique({ where: { chave } }))?.dados ?? null;
    },
    async gravar(chave, dados) {
      await prisma().registro.upsert({ where: { chave }, create: { chave, dados: json(dados) }, update: { dados: json(dados) } });
    },
    async apagar(chave) {
      await prisma().registro.deleteMany({ where: { chave } });
    },
    async criarSeNaoExiste(chave, dados) {
      const r = await prisma().registro.createMany({ data: [{ chave, dados: json(dados) }], skipDuplicates: true });
      return r.count > 0;
    },
  };
}

export function registrosEmMemoria(): Registros {
  const tudo = new Map<string, unknown>();
  return {
    ler: async (chave) => structuredClone(tudo.get(chave) ?? null),
    gravar: async (chave, dados) => void tudo.set(chave, structuredClone(dados)),
    apagar: async (chave) => void tudo.delete(chave),
    async criarSeNaoExiste(chave, dados) {
      if (tudo.has(chave)) return false;
      tudo.set(chave, structuredClone(dados));
      return true;
    },
  };
}

let atual: Registros | null = null;

export function registros(): Registros {
  atual ??= process.env.NODE_ENV === "test" && !process.env.DATABASE_URL ? registrosEmMemoria() : registrosNoBanco();
  return atual;
}
