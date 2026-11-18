/**
 * Avisos vistos: cada um marca para si (a Paula marcar não marca para o
 * Marcos) e só os avisos que vê. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Aviso } from "@/services/tipos";
import type { NovaSessao, SessaoAtual } from "./sessao";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("avisos vistos", { timeout: 30_000 }, () => {
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

  it("cada um marca o que viu; marcar todos; avisos de outros não são marcados", async () => {
    const paula = await entrar("paula");
    let daPaula = await chamar<Aviso[]>("avisos.listar", [], paula);
    expect(daPaula.length).toBeGreaterThan(1);
    expect(daPaula.every((a) => a.lido === false)).toBe(true);

    await chamar("avisos.marcarVistos", [[daPaula[0].id]], paula);
    daPaula = await chamar<Aviso[]>("avisos.listar", [], paula);
    expect(daPaula.find((a) => a.id === daPaula[0].id)?.lido).toBe(true);
    expect(daPaula.filter((a) => !a.lido).length).toBe(daPaula.length - 1);

    // O Marcos acompanha as mesmas pessoas: para ele, continua novo.
    const marcos = await entrar("marcos", paula);
    expect((await chamar<Aviso[]>("avisos.listar", [], marcos)).every((a) => !a.lido)).toBe(true);

    // A Ana não marca aviso que não vê (os da Paula sobre ela).
    const ana = await entrar("ana", marcos);
    const daAna = await chamar<Aviso[]>("avisos.listar", [], ana);
    await chamar("avisos.marcarVistos", [daPaula.map((a) => a.id)], ana);
    expect(await prisma().avisoLido.count({ where: { quem: ana.pessoa!.id, avisoId: { notIn: daAna.map((a) => a.id) } } })).toBe(0);

    const paula2 = await entrar("paula", ana);
    await chamar("avisos.marcarVistos", [null], paula2);
    expect((await chamar<Aviso[]>("avisos.listar", [], paula2)).every((a) => a.lido)).toBe(true);
  });
});
