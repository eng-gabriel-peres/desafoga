import { defineConfig } from "prisma/config";
import { comEsquema } from "./src/lib/desafoga/servidor/esquema";

// O Next lê .env.local; a CLI do Prisma lê o mesmo arquivo, quando existe.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sem .env.local: vale o ambiente (CI, Docker, Vercel).
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` não conecta no banco; só migrações e seed precisam da URL.
    // As tabelas do Desafoga ficam num esquema só delas; veja esquema.ts.
    url: comEsquema(process.env.DATABASE_URL ?? ""),
  },
});
