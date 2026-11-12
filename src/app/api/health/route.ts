import { connection, NextResponse } from "next/server";

/** Mostra em qual ambiente a aplicação está rodando: local, dev ou prod. */
export async function GET() {
  // Lê as variáveis a cada requisição, em vez de fixar o valor no build.
  await connection();

  const vercelEnv = process.env.VERCEL_ENV;
  const ambiente =
    vercelEnv === "production" ? "prod" : vercelEnv === "preview" ? "dev" : "local";

  return NextResponse.json({
    ok: true,
    ambiente,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
