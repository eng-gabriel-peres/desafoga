/**
 * O mês tem que bater com a renda: orçamento, meta e plano das dívidas não
 * passam do que sobra. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NovaSessao, SessaoAtual } from "./sessao";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("dinheiro do mês", { timeout: 30_000 }, () => {
  let prisma: typeof import("./prisma").prisma;
  let repo: typeof import("./repositorio");
  let p: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    prisma = (await import("./prisma")).prisma;
    repo = await import("./repositorio");
  });

  afterAll(async () => {
    await prisma().$disconnect();
  });

  beforeEach(async () => {
    const espaco = await prisma().espaco.create({ data: { tipo: "REAL" } });
    p = (await prisma().pessoa.create({ data: { espacoId: espaco.id, nome: "Bia", apelido: "Bia", cor: "azul", rendaMensal: 500000, diaDaRenda: 5 } })).id;
    await prisma().contaFixa.create({ data: { pessoaId: p, nome: "Aluguel", categoria: "moradia", valor: 300000, vencimento: 10 } });
  });

  it("orçamento: cabe até o que sobra; passou, recusa e diz quanto cabe; diminuir sempre pode", async () => {
    expect(await repo.conferirNoMes(p, { tipo: "orcamento", categoria: "Mercado", limite: 150000 })).toMatchObject({ cabe: true });
    await repo.salvarOrcamento(p, "Mercado", 150000);
    expect(await repo.conferirNoMes(p, { tipo: "orcamento", categoria: "Mercado", limite: 250000 })).toMatchObject({ cabe: false, ate: 200000 });
    expect(await repo.conferirNoMes(p, { tipo: "orcamento", categoria: "Roupa", limite: 60000 })).toMatchObject({ cabe: false, ate: 50000 });
    expect(await repo.conferirNoMes(p, { tipo: "orcamento", categoria: "Mercado", limite: 100000 })).toMatchObject({ cabe: true });
  });

  it("meta: o valor por semana vira valor no mês; editar troca o antigo pelo novo", async () => {
    await repo.salvarOrcamento(p, "Mercado", 150000);
    // Sobram R$ 500: R$ 120 por semana = R$ 520 no mês, não cabe; R$ 100 por semana (R$ 433) cabe.
    expect(await repo.conferirNoMes(p, { tipo: "meta", valorPorPeriodo: 12000, frequencia: "semana" })).toMatchObject({ cabe: false, ate: 50000 });
    expect(await repo.conferirNoMes(p, { tipo: "meta", valorPorPeriodo: 10000, frequencia: "semana" })).toMatchObject({ cabe: true });
  });

  it("plano das dívidas: pagar mais por mês também tem que caber", async () => {
    await prisma().divida.create({ data: { pessoaId: p, tipo: "cartao", nome: "Cartão", detalhe: "", saldo: 400000, taxaMensal: 0.1, parcelaMinima: 20000, vencimento: 15 } });
    expect(await repo.conferirNoMes(p, { tipo: "plano", valorMensal: 150000 })).toMatchObject({ cabe: true });
    expect(await repo.conferirNoMes(p, { tipo: "plano", valorMensal: 250000 })).toMatchObject({ cabe: false });
  });

  it("sem renda informada, não bloqueia", async () => {
    await prisma().pessoa.update({ where: { id: p }, data: { rendaMensal: null } });
    expect(await repo.conferirNoMes(p, { tipo: "orcamento", categoria: "Mercado", limite: 9_000_000 })).toMatchObject({ cabe: true });
  });

  it("pela API: orçamento acima do que sobra é recusado com a mensagem", async () => {
    const { executar } = await import("./rotas");
    const { lerSessao } = await import("./sessao");
    let nova: NovaSessao | null | undefined;
    await executar("sessao.entrarNaDemo" as never, ["ana"], { rede: null, sessao: null, definirSessao: (s) => (nova = s) });
    const ana = (await lerSessao(nova!.token)) as SessaoAtual;
    await expect(executar("orcamentos.salvar" as never, [ana.pessoa!.id, "Lazer", 700000], { rede: null, sessao: ana, definirSessao: () => {} })).rejects.toThrow(
      /passa do que sobra no mês|já passa .* do que entra/,
    );
  });
});
