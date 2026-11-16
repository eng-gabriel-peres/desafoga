/**
 * Cliente do Prisma, um por processo. Em desenvolvimento, o recarregamento
 * do Next reaproveita a mesma instância para não abrir conexões demais.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const global = globalThis as unknown as { prismaDesafoga?: PrismaClient };

function criar(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada. Rode `pnpm db:up` e confira o .env.local.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export function prisma(): PrismaClient {
  global.prismaDesafoga ??= criar();
  return global.prismaDesafoga;
}

export type { PrismaClient };
