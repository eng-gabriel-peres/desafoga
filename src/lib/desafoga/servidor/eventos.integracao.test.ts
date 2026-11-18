/**
 * Eventos pela API, com as sessões da demo (Ana, Carlos, Paula, Marcos):
 * quem vê, quem cria, mural, ranking e privacidade. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SalaDoEvento } from "./repositorio-eventos";
import type { NovaSessao, SessaoAtual } from "./sessao";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("eventos", { timeout: 30_000 }, () => {
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

  it("a profissional convida; a pessoa só aparece para o grupo depois de aceitar; pode sair", async () => {
    const { paula, ana, carlos } = await demo();
    const { id } = await chamar<{ id: string }>("eventos.criar", [desafio([ana, carlos])], paula);
    const msgs = await prisma().mensagem.findMany({ where: { pessoaId: ana, de: "assistente" }, orderBy: { quando: "desc" }, take: 1 });
    expect(msgs[0].texto).toMatch(/Paula Reis convidou você para o desafio Teste sem delivery!\nRegra: Nenhuma compra de Comida pronta/);

    // Convite pendente: a Ana vê o básico, não vê o grupo nem o mural, e não posta.
    const anaS = await entrar("ana", paula);
    const pendente = await chamar<SalaDoEvento>("eventos.ver", [id], anaS);
    expect(pendente).toMatchObject({ convitePendente: true, participantes: [], posts: [], ranking: null, grupo: null });
    await expect(chamar("eventos.postar", [id, "recado", "oi"], anaS)).rejects.toThrow();
    await chamar("eventos.aceitar", [id], anaS);

    // O Carlos ainda não aceitou: a Ana não o vê.
    const aceita = await chamar<SalaDoEvento>("eventos.ver", [id], anaS);
    expect(aceita.convitePendente).toBe(false);
    expect(aceita.participantes.map((p) => p.pessoaId)).toEqual([ana]);
    expect(aceita.ranking?.map((r) => r.pessoaId)).toEqual([ana]);

    await chamar("eventos.postar", [id, "recado", "Oi, grupo"], anaS);
    const carlosS = await entrar("carlos", anaS);
    await chamar("eventos.aceitar", [id], carlosS);
    const daCarlos = await chamar<SalaDoEvento>("eventos.ver", [id], carlosS);
    // No mural também: dos outros, só o primeiro nome.
    expect(daCarlos.posts.find((p) => p.texto === "Oi, grupo")?.autor.nome).toBe("Ana");
    // Dos outros, só o primeiro nome e nada de data de entrada.
    expect(daCarlos.participantes.find((p) => p.pessoaId === ana)).toMatchObject({ nome: "Ana", entrouEm: null });
    await chamar("eventos.postar", [id, "recado", "Tô dentro"], carlosS);
    await chamar("eventos.sair", [id], carlosS);
    expect((await chamar<{ id: string }[]>("eventos.listar", [], carlosS)).some((e) => e.id === id)).toBe(false);
    const paula2 = await entrar("paula", carlosS);
    const daDona = await chamar<SalaDoEvento>("eventos.ver", [id], paula2);
    expect(daDona.participantes.map((p) => p.pessoaId)).toEqual([ana]);
    // Quem sai leva os próprios posts.
    expect(daDona.posts.some((p) => p.texto === "Tô dentro")).toBe(false);
  });

  it("quem não foi convidado não vê nem posta", async () => {
    const { paula, ana } = await demo();
    const { id } = await chamar<{ id: string }>("eventos.criar", [desafio([ana])], paula);
    const carlosS = await entrar("carlos", paula);
    expect((await chamar<{ id: string }[]>("eventos.listar", [], carlosS)).some((e) => e.id === id)).toBe(false);
    await expect(chamar("eventos.ver", [id], carlosS)).rejects.toThrow();
    await expect(chamar("eventos.postar", [id, "recado", "oi"], carlosS)).rejects.toThrow();
    await expect(chamar("eventos.aceitar", [id], carlosS)).rejects.toThrow();
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
    const carlosS = await entrar("carlos", paula);
    await chamar("eventos.aceitar", [id], carlosS);
    const anaS = await entrar("ana", carlosS);
    await chamar("eventos.aceitar", [id], anaS);
    const paulaS = await entrar("paula", anaS);
    const daDona = await chamar<SalaDoEvento>("eventos.ver", [id], paulaS);
    expect(daDona.ranking).toHaveLength(2);
    expect(daDona.andamento.map((a) => a.pessoaId).sort()).toEqual([ana, carlos].sort());
    const anaS1 = await entrar("ana", paulaS);
    const daAna = await chamar<SalaDoEvento>("eventos.ver", [id], anaS1);
    expect(daAna.ranking?.map((r) => Object.keys(r).sort())[0]).toEqual(["apelido", "contados", "cor", "nome", "ok", "pessoaId", "pontos", "posicao", "sequencia"]);
    expect(daAna.andamento.map((a) => a.pessoaId)).toEqual([ana]);
    expect(JSON.stringify(daAna)).not.toMatch(/"item"|"valor"/);

    const paula2 = await entrar("paula", anaS1);
    await chamar("eventos.configurar", [id, { mostrarRanking: false }], paula2);
    const anaS2 = await entrar("ana", paula2);
    // Sem ranking, nem a porcentagem do grupo (com poucas pessoas, ela entrega os outros).
    expect(await chamar<SalaDoEvento>("eventos.ver", [id], anaS2)).toMatchObject({ ranking: null, grupo: null });
  });

  it("mural: aviso só da dona; apoiar alterna; fixar só a dona; apagar a dona ou quem escreveu", async () => {
    const { paula, ana } = await demo();
    const { id } = await chamar<{ id: string }>("eventos.criar", [desafio([ana])], paula);
    const anaS = await entrar("ana", paula);
    await chamar("eventos.aceitar", [id], anaS);
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
    // Aceitar o convite vira post do sistema.
    expect(sala.posts.some((p) => p.autor.tipo === "sistema")).toBe(true);
  });

  it("presencial: a pessoa responde se vai; a dona remove e apaga o evento", async () => {
    const { paula, ana, lucia } = await demo();
    const presencial = { ...desafio([ana, lucia]), tipo: "presencial", regra: null, categoria: null, inicio: null, fim: null, data: somar(hoje(), 3), hora: "19:00", local: "Sala 2" };
    const { id } = await chamar<{ id: string }>("eventos.criar", [presencial], paula);
    const anaS = await entrar("ana", paula);
    await chamar("eventos.aceitar", [id], anaS);
    await chamar("eventos.responder", [id, "vou"], anaS);
    const sala = await chamar<SalaDoEvento>("eventos.ver", [id], anaS);
    expect(sala.participantes.find((p) => p.pessoaId === ana)?.resposta).toBe("vou");
    const paula2 = await entrar("paula", anaS);
    await chamar("eventos.remover", [id, lucia], paula2);
    expect((await chamar<SalaDoEvento>("eventos.ver", [id], paula2)).participantes.map((p) => p.pessoaId)).toEqual([ana]);
    await chamar("eventos.apagar", [id], paula2);
    await expect(chamar("eventos.ver", [id], paula2)).rejects.toThrow();
  });

  it("compra que tira o dia da regra do desafio: a Luana avisa uma vez (as próximas do dia, não)", async () => {
    const { paula, ana } = await demo();
    const { id } = await chamar<{ id: string }>("eventos.criar", [desafio([ana], { inicio: hoje(), nome: "Sem delivery" })], paula);
    const anaS = await entrar("ana", paula);
    await chamar("eventos.aceitar", [id], anaS);
    const repo = await import("./repositorio");
    const daLuana = async () => (await prisma().mensagem.findMany({ where: { pessoaId: ana, de: "assistente" } })).map((m) => m.texto).filter((t) => t.includes("desafio Sem delivery hoje"));
    await repo.registrarCompra(ana, { item: "Pão", categoria: "Mercado", valor: 800, emocao: 4, necessidade: "sim", via: "app" });
    expect(await daLuana()).toEqual([]);
    await repo.registrarCompra(ana, { item: "Pizza", categoria: "Comida pronta", valor: 5000, emocao: 2, necessidade: "nao", via: "app" });
    expect(await daLuana()).toEqual([expect.stringMatching(/Essa compra ficou fora da regra do desafio Sem delivery hoje \(Nenhuma compra de Comida pronta\)\.\nTudo bem: amanhã é um novo dia\./)]);
    await repo.registrarCompra(ana, { item: "Lanche", categoria: "Comida pronta", valor: 3000, emocao: 2, necessidade: "nao", via: "app" });
    expect(await daLuana()).toHaveLength(1);
  });

  it("link de convite: só o dono liga; o convite mostra o básico; entrar pelo link já aceita; desligar invalida", async () => {
    const { paula, ana, carlos } = await demo();
    const { id } = await chamar<{ id: string }>("eventos.criar", [desafio([ana], { nome: "Com link" })], paula);
    const anaS = await entrar("ana", paula);
    await expect(chamar("eventos.link", [id, true], anaS)).rejects.toThrow();
    const paula2 = await entrar("paula", anaS);
    await chamar("eventos.link", [id, true], paula2);
    const { convite } = await chamar<SalaDoEvento>("eventos.ver", [id], paula2);
    expect(convite).toMatch(/^[A-Za-z0-9_-]{16,}$/);

    // Sem sessão: só o básico, sem nomes de quem participa.
    const publico = await chamar<Record<string, unknown>>("eventos.convite", [convite], null as unknown as SessaoAtual);
    expect(publico).toMatchObject({ nome: "Com link", profissional: "Paula Reis", pessoasNoGrupo: 0 });
    expect(JSON.stringify(publico)).not.toMatch(/Ana|Souza|participantes/);

    const carlosS = await entrar("carlos", paula2);
    const r = await chamar<{ id: string }>("eventos.entrarPeloLink", [convite], carlosS);
    expect(r.id).toBe(id);
    const sala = await chamar<SalaDoEvento>("eventos.ver", [id], carlosS);
    expect(sala.convitePendente).toBe(false);
    expect(sala.posts.some((p) => p.texto === "Carlos entrou no evento pelo link.")).toBe(true);
    void carlos;

    // Conta de outro espaço não entra.
    const deFora = await entrar("lucia");
    await expect(chamar("eventos.entrarPeloLink", [convite], deFora)).rejects.toThrow();

    const paula3 = await entrar("paula", carlosS);
    await chamar("eventos.link", [id, false], paula3);
    await expect(chamar("eventos.convite", [convite], null as unknown as SessaoAtual)).rejects.toThrow();
  });

  it("a demo já vem com os três eventos do protótipo", async () => {
    const { paula } = await demo();
    const lista = await chamar<{ nome: string }[]>("eventos.listar", [], paula);
    expect(lista.map((e) => e.nome).sort()).toEqual(["7 dias sem delivery", "Roda de conversa: compras e emoções", "Semana do essencial"]);
  });
});
