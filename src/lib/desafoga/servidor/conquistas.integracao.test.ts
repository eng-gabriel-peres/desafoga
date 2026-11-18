/**
 * Conquistas no Postgres de teste: o profissional cria, a compra que alcança a
 * meta desbloqueia uma vez só (parabéns no chat e aviso para quem acompanha).
 * Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("conquistas no Postgres", () => {
  let repo: typeof import("./repositorio");
  let prisma: typeof import("./prisma").prisma;
  let pessoaId: string;
  let profissionalId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    repo = await import("./repositorio");
    prisma = (await import("./prisma")).prisma;
  });

  afterAll(async () => {
    await prisma().$disconnect();
  });

  beforeEach(async () => {
    const espaco = await prisma().espaco.create({ data: { tipo: "REAL" } });
    pessoaId = (await prisma().pessoa.create({ data: { espacoId: espaco.id, nome: "Bia Lima", apelido: "Bia", cor: "azul" } })).id;
    profissionalId = (
      await prisma().profissional.create({ data: { espacoId: espaco.id, nome: "Paula Reis", papel: "Psicóloga", cor: "verde", convite: crypto.randomUUID() } })
    ).id;
  });

  const compra = { item: "Pão", categoria: "Mercado" as const, valor: 1200, emocao: 4 as const, necessidade: "sim" as const, via: "app" as const };
  const daLuana = async () => (await prisma().mensagem.findMany({ where: { pessoaId, de: "assistente" }, orderBy: { quando: "asc" } })).map((m) => m.texto);

  it("criar avisa a pessoa no chat; a compra que alcança a meta desbloqueia uma vez só", async () => {
    const c = await repo.criarConquista(pessoaId, profissionalId, { icone: "caderno", tipo: "registrar", alvo: 2, titulo: "", premio: "Cinema" });
    expect(c).toMatchObject({ titulo: "Anotar 2 compras", autor: "Paula Reis", concluidaEm: null });
    expect(await daLuana()).toEqual([expect.stringMatching(/Nova conquista de Paula Reis para você!\n📝 Anotar 2 compras\nPrêmio: Cinema/)]);

    await repo.registrarCompra(pessoaId, compra);
    expect((await repo.conquistas(pessoaId))[0].concluidaEm).toBeNull();
    await repo.registrarCompra(pessoaId, compra);
    expect((await repo.conquistas(pessoaId))[0].concluidaEm).not.toBeNull();
    // Conferir de novo (agendador, outra tela) não repete os parabéns.
    expect(await repo.conferirConquistas(pessoaId)).toEqual([]);
    const textos = await daLuana();
    expect(textos.filter((t) => t.includes("Conquista desbloqueada"))).toEqual([expect.stringMatching(/📝 Anotar 2 compras\nSeu prêmio: Cinema/)]);
    const avisos = await repo.avisos([pessoaId], { apenas: ["conquista"] });
    expect(avisos.map((a) => a.texto)).toEqual(["Bia desbloqueou a conquista Anotar 2 compras."]);
  });

  it("apagar só a conquista da própria pessoa", async () => {
    const c = await repo.criarConquista(pessoaId, profissionalId, { icone: "broto", tipo: "sem-impulso", alvo: 3, titulo: "Três dias", premio: "" });
    await expect(repo.apagarConquista("outra-pessoa", c.id)).rejects.toThrow();
    await repo.apagarConquista(pessoaId, c.id);
    expect(await repo.conquistas(pessoaId)).toEqual([]);
  });

  describe("pela API, com as sessões da demo", () => {
    type Sessao = import("./sessao").SessaoAtual;
    async function entrar(perfil: string, atual: Sessao | null = null): Promise<Sessao> {
      const { executar } = await import("./rotas");
      const { lerSessao } = await import("./sessao");
      let nova: import("./sessao").NovaSessao | null | undefined;
      await executar("sessao.entrarNaDemo" as never, [perfil], { rede: null, sessao: atual, definirSessao: (s) => (nova = s) });
      return (await lerSessao(nova!.token))!;
    }
    async function chamar(acao: string, args: unknown[], sessao: Sessao) {
      const { executar } = await import("./rotas");
      return executar(acao as never, args, { rede: null, sessao, definirSessao: () => {} });
    }

    it("a demo da Ana já tem conquistas criadas pela Paula", async () => {
      const ana = await entrar("ana");
      const lista = (await chamar("conquistas.listar", [ana.pessoa!.id], ana)) as { autor: string; premio: string }[];
      expect(lista.length).toBeGreaterThanOrEqual(3);
      expect(lista.every((c) => c.autor === "Paula Reis")).toBe(true);
    });

    it("só quem acompanha cria e apaga; a pessoa só vê", async () => {
      const ana = await entrar("ana");
      const p = ana.pessoa!.id;
      const nova = { icone: "estrela", tipo: "registrar", alvo: 50, titulo: "", premio: "Pizza" };
      await expect(chamar("conquistas.criar", [p, nova], ana)).rejects.toThrow();
      const paula = await entrar("paula", ana);
      const c = (await chamar("conquistas.criar", [p, nova], paula)) as { id: string; titulo: string };
      expect(c.titulo).toBe("Anotar 50 compras");
      await expect(chamar("conquistas.criar", [p, { ...nova, alvo: 0 }], paula)).rejects.toThrow();
      await expect(chamar("conquistas.criar", [p, { ...nova, tipo: "outro" }], paula)).rejects.toThrow();
      const ana2 = await entrar("ana", paula);
      await expect(chamar("conquistas.apagar", [p, c.id], ana2)).rejects.toThrow();
      const paula2 = await entrar("paula", ana2);
      await chamar("conquistas.apagar", [p, c.id], paula2);
      expect(((await chamar("conquistas.listar", [p], paula2)) as { id: string }[]).some((x) => x.id === c.id)).toBe(false);
    });
  });
});
