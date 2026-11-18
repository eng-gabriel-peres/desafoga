/**
 * Seu dinheiro: cartões à mão, meio de pagamento das compras, saldo
 * informado com entradas e saídas, faturas e previsão. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DinheiroDaPessoa } from "./repositorio-dinheiro";
import type { NovaSessao, SessaoAtual } from "./sessao";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("seu dinheiro", { timeout: 30_000 }, () => {
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

  /** Pessoa real, renda R$ 2.800 no dia 5, aluguel R$ 900 dia 10, hoje 18/11/2026. */
  async function bia() {
    const espaco = await prisma().espaco.create({ data: { tipo: "REAL" } });
    const p = (await prisma().pessoa.create({ data: { espacoId: espaco.id, nome: "Bia", apelido: "Bia", cor: "azul", rendaMensal: 280000, diaDaRenda: 5 } })).id;
    await prisma().contaFixa.create({ data: { pessoaId: p, nome: "Aluguel", categoria: "moradia", valor: 90000, vencimento: 10 } });
    return p;
  }
  const agora = new Date("2026-11-18T12:00:00-03:00");

  it("sem banco: saldo informado − compras na conta + entradas; cartão à mão forma a fatura do mês certo", async () => {
    const p = await bia();
    await repo.informarSaldo(p, 100000, new Date("2026-11-15T10:00:00-03:00"));
    const nu = await repo.salvarCartao(p, { nome: "Nubank", fechamento: 25, vencimento: 5, limite: 300000 });
    await repo.registrarCompra(p, { item: "Padaria", categoria: "Mercado", valor: 2000, emocao: 4, necessidade: "sim", via: "app", meio: "conta" }, new Date("2026-11-16T09:00:00-03:00"));
    await repo.registrarCompra(p, { item: "Dinheiro vivo", categoria: "Outro", valor: 999, emocao: 4, necessidade: "sim", via: "app", meio: "dinheiro" }, new Date("2026-11-16T09:00:00-03:00"));
    await repo.registrarCompra(p, { item: "Tênis", categoria: "Roupa", valor: 30000, emocao: 4, necessidade: "nao", via: "app", meio: "cartao", cartaoId: nu.id, parcelas: 3, valorDaParcela: 10000 }, new Date("2026-11-17T09:00:00-03:00"));
    await repo.lancarNaConta(p, { valor: 5000, descricao: "Pix do irmão", dia: "2026-11-17" });

    const d: DinheiroDaPessoa = await repo.dinheiroDaPessoa(p, agora);
    expect(d.conectado).toBe(false);
    expect(d.saldo).toBe(100000 - 2000 + 5000);
    expect(d.cartoes.map((c) => c.nome)).toEqual(["Nubank"]);
    expect(d.faturas.map((f) => [f.cartao, f.vence, f.valor])).toEqual([
      ["Nubank", "2026-12-05", 10000],
      ["Nubank", "2027-01-05", 10000],
      ["Nubank", "2027-02-05", 10000],
    ]);
    // Aluguel do dia 10 ainda não foi marcado como pago: sai até o fim do mês.
    expect(d.previsao!.fimDoMes).toBe(d.saldo! - 90000);
    expect(d.previsao!.faturaDoMesQueVem).toBe(10000);
    expect(d.previsao!.mesQueVem).toBe(d.previsao!.fimDoMes + 280000 - 90000 - 10000);

    // Pagar o aluguel tira da conta; pagar a fatura tira da previsão e da conta.
    await repo.pagar(p, "conta", (await repo.contasFixas(p))[0].id, 90000, agora);
    await repo.pagarFatura(p, nu.id, "2026-12-05", 10000, agora);
    const depois = await repo.dinheiroDaPessoa(p, agora);
    expect(depois.saldo).toBe(d.saldo! - 90000 - 10000);
    expect(depois.faturas.map((f) => f.vence)).toEqual(["2027-01-05", "2027-02-05"]);
  });

  it("o que acontece no mesmo dia, depois de informar o saldo, conta; o de antes, não", async () => {
    const p = await bia();
    await repo.registrarCompra(p, { item: "Antes", categoria: "Mercado", valor: 700, emocao: 4, necessidade: "sim", via: "app", meio: "conta" }, new Date("2026-11-18T08:00:00-03:00"));
    await repo.informarSaldo(p, 100000, new Date("2026-11-18T09:00:00-03:00"));
    await repo.registrarCompra(p, { item: "Depois", categoria: "Mercado", valor: 1800, emocao: 4, necessidade: "sim", via: "app", meio: "conta" }, new Date("2026-11-18T10:00:00-03:00"));
    await repo.lancarNaConta(p, { valor: 30000, descricao: "Pix", dia: "2026-11-18" });
    expect((await repo.dinheiroDaPessoa(p, agora)).saldo).toBe(100000 - 1800 + 30000);
  });

  it("sem saldo informado: o app pede (saldo null), mas a previsão de faturas aparece", async () => {
    const p = await bia();
    const d = await repo.dinheiroDaPessoa(p, agora);
    expect(d.saldo).toBeNull();
    expect(d.previsao).toBeNull();
  });

  it("pela API: cartão e compra só da própria pessoa; profissional vê só se a pessoa compartilha", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    const cartao = await chamar<{ id: string }>("cartoes.salvar", [p, { nome: "Inter", fechamento: 10, vencimento: 17, limite: null }], ana);
    await chamar("compras.registrar", [p, { item: "Pão", categoria: "Mercado", valor: 1000, emocao: 4, necessidade: "sim", via: "app", meio: "cartao", cartaoId: cartao.id }], ana);
    await expect(
      chamar("compras.registrar", [p, { item: "Pão", categoria: "Mercado", valor: 1000, emocao: 4, necessidade: "sim", via: "app", meio: "cartao", cartaoId: "outro-cartao" }], ana),
    ).rejects.toThrow();
    await chamar("dinheiro.informarSaldo", [p, 50000], ana);
    expect((await chamar<DinheiroDaPessoa>("dinheiro.ver", [p], ana)).saldo).not.toBeNull();

    const paula = await entrar("paula", ana);
    expect((await chamar<DinheiroDaPessoa>("dinheiro.ver", [p], paula)).compartilhado).toBe(true);
    await expect(chamar("cartoes.salvar", [p, { nome: "X", fechamento: 1, vencimento: 8, limite: null }], paula)).rejects.toThrow();
    const ana2 = await entrar("ana", paula);
    await chamar("rotina.salvar", [p, { compartilharContas: false }], ana2);
    const paula2 = await entrar("paula", ana2);
    expect(await chamar<DinheiroDaPessoa>("dinheiro.ver", [p], paula2)).toMatchObject({ compartilhado: false, saldo: null, faturas: [], extrato: [] });
  });
});
