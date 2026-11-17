/**
 * O Desafoga guarda suas tabelas num esquema só dele dentro do Postgres.
 *
 * O mesmo banco já tem as tabelas da Luana (`contas` e `uso`), criadas direto
 * em SQL no esquema padrão. O Prisma se recusa a migrar um esquema que não é
 * dele (erro P3005), então ele fica com o esquema `desafoga` e a Luana segue
 * no `public`, sem uma parte atrapalhar a outra.
 */
export const ESQUEMA = "desafoga";

/** Devolve a URL de conexão apontando para o esquema do Desafoga. */
export function comEsquema(url: string, esquema = ESQUEMA): string {
  if (!url) return url;
  try {
    const endereco = new URL(url);
    endereco.searchParams.set("schema", esquema);
    return endereco.toString();
  } catch {
    // URL que o Postgres entende mas o parser não: deixa como está.
    return url;
  }
}
