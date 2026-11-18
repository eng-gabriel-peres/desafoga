/**
 * Conteúdos pela API, com as sessões da demo: quem publica, reações,
 * comentários, seguir e o espaço de cada um. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DetalheDoConteudo, FeedDeConteudos } from "./repositorio-conteudos";
import type { NovaSessao, SessaoAtual } from "./sessao";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("conteúdos", { timeout: 30_000 }, () => {
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

  const dica = { tipo: "dica", tema: "Hábitos", cor: "azul", titulo: "Respire", texto: "Cinco respirações antes de comprar.", corpo: [], cartoes: [], opcoes: [], avisar: true };

  it("a demo vem com os posts do protótipo e os dois profissionais", async () => {
    const ana = await entrar("ana");
    const feed = await chamar<FeedDeConteudos>("conteudos.feed", [], ana);
    expect(feed.conteudos.length).toBe(8);
    expect(feed.criadores.map((c) => c.nome).sort()).toEqual(["Marcos Andrade", "Paula Reis"]);
    const enquete = feed.conteudos.find((c) => c.tipo === "enquete")!;
    expect(enquete.enquete?.total).toBe(174);
  });

  it("só profissional publica; quem segue recebe o aviso da Luana; só o autor apaga", async () => {
    const ana = await entrar("ana");
    await expect(chamar("conteudos.publicar", [dica], ana)).rejects.toThrow();
    const marcos = (await prisma().profissional.findFirstOrThrow({ where: { espacoId: ana.espacoId, slug: "marcos" } })).id;
    await chamar("conteudos.seguir", [marcos], ana);
    const marcosS = await entrar("marcos", ana);
    const { id } = await chamar<{ id: string }>("conteudos.publicar", [dica], marcosS);
    const msg = await prisma().mensagem.findFirstOrThrow({ where: { pessoaId: ana.pessoa!.id, de: "assistente" }, orderBy: { quando: "desc" } });
    expect(msg.texto).toMatch(/Marcos Andrade publicou um conteúdo novo: Respire/);
    const paula = await entrar("paula", marcosS);
    await expect(chamar("conteudos.apagar", [id], paula)).rejects.toThrow();
    const marcos2 = await entrar("marcos", paula);
    await chamar("conteudos.apagar", [id], marcos2);
    await expect(chamar("conteudos.ver", [id], marcos2)).rejects.toThrow();
  });

  it("curtir, salvar e votar alternam; comentário de pessoa mostra só o primeiro nome", async () => {
    const ana = await entrar("ana");
    const feed = await chamar<FeedDeConteudos>("conteudos.feed", [], ana);
    const c = feed.conteudos.find((x) => x.tipo === "enquete")!;
    await chamar("conteudos.reagir", [c.id, "curtir"], ana);
    await chamar("conteudos.reagir", [c.id, "salvar"], ana);
    await chamar("conteudos.votar", [c.id, 2], ana);
    let d = await chamar<DetalheDoConteudo>("conteudos.ver", [c.id], ana);
    expect(d).toMatchObject({ curti: true, salvei: true, curtidas: c.curtidas + 1 });
    expect(d.enquete).toMatchObject({ meu: 2, total: 175 });
    await chamar("conteudos.votar", [c.id, 0], ana);
    await chamar("conteudos.reagir", [c.id, "curtir"], ana);
    d = await chamar<DetalheDoConteudo>("conteudos.ver", [c.id], ana);
    expect(d).toMatchObject({ curti: false, curtidas: c.curtidas });
    expect(d.enquete).toMatchObject({ meu: 0, total: 175 });
    await expect(chamar("conteudos.votar", [c.id, 9], ana)).rejects.toThrow();

    const com = await chamar<{ id: string }>("conteudos.comentar", [c.id, "Gostei muito"], ana);
    d = await chamar<DetalheDoConteudo>("conteudos.ver", [c.id], ana);
    expect(d.listaDeComentarios.find((x) => x.id === com.id)).toMatchObject({ autor: { nome: "Ana", profissional: false }, meu: true, podeApagar: true });
  });

  it("apagar comentário: quem escreveu ou o autor do conteúdo; outro profissional não", async () => {
    const ana = await entrar("ana");
    const feed = await chamar<FeedDeConteudos>("conteudos.feed", [], ana);
    const daPaula = feed.conteudos.find((x) => x.autor.nome === "Paula Reis")!;
    const com = await chamar<{ id: string }>("conteudos.comentar", [daPaula.id, "Oi"], ana);
    const marcos = await entrar("marcos", ana);
    await expect(chamar("conteudos.apagarComentario", [com.id], marcos)).rejects.toThrow();
    const paula = await entrar("paula", marcos);
    await chamar("conteudos.apagarComentario", [com.id], paula);
    const d = await chamar<DetalheDoConteudo>("conteudos.ver", [daPaula.id], paula);
    expect(d.listaDeComentarios.some((x) => x.id === com.id)).toBe(false);
  });

  it("cada espaço vê só os próprios conteúdos", async () => {
    const ana = await entrar("ana");
    const feed = await chamar<FeedDeConteudos>("conteudos.feed", [], ana);
    const outra = await entrar("ana");
    expect(outra.espacoId).not.toBe(ana.espacoId);
    await expect(chamar("conteudos.ver", [feed.conteudos[0].id], outra)).rejects.toThrow();
    await expect(chamar("conteudos.reagir", [feed.conteudos[0].id, "curtir"], outra)).rejects.toThrow();
  });
});
