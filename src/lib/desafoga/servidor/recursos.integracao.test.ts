/**
 * Recurso desligado (apresentação do hackathon): a API recusa as ações dele
 * e os avisos automáticos dele param. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { NovaSessao, SessaoAtual } from "./sessao";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("recursos desligados", { timeout: 30_000 }, () => {
  let prisma: typeof import("./prisma").prisma;
  let repo: typeof import("./repositorio");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    prisma = (await import("./prisma")).prisma;
    repo = await import("./repositorio");
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_RECURSOS_DESLIGADOS = "";
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
  const chamar = async (acao: string, args: unknown[], sessao: SessaoAtual) => {
    const { executar } = await import("./rotas");
    return executar(acao as never, args, { rede: null, sessao, definirSessao: () => {} });
  };

  it("a API recusa as ações do recurso desligado; as dos outros seguem", async () => {
    const ana = await entrar("ana");
    process.env.NEXT_PUBLIC_RECURSOS_DESLIGADOS = "eventos,conquistas";
    await expect(chamar("eventos.listar", [], ana)).rejects.toThrow(/não está disponível/);
    await expect(chamar("conquistas.listar", [ana.pessoa!.id], ana)).rejects.toThrow(/não está disponível/);
    await expect(chamar("conteudos.feed", [], ana)).resolves.toBeTruthy();
  });

  it("desligados, os avisos automáticos param: conquista não desbloqueia e compra fora da regra não avisa", async () => {
    const espaco = await prisma().espaco.create({ data: { tipo: "REAL" } });
    const p = (await prisma().pessoa.create({ data: { espacoId: espaco.id, nome: "Bia", apelido: "Bia", cor: "azul" } })).id;
    await prisma().conquista.create({ data: { pessoaId: p, icone: "caderno", titulo: "Anotar 1 compra", tipo: "registrar", alvo: 1, criadaEm: new Date(Date.now() - 60_000) } });
    process.env.NEXT_PUBLIC_RECURSOS_DESLIGADOS = "conquistas,eventos";
    await repo.registrarCompra(p, { item: "Pão", categoria: "Mercado", valor: 800, emocao: 4, necessidade: "sim", via: "app" });
    expect((await prisma().conquista.findFirstOrThrow({ where: { pessoaId: p } })).concluidaEm).toBeNull();
    expect(await prisma().mensagem.count({ where: { pessoaId: p, texto: { contains: "Conquista desbloqueada" } } })).toBe(0);
  });
});
