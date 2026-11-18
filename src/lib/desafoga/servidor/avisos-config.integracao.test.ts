/**
 * "Avisos no WhatsApp" do painel: o profissional configura, a compra alta
 * segue o valor escolhido e o dia difícil avisa uma vez. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NovaSessao, SessaoAtual } from "./sessao";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("avisos do acompanhamento", { timeout: 30_000 }, () => {
  let prisma: typeof import("./prisma").prisma;
  let repo: typeof import("./repositorio");
  let pessoaId: string;

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
    pessoaId = (await prisma().pessoa.create({ data: { espacoId: espaco.id, nome: "Bia Lima", apelido: "Bia", cor: "azul" } })).id;
  });

  const compra = (valor: number, emocao: 1 | 2 | 3 | 4 | 5) => ({ item: "Tênis", categoria: "Roupa" as const, valor, emocao, necessidade: "nao" as const, via: "app" as const });
  const avisos = async (tipo: string) => (await repo.avisos([pessoaId], { apenas: [tipo] })).map((a) => a.texto);

  it("padrão: compra alta a partir de R$ 200, dia difícil e resumo ligados, lembrete diário desligado", async () => {
    expect(await repo.configDosAvisos(pessoaId)).toEqual({
      lembreteDiario: false,
      horaDoLembrete: "21:00",
      compraAlta: true,
      valorDaCompraAlta: 20000,
      diaDificil: true,
      resumoDaSemana: true,
    });
  });

  it("compra alta segue o valor e o liga/desliga configurados", async () => {
    await repo.salvarConfigDosAvisos(pessoaId, { valorDaCompraAlta: 50000 });
    await repo.registrarCompra(pessoaId, compra(30000, 4));
    expect(await avisos("gasto-alto")).toEqual([]);
    await repo.registrarCompra(pessoaId, compra(60000, 4));
    expect(await avisos("gasto-alto")).toEqual(["Bia registrou uma compra de R$ 600,00 (Tênis)."]);
    await repo.salvarConfigDosAvisos(pessoaId, { compraAlta: false });
    await repo.registrarCompra(pessoaId, compra(90000, 4));
    expect(await avisos("gasto-alto")).toHaveLength(1);
  });

  it("dia difícil: nota do dia em 2 ou menos avisa quem acompanha uma vez por dia; desligado, não avisa", async () => {
    await repo.registrarCompra(pessoaId, compra(1000, 3));
    expect(await avisos("nota-baixa")).toEqual([]);
    await repo.registrarCompra(pessoaId, compra(1000, 1));
    expect(await avisos("nota-baixa")).toEqual(["A nota do dia de Bia está em 2,0 (Dia triste)."]);
    await repo.registrarCompra(pessoaId, compra(1000, 1));
    expect(await avisos("nota-baixa")).toHaveLength(1);

    const outra = (await prisma().pessoa.create({ data: { espacoId: (await prisma().pessoa.findUniqueOrThrow({ where: { id: pessoaId } })).espacoId, nome: "Cris", apelido: "Cris", cor: "azul" } })).id;
    await repo.salvarConfigDosAvisos(outra, { diaDificil: false });
    await repo.registrarCompra(outra, compra(1000, 1));
    expect(await repo.avisos([outra], { apenas: ["nota-baixa"] })).toEqual([]);
  });

  it("pela API: só quem acompanha muda; a pessoa vê; valores absurdos são recusados", async () => {
    const { executar } = await import("./rotas");
    const { lerSessao } = await import("./sessao");
    const entrar = async (perfil: string, atual: SessaoAtual | null = null) => {
      let nova: NovaSessao | null | undefined;
      await executar("sessao.entrarNaDemo" as never, [perfil], { rede: null, sessao: atual, definirSessao: (s) => (nova = s) });
      return (await lerSessao(nova!.token))!;
    };
    const chamar = (acao: string, args: unknown[], sessao: SessaoAtual) => executar(acao as never, args, { rede: null, sessao, definirSessao: () => {} });
    const paula = await entrar("paula");
    const ana = (await prisma().pessoa.findFirstOrThrow({ where: { espacoId: paula.espacoId, slug: "ana" } })).id;
    await chamar("avisos.configurar", [ana, { horaDoLembrete: "20:00", valorDaCompraAlta: 30000 }], paula);
    await expect(chamar("avisos.configurar", [ana, { horaDoLembrete: "25:00" }], paula)).rejects.toThrow();
    await expect(chamar("avisos.configurar", [ana, { valorDaCompraAlta: 0 }], paula)).rejects.toThrow();
    const anaS = await entrar("ana", paula);
    expect(await chamar("avisos.config", [ana], anaS)).toMatchObject({ horaDoLembrete: "20:00", valorDaCompraAlta: 30000 });
    await expect(chamar("avisos.configurar", [ana, { lembreteDiario: false }], anaS)).rejects.toThrow();
  });
});
