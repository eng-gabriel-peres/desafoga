/**
 * "Não lembro como eu estava": a compra entra sem emoção, marcada, e não
 * fica pendente. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Compra } from "@/lib/finance";
import type { NovaSessao, SessaoAtual } from "./sessao";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("não lembro como estava", { timeout: 30_000 }, () => {
  let prisma: typeof import("./prisma").prisma;
  let repo: typeof import("./repositorio");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    prisma = (await import("./prisma")).prisma;
    repo = await import("./repositorio");
  });

  afterAll(async () => {
    await prisma().$disconnect();
  });

  async function entrar(perfil: string): Promise<SessaoAtual> {
    const { executar } = await import("./rotas");
    const { lerSessao } = await import("./sessao");
    let nova: NovaSessao | null | undefined;
    await executar("sessao.entrarNaDemo" as never, [perfil], { rede: null, sessao: null, definirSessao: (s) => (nova = s) });
    return (await lerSessao(nova!.token))!;
  }
  async function chamar<T = unknown>(acao: string, args: unknown[], sessao: SessaoAtual): Promise<T> {
    const { executar } = await import("./rotas");
    return executar(acao as never, args, { rede: null, sessao, definirSessao: () => {} }) as Promise<T>;
  }

  it("registro manual, compra do banco e completar emoção aceitam 'não lembro'", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    const manual = await chamar<Compra>("compras.registrar", [p, { item: "Pão", categoria: "Mercado", valor: 1200, emocao: null, necessidade: "sim", via: "app" }], ana);
    expect(manual).toMatchObject({ emocao: null, naoLembra: true });

    const [mov] = await repo.movimentos(p, { situacao: ["revisar"] });
    await chamar("banco.registrar", [p, mov.id, { item: "Shopee", categoria: "Outro", emocao: null, necessidade: "nao" }], ana);
    const doBanco = (await repo.compras(p)).find((c) => c.item === "Shopee")!;
    expect(doBanco).toMatchObject({ emocao: null, naoLembra: true, necessidade: "nao" });

    const sem = await repo.registrarCompra(p, { item: "Ifood", categoria: "Comida pronta", valor: 4590, emocao: null, necessidade: null, via: "banco" });
    expect(sem.naoLembra).toBe(false);
    await chamar("banco.completarEmocao", [p, sem.id, null, "talvez"], ana);
    expect((await repo.compras(p)).find((c) => c.id === sem.id)).toMatchObject({ emocao: null, naoLembra: true, necessidade: "talvez" });
    // Depois, se lembrar, dá para completar com a emoção.
    await chamar("banco.completarEmocao", [p, sem.id, 3, "talvez"], ana);
    expect((await repo.compras(p)).find((c) => c.id === sem.id)).toMatchObject({ emocao: 3, naoLembra: false });
  });
});
