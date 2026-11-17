/**
 * Ações da API dos bancos conectados e documentos, com sessões de verdade
 * (Ana e Paula da demo, conta real). Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { naturezaDe } from "@/lib/banco/classificar";
import type { Movimento } from "@/lib/banco/tipos";
import type { Contexto } from "./rotas";
import type { NovaSessao, SessaoAtual } from "./sessao";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("ações dos bancos conectados", () => {
  let chamar: (acao: string, args: unknown[], sessao: SessaoAtual | null) => Promise<unknown>;
  let sessaoDe: (n: NovaSessao) => Promise<SessaoAtual>;
  let repo: typeof import("./repositorio");
  let prisma: typeof import("./prisma").prisma;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    const { lerSessao } = await import("./sessao");
    const { executar } = await import("./rotas");
    repo = await import("./repositorio");
    prisma = (await import("./prisma")).prisma;
    sessaoDe = async (n) => (await lerSessao(n.token))!;
    chamar = async (acao, args, sessao) => {
      const ctx: Contexto = { rede: null, sessao, definirSessao: () => {} };
      return executar(acao as never, args, ctx);
    };
  });

  afterAll(async () => {
    await prisma().$disconnect();
  });

  async function entrar(perfil: string, atual: SessaoAtual | null = null): Promise<SessaoAtual> {
    let nova: NovaSessao | null | undefined;
    const { executar } = await import("./rotas");
    await executar("sessao.entrarNaDemo" as never, [perfil], { rede: null, sessao: atual, definirSessao: (s) => (nova = s) });
    return sessaoDe(nova!);
  }

  /** Movimento de uma compra parcelada esperando revisão. */
  async function parceladaParaRevisar(pessoaId: string): Promise<Movimento> {
    const conexao = await repo.criarConexao(pessoaId, { pluggyItemId: null, banco: "Banco Demonstração", logo: null });
    const [cartao] = await repo.salvarContas(conexao.id, [
      { pluggyAccountId: `demo-${crypto.randomUUID()}`, tipo: "cartao", nome: "Cartão", saldo: 0, limite: null, limiteDisponivel: null, fechamento: null, vencimento: null, chequeEspecialUsado: null, chequeEspecialLimite: null },
    ]);
    const { parcelada } = await repo.salvarParcelada(pessoaId, {
      chave: `k-${crypto.randomUUID()}`,
      origem: cartao.id,
      fonte: "pluggy",
      nome: "MERCADOLIVRE*CELULAR",
      lojaOriginal: "MERCADOLIVRE*CELULAR",
      categoria: "Outro",
      valorTotal: 480000,
      valorParcela: 48000,
      totalParcelas: 10,
      mesDaPrimeira: "2026-09",
      compradaEm: "2026-09-02",
      compradaEmEstimada: false,
      compraId: null,
      parcelasVistas: [3],
    });
    const { novos } = await repo.salvarMovimentos(pessoaId, [
      {
        pluggyId: `tx-${crypto.randomUUID()}`,
        contaId: cartao.id,
        data: "2026-11-15",
        descricao: "MERCADOLIVRE*CELULAR 03/10",
        descricaoOriginal: "MERCADOLIVRE*CELULAR 03/10",
        valor: 48000,
        direcao: "saida",
        categoriaPluggy: null,
        parcela: 3,
        totalParcelas: 10,
        valorTotalDaCompra: 480000,
        compradaEm: "2026-09-02",
        faturaPrevista: null,
        cnpj: null,
        mcc: null,
        documentoContraparte: null,
        jurosBoleto: null,
        pendente: false,
        natureza: "compra",
        categoria: "Outro",
        situacao: "revisar",
        compraId: null,
        parceladaId: parcelada.id,
      },
    ]);
    return novos[0];
  }

  it("a profissional só vê o banco se a pessoa compartilha as contas, e não muda nada", async () => {
    const ana = await entrar("ana");
    const paula = await entrar("paula", ana);
    const p = ana.pessoa!.id;
    const visto = (await chamar("banco.listar", [p], paula)) as { compartilhadas: boolean };
    expect(visto.compartilhadas).toBe(true);
    await chamar("rotina.salvar", [p, { compartilharContas: false }], await entrar("ana", paula));
    const escondido = (await chamar("banco.listar", [p], paula)) as { compartilhadas: boolean; movimentos: unknown[]; conexoes: unknown[] };
    expect(escondido).toMatchObject({ compartilhadas: false, movimentos: [], conexoes: [] });
    const m = await parceladaParaRevisar(p);
    await expect(chamar("banco.ignorar", [p, m.id], paula)).rejects.toThrow();
  });

  it("registrar a parcela cria uma compra da parcelada inteira e renomeia a parcelada", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    const m = await parceladaParaRevisar(p);
    await chamar("banco.registrar", [p, m.id, { item: "iPhone pessoal", categoria: "Casa", emocao: 2, necessidade: "nao" }], ana);
    const compra = (await repo.compras(p)).find((c) => c.item === "iPhone pessoal")!;
    expect(compra).toMatchObject({ valor: 480000, parcelas: 10, valorDaParcela: 48000, via: "banco", emocao: 2 });
    const parcelada = (await repo.parceladas(p)).find((x) => x.id === m.parceladaId)!;
    expect(parcelada).toMatchObject({ nome: "iPhone pessoal", categoria: "Casa", compraId: compra.id });
    expect((await repo.movimentoDaPessoa(p, m.id)).situacao).toBe("registrada");
  });

  it("marcar como transferência minha ensina a regra para as próximas", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    const m = await parceladaParaRevisar(p);
    await chamar("banco.marcarTransferencia", [p, m.id], ana);
    expect((await repo.movimentoDaPessoa(p, m.id)).situacao).toBe("ignorada");
    const regras = await repo.regras(p);
    expect(naturezaDe({ ...m, documentoContraparte: null }, { cpfDoTitular: null, regras, tipoDaConta: "corrente" })).toBe("transferencia-propria");
  });

  it("vincular uma sugestão a uma dívida manual", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    const manual = await repo.salvarDivida(p, { tipo: "emprestimo", nome: "Meu consignado", detalhe: "", saldo: 1500000, taxaMensal: 0.03, parcelaMinima: 61000, vencimento: 5 });
    await repo.receberSugestaoDeDivida(p, {
      chave: "itau|emprestimo|61000",
      fonte: "contrato",
      pluggyLoanId: null,
      tipo: "emprestimo",
      nome: "Consignado · Itaú",
      instituicao: "Itaú",
      detalhe: "Consignado",
      saldo: 1840000,
      vencido: null,
      taxaMensal: 0.019,
      parcelaMinima: 61000,
      vencimento: 7,
      parcelasRestantes: 36,
      cet: null,
      temSeguro: true,
      faltaPagarComJuros: null,
      confira: [],
    });
    const s = (await repo.sugestoes(p)).find((x) => x.chave === "itau|emprestimo|61000")!;
    await chamar("banco.vincularSugestao", [p, s.chave, manual.id], ana);
    const d = (await repo.dividas(p)).find((x) => x.id === manual.id)!;
    expect(d).toMatchObject({ origem: "documento", saldo: 1500000, taxaMensal: 0.03, parcelasRestantes: 36, temSeguro: true });
  });

  it("conectar só aceita item da Pluggy criado para esta pessoa", async () => {
    const { conectado } = await import("./banco-acoes");
    const { clienteFalso } = await import("@/lib/banco/cliente-falso");
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    const sem = clienteFalso();
    sem.dados.item = { ...sem.dados.item, clientUserId: null } as never;
    await expect(conectado(p, "item-x", sem)).rejects.toThrow();
    const deOutra = clienteFalso();
    deOutra.dados.item = { ...deOutra.dados.item, clientUserId: "outra-pessoa" };
    await expect(conectado(p, "item-y", deOutra)).rejects.toThrow();
    expect(await repo.conexoes(p)).toHaveLength(0);
    const minha = clienteFalso({ contas: [], transacoes: {}, emprestimos: [] });
    minha.dados.item = { ...minha.dados.item, clientUserId: p };
    expect((await conectado(p, `item-${p}`, minha)).erro).toBeNull();
    expect(await repo.conexoes(p)).toHaveLength(1);
  });

  it("simular compra do banco só na demonstração", async () => {
    const ana = await entrar("ana");
    const antes = (await repo.movimentos(ana.pessoa!.id, { situacao: ["revisar"] })).length;
    await chamar("banco.simularCompra", [ana.pessoa!.id], ana);
    expect((await repo.movimentos(ana.pessoa!.id, { situacao: ["revisar"] })).length).toBe(antes + 1);

    let nova: NovaSessao | null | undefined;
    const { executar } = await import("./rotas");
    await executar("sessao.criarConta" as never, [{ tipo: "pessoa", nome: "Real", apelido: "Real", idade: 30 }], { rede: null, sessao: null, definirSessao: (s) => (nova = s) });
    const real = await sessaoDe(nova!);
    await expect(chamar("banco.simularCompra", [real.pessoa!.id], real)).rejects.toThrow();
  });

  it("trocar para 'não usar compras' tira os avisos pendentes", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    await chamar("banco.simularCompra", [p], ana);
    expect((await repo.movimentos(p, { situacao: ["revisar"] })).length).toBeGreaterThan(0);
    await chamar("banco.modo", [p, "desligado"], ana);
    expect(await repo.movimentos(p, { situacao: ["revisar"] })).toHaveLength(0);
    expect(await repo.avisos([p], { apenas: ["compra-banco"] })).toHaveLength(0);
  });
});
