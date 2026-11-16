/**
 * Antes dos testes: com TEST_DATABASE_URL, aplica as migrações no banco de
 * teste (sem apagar nada). Os testes de integração criam dados próprios, com
 * ids novos, e não dependem de banco vazio. Sem TEST_DATABASE_URL, são pulados.
 */
import { execSync } from "node:child_process";

export default function prepararBancoDeTeste() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL não pode ser o mesmo banco do desenvolvimento.");
  execSync("pnpm prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
}
