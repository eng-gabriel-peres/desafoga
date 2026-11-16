/**
 * Dados de demonstração: `pnpm db:seed`. Cria um espaço de demo com Ana,
 * Carlos, Lúcia, Rafael, Paula e Marcos. Quem entra como Ana ou Paula no app
 * ganha uma cópia própria; este espaço serve para explorar o banco
 * (pnpm db:studio) e para conferir a semente.
 */
import { prisma } from "../src/lib/desafoga/servidor/prisma";
import { criarEspacoDemo } from "../src/lib/desafoga/servidor/semente";

async function main() {
  const criado = await prisma().$transaction((tx) => criarEspacoDemo(tx), { timeout: 60_000 });
  const total = await prisma().compra.count({ where: { pessoa: { espacoId: criado.espacoId } } });
  console.log(`Espaço de demonstração criado: ${criado.espacoId}`);
  console.log(`Pessoas: ${Object.keys(criado.pessoas).join(", ")}; profissionais: ${Object.keys(criado.profissionais).join(", ")}; ${total} compras.`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma().$disconnect());
