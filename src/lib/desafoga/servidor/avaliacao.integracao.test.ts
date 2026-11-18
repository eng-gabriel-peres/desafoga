/**
 * Avaliação das compras pelo profissional: só quem acompanha avalia, e a
 * pessoa nunca vê a avaliação. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Compra } from "@/lib/finance";
import type { NovaSessao, SessaoAtual } from "./sessao";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("avaliação das compras", { timeout: 30_000 }, () => {
  let prisma: typeof import("./prisma").prisma;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    prisma = (await import("./prisma")).prisma;
  });

  afterAll(async () => {
    await prisma().$disconnect();
  });

  async function entrar(perfil: string, atual: SessaoAtual | null = null): Promise<SessaoAtual> {
    const { executar } = await import("./rotas");
    const { lerSessao } = await import("./sessao");
    let nova: NovaSessao | null | undefined;
    await executar("sessao.entrarNaDemo" as never, [perfil], { rede: null, sessao: atual, definirSessao: (s) => (nova = s) });
    return (await lerSessao(nova!.token))!;
  }
  async function chamar<T = unknown>(acao: string, args: unknown[], sessao: SessaoAtual): Promise<T> {
    const { executar } = await import("./rotas");
    return executar(acao as never, args, { rede: null, sessao, definirSessao: () => {} }) as Promise<T>;
  }

  it("a profissional avalia e desfaz; a pessoa não avalia e nunca vê a avaliação", async () => {
    const paula = await entrar("paula");
    const ana = (await prisma().pessoa.findFirstOrThrow({ where: { espacoId: paula.espacoId, slug: "ana" } })).id;
    const compras = await chamar<Compra[]>("compras.listar", [ana], paula);
    const c = compras.find((x) => x.avaliacaoProfissional === null)!;
    await chamar("compras.avaliar", [ana, c.id, "nao"], paula);
    expect((await chamar<Compra[]>("compras.listar", [ana], paula)).find((x) => x.id === c.id)?.avaliacaoProfissional).toBe("nao");
    await chamar("compras.avaliar", [ana, c.id, null], paula);
    expect((await chamar<Compra[]>("compras.listar", [ana], paula)).find((x) => x.id === c.id)?.avaliacaoProfissional).toBeNull();
    await chamar("compras.avaliar", [ana, c.id, "sim"], paula);

    const anaS = await entrar("ana", paula);
    await expect(chamar("compras.avaliar", [ana, c.id, "nao"], anaS)).rejects.toThrow();
    // A demo já vem com compras avaliadas: nenhuma chega para a Ana.
    const daAna = await chamar<Compra[]>("compras.listar", [ana], anaS);
    expect(daAna.length).toBeGreaterThan(0);
    expect(daAna.every((x) => x.avaliacaoProfissional === null)).toBe(true);
  });

  it("compra de outra pessoa não é avaliada pelo id", async () => {
    const paula = await entrar("paula");
    const ana = (await prisma().pessoa.findFirstOrThrow({ where: { espacoId: paula.espacoId, slug: "ana" } })).id;
    const carlos = (await prisma().pessoa.findFirstOrThrow({ where: { espacoId: paula.espacoId, slug: "carlos" } })).id;
    const doCarlos = (await chamar<Compra[]>("compras.listar", [carlos], paula))[0];
    await expect(chamar("compras.avaliar", [ana, doCarlos.id, "nao"], paula)).rejects.toThrow();
  });
});
