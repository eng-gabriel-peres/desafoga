/**
 * Eventos pela API, com as sessões da demo (Ana, Carlos, Paula, Marcos):
 * quem vê, quem cria, mural, ranking e privacidade. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SalaDoEvento } from "./repositorio-eventos";
import type { NovaSessao, SessaoAtual } from "./sessao";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("eventos", () => {
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

  /** Espaço da demo com Paula e os ids de Ana e Carlos. */
  async function demo() {
    const paula = await entrar("paula");
    const espaco = paula.espacoId;
    const pessoas = await prisma().pessoa.findMany({ where: { espacoId: espaco }, select: { id: true, slug: true } });
    const id = (slug: string) => pessoas.find((p) => p.slug === slug)!.id;
    return { paula, ana: id("ana"), carlos: id("carlos"), lucia: id("lucia") };
  }

  const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const somar = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

  function desafio(participantes: string[], extra: Record<string, unknown> = {}) {
    return {
      tipo: "desafio",
      nome: "Teste sem delivery",
      descricao: "",
      regra: "sem-categoria",
      categoria: "Comida pronta",
      limite: null,
      inicio: somar(hoje(), -2),
      fim: somar(hoje(), 4),
      data: null,
      hora: null,
      local: null,
      premio: "Café juntos",
      mostrarRanking: true,
      participantes,
      ...extra,
    };
  }

  it("a profissional cria um desafio; a Luana avisa quem entrou; só participantes e a dona veem", async () => {
    const { paula, ana, carlos } = await demo();
    const { id } = await chamar<{ id: string }>("eventos.criar", [desafio([ana])], paula);
    const msgs = await prisma().mensagem.findMany({ where: { pessoaId: ana, de: "assistente" }, orderBy: { quando: "desc" }, take: 1 });
    expect(msgs[0].texto).toMatch(/Você entrou no desafio Teste sem delivery!\nRegra: Nenhuma compra de Comida pronta/);

    const anaS = await entrar("ana", paula);
    expect((await chamar<{ id: string }[]>("eventos.listar", [], anaS)).some((e) => e.id === id)).toBe(true);
    const carlosS = await entrar("carlos", anaS);
    expect((await chamar<{ id: string }[]>("eventos.listar", [], carlosS)).some((e) => e.id === id)).toBe(false);
    await expect(chamar("eventos.ver", [id], carlosS)).rejects.toThrow();
    await expect(chamar("eventos.postar", [id, "recado", "oi"], carlosS)).rejects.toThrow();
    void carlos;
  });

  it("pessoa não cria evento nem põe quem a profissional não acompanha", async () => {
    const { paula, ana } = await demo();
    const anaS = await entrar("ana", paula);
    await expect(chamar("eventos.criar", [desafio([ana])], anaS)).rejects.toThrow();
    const paula2 = await entrar("paula", anaS);
    const outro = await entrar("paula");
    const deOutroEspaco = (await prisma().pessoa.findFirstOrThrow({ where: { espacoId: outro.espacoId, slug: "ana" } })).id;
    await expect(chamar("eventos.criar", [desafio([ana, deOutroEspaco])], paula2)).rejects.toThrow();
  });

  it("ranking: a pessoa vê nome e pontos dos outros, nunca as compras nem os dias deles; desligado, só a dona vê", async () => {
    const { paula, ana, carlos } = await demo();
    const { id } = await chamar<{ id: string }>("eventos.criar", [desafio([ana, carlos])], paula);
    const daDona = await chamar<SalaDoEvento>("eventos.ver", [id], paula);
    expect(daDona.ranking).toHaveLength(2);
    expect(daDona.andamento.map((a) => a.pessoaId).sort()).toEqual([ana, carlos].sort());

    const anaS = await entrar("ana", paula);
    const daAna = await chamar<SalaDoEvento>("eventos.ver", [id], anaS);
    expect(daAna.ranking?.map((r) => Object.keys(r).sort())[0]).toEqual(["apelido", "contados", "cor", "nome", "ok", "pessoaId", "pontos", "posicao", "sequencia"]);
    expect(daAna.andamento.map((a) => a.pessoaId)).toEqual([ana]);
    expect(JSON.stringify(daAna)).not.toMatch(/"item"|"valor"/);

    const paula2 = await entrar("paula", anaS);
    await chamar("eventos.configurar", [id, { mostrarRanking: false }], paula2);
    const anaS2 = await entrar("ana", paula2);
    expect((await chamar<SalaDoEvento>("eventos.ver", [id], anaS2)).ranking).toBeNull();
  });

  it("mural: aviso só da dona; apoiar alterna; fixar só a dona; apagar a dona ou quem escreveu", async () => {
    const { paula, ana } = await demo();
    const { id } = await chamar<{ id: string }>("eventos.criar", [desafio([ana])], paula);
    const anaS = await entrar("ana", paula);
    await expect(chamar("eventos.postar", [id, "aviso", "Atenção"], anaS)).rejects.toThrow();
    const post = await chamar<{ id: string }>("eventos.postar", [id, "dica", "Fiz marmita"], anaS);
    await chamar("eventos.apoiar", [id, post.id], anaS);
    let sala = await chamar<SalaDoEvento>("eventos.ver", [id], anaS);
    expect(sala.posts.find((p) => p.id === post.id)).toMatchObject({ apoios: 1, apoiei: true, meu: true });
    await chamar("eventos.apoiar", [id, post.id], anaS);
    sala = await chamar<SalaDoEvento>("eventos.ver", [id], anaS);
    expect(sala.posts.find((p) => p.id === post.id)).toMatchObject({ apoios: 0, apoiei: false });
    await expect(chamar("eventos.fixar", [id, post.id], anaS)).rejects.toThrow();

    const paula2 = await entrar("paula", anaS);
    await chamar("eventos.fixar", [id, post.id], paula2);
    const aviso = await chamar<{ id: string }>("eventos.postar", [id, "aviso", "Bem-vindos!"], paula2);
    const anaS2 = await entrar("ana", paula2);
    await expect(chamar("eventos.apagarPost", [id, aviso.id], anaS2)).rejects.toThrow();
    await chamar("eventos.apagarPost", [id, post.id], anaS2);
    sala = await chamar<SalaDoEvento>("eventos.ver", [id], anaS2);
    expect(sala.posts.some((p) => p.id === post.id)).toBe(false);
    // Entrar no evento vira post do sistema.
    expect(sala.posts.some((p) => p.autor.tipo === "sistema")).toBe(true);
  });

  it("presencial: a pessoa responde se vai; a dona remove e apaga o evento", async () => {
    const { paula, ana, lucia } = await demo();
    const presencial = { ...desafio([ana, lucia]), tipo: "presencial", regra: null, categoria: null, inicio: null, fim: null, data: somar(hoje(), 3), hora: "19:00", local: "Sala 2" };
    const { id } = await chamar<{ id: string }>("eventos.criar", [presencial], paula);
    const anaS = await entrar("ana", paula);
    await chamar("eventos.responder", [id, "vou"], anaS);
    const sala = await chamar<SalaDoEvento>("eventos.ver", [id], anaS);
    expect(sala.participantes.find((p) => p.pessoaId === ana)?.resposta).toBe("vou");
    const paula2 = await entrar("paula", anaS);
    await chamar("eventos.remover", [id, lucia], paula2);
    expect((await chamar<SalaDoEvento>("eventos.ver", [id], paula2)).participantes.map((p) => p.pessoaId)).toEqual([ana]);
    await chamar("eventos.apagar", [id], paula2);
    await expect(chamar("eventos.ver", [id], paula2)).rejects.toThrow();
  });

  it("a demo já vem com os três eventos do protótipo", async () => {
    const { paula } = await demo();
    const lista = await chamar<{ nome: string }[]>("eventos.listar", [], paula);
    expect(lista.map((e) => e.nome).sort()).toEqual(["7 dias sem delivery", "Roda de conversa: compras e emoções", "Semana do essencial"]);
  });
});
