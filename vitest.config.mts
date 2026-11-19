import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

// Do .env.local, só o banco de TESTE: os testes de regra não tocam no banco de desenvolvimento.
if (!process.env.TEST_DATABASE_URL && existsSync(".env.local")) {
  const local = parseEnv(readFileSync(".env.local", "utf8"));
  if (local.TEST_DATABASE_URL) process.env.TEST_DATABASE_URL = local.TEST_DATABASE_URL;
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globalSetup: ["./vitest.banco.ts"],
    // Os testes rodam com todos os recursos ligados (os escondidos na apresentação também são testados).
    env: { NEXT_PUBLIC_RECURSOS_DESLIGADOS: "" },
  },
});
