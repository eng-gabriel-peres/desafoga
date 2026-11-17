/**
 * Repositório dos bancos conectados e das sugestões de dívida, no Postgres de
 * teste. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Movimento, SugestaoDeDivida } from "@/lib/banco/tipos";

const url = process.env.TEST_DATABASE_URL;

type Repo = typeof import("./repositorio");

describe.runIf(url)("bancos conectados no Postgres", () => {
  let repo: Repo;
  let prisma: typeof import("./prisma").prisma;
  let pessoaId: string;

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
    const p = await prisma().pessoa.create({ data: { espacoId: espaco.id, nome: "Teste", apelido: "Teste", cor: "azul" } });
    pessoaId = p.id;
  });

  async function conexaoComConta() {
    const conexao = await repo.criarConexao(pessoaId, { pluggyItemId: `item-${crypto.randomUUID()}`, banco: "Itaú", logo: null });
    const [conta] = await repo.salvarContas(conexao.id, [
      {
        pluggyAccountId: `acc-${crypto.randomUUID()}`,
        tipo: "corrente",
        nome: "Conta",
        saldo: 1000,
        limite: null,
        limiteDisponivel: null,
        fechamento: null,
        vencimento: null,
        chequeEspecialUsado: null,
        chequeEspecialLimite: null,
      },
    ]);
    return { conexao, conta };
  }

  const movimento = (contaId: string, extra: Partial<Movimento> = {}): Omit<Movimento, "id"> => ({
    pluggyId: `tx-${crypto.randomUUID()}`,
    contaId,
    data: "2026-11-15",
    descricao: "IFOOD",
    descricaoOriginal: "IFOOD",
    valor: 4590,
    direcao: "saida",
    categoriaPluggy: null,
    parcela: null,
    totalParcelas: null,
    valorTotalDaCompra: null,
    compradaEm: null,
    faturaPrevista: null,
    cnpj: null,
    mcc: null,
    documentoContraparte: null,
    jurosBoleto: null,
    pendente: false,
    natureza: "compra",
    categoria: "Comida pronta",
    situacao: "revisar",
    compraId: null,
    parceladaId: null,
    ...extra,
  });

  it("salvar movimentos é idempotente e não desfaz o que a pessoa decidiu", async () => {
    const { conta } = await conexaoComConta();
    const m = movimento(conta.id);
    const primeira = await repo.salvarMovimentos(pessoaId, [m]);
    expect(primeira.novos).toHaveLength(1);
    await repo.mudarMovimento(pessoaId, primeira.novos[0].id, { situacao: "ignorada" });
    const segunda = await repo.salvarMovimentos(pessoaId, [{ ...m, valor: 4600, pendente: false }]);
    expect(segunda.novos).toHaveLength(0);
    const [lido] = await repo.movimentos(pessoaId);
    expect(lido).toMatchObject({ situacao: "ignorada", valor: 4600 });
  });

  it("a trava impede duas sincronizações ao mesmo tempo", async () => {
    const { conexao } = await conexaoComConta();
    expect(await repo.travarSincronizacao(conexao.id)).toBe(true);
    expect(await repo.travarSincronizacao(conexao.id)).toBe(false);
    await repo.soltarSincronizacao(conexao.id);
    expect(await repo.travarSincronizacao(conexao.id)).toBe(true);
  });

  const doRegistrato: SugestaoDeDivida = {
    chave: "itau|emprestimo",
    fonte: "registrato",
    pluggyLoanId: null,
    tipo: "emprestimo",
    nome: "Consignado · Itaú",
    instituicao: "ITAU UNIBANCO S.A.",
    detalhe: "Consignado",
    saldo: 1840000,
    vencido: null,
    taxaMensal: null,
    parcelaMinima: 0,
    vencimento: null,
    parcelasRestantes: null,
    cet: null,
    temSeguro: null,
    faltaPagarComJuros: null,
    confira: ["taxaMensal", "parcelaMinima", "parcelasRestantes"],
  };
  const daPluggy: SugestaoDeDivida = {
    ...doRegistrato,
    chave: "itau|emprestimo|61000",
    fonte: "pluggy",
    pluggyLoanId: "loan-1",
    instituicao: "Itaú",
    taxaMensal: 0.019,
    parcelaMinima: 61000,
    vencimento: 7,
    parcelasRestantes: 36,
    temSeguro: true,
    confira: [],
  };

  it("Registrato e depois Pluggy do mesmo consignado viram uma sugestão só", async () => {
    expect(await repo.receberSugestaoDeDivida(pessoaId, doRegistrato)).toBe("nova");
    expect(await repo.receberSugestaoDeDivida(pessoaId, { ...daPluggy, pluggyLoanId: `loan-${crypto.randomUUID()}` })).toBe("fundida");
    const abertas = await repo.sugestoes(pessoaId);
    expect(abertas).toHaveLength(1);
    expect(abertas[0].dados).toMatchObject({ fonte: "pluggy", taxaMensal: 0.019, parcelaMinima: 61000 });
  });

  it("depois de aceita, a mesma dívida só se atualiza, e a correção da pessoa vale", async () => {
    const loan = `loan-${crypto.randomUUID()}`;
    await repo.receberSugestaoDeDivida(pessoaId, { ...daPluggy, pluggyLoanId: loan });
    const [s] = await repo.sugestoes(pessoaId);
    const divida = await repo.aceitarSugestao(pessoaId, s.chave);
    expect(divida).toMatchObject({ origem: "banco", taxaMensal: 0.019 });
    expect(await repo.receberSugestaoDeDivida(pessoaId, { ...daPluggy, pluggyLoanId: loan, saldo: 1800000 })).toBe("divida-atualizada");
    await repo.corrigirDivida(pessoaId, divida.id, "taxaMensal", 0.04);
    await repo.receberSugestaoDeDivida(pessoaId, { ...daPluggy, pluggyLoanId: loan, saldo: 1800000, taxaMensal: 0.05 });
    const [lida] = await repo.dividas(pessoaId);
    expect(lida).toMatchObject({ taxaMensal: 0.04, saldo: 1800000 });
    expect(await repo.sugestoes(pessoaId)).toHaveLength(0);
  });

  it("o que a pessoa completou por faltar sai quando o banco passa a mandar; o que ela corrigiu fica", async () => {
    const loan = `loan-${crypto.randomUUID()}`;
    await repo.receberSugestaoDeDivida(pessoaId, { ...daPluggy, pluggyLoanId: loan, taxaMensal: null, confira: ["taxaMensal"] });
    const [s] = await repo.sugestoes(pessoaId);
    const d = await repo.aceitarSugestao(pessoaId, s.chave, { taxaMensal: 0.02 });
    expect(d.taxaMensal).toBe(0.02);
    // A pessoa também discorda do saldo do banco.
    await repo.corrigirDivida(pessoaId, d.id, "saldo", 1500000);
    // O banco passa a mandar a taxa (e um saldo novo).
    await repo.receberSugestaoDeDivida(pessoaId, { ...daPluggy, pluggyLoanId: loan, taxaMensal: 0.025, saldo: 1790000, confira: [] });
    const [lida] = await repo.dividas(pessoaId);
    expect(lida.taxaMensal).toBe(0.025);
    expect(lida.saldo).toBe(1500000);
  });

  it("sugestão dispensada não volta", async () => {
    await repo.receberSugestaoDeDivida(pessoaId, doRegistrato);
    await repo.dispensarSugestao(pessoaId, doRegistrato.chave);
    expect(await repo.receberSugestaoDeDivida(pessoaId, doRegistrato)).toBe("ignorada");
    expect(await repo.sugestoes(pessoaId)).toHaveLength(0);
  });

  it("parecida com dívida manual: avisa e não mexe na manual", async () => {
    const manual = await repo.salvarDivida(pessoaId, { tipo: "emprestimo", nome: "Empréstimo do Itaú", detalhe: "", saldo: 1500000, taxaMensal: 0.03, parcelaMinima: 0, vencimento: 5, instituicao: "Itaú" } as never);
    await repo.receberSugestaoDeDivida(pessoaId, doRegistrato);
    const [s] = await repo.sugestoes(pessoaId);
    expect(s.dados.parecidaCom).toBe(manual.id);
    const [d] = await repo.dividas(pessoaId);
    expect(d).toMatchObject({ saldo: 1500000, origem: "manual" });
  });

  it("vincular a sugestão a uma dívida manual guarda os valores dela como correção", async () => {
    const manual = await repo.salvarDivida(pessoaId, { tipo: "emprestimo", nome: "Meu consignado", detalhe: "", saldo: 1500000, taxaMensal: 0.03, parcelaMinima: 61000, vencimento: 5 });
    await repo.receberSugestaoDeDivida(pessoaId, { ...daPluggy, pluggyLoanId: `loan-${crypto.randomUUID()}` });
    const [s] = await repo.sugestoes(pessoaId);
    await repo.vincularSugestao(pessoaId, s.chave, manual.id);
    const [d] = await repo.dividas(pessoaId);
    expect(d).toMatchObject({ origem: "banco", saldo: 1500000, taxaMensal: 0.03, parcelasRestantes: 36 });
  });

  it("parcelada: a mesma compra vista duas vezes vira uma, com as parcelas somadas", async () => {
    const base = {
      chave: "k1",
      origem: "doc:nubank",
      fonte: "documento" as const,
      nome: "MERCADOLIVRE*CELULAR",
      lojaOriginal: "MERCADOLIVRE*CELULAR",
      categoria: "Outro" as const,
      valorTotal: 480000,
      valorParcela: 48000,
      totalParcelas: 10,
      mesDaPrimeira: "2026-09",
      compradaEm: "2026-09-01",
      compradaEmEstimada: true,
      compraId: null,
      parcelasVistas: [3],
    };
    const a = await repo.salvarParcelada(pessoaId, base);
    const b = await repo.salvarParcelada(pessoaId, { ...base, chave: "k2", mesDaPrimeira: "2026-10", parcelasVistas: [4] });
    expect(a.nova).toBe(true);
    expect(b.nova).toBe(false);
    expect(b.parcelada.id).toBe(a.parcelada.id);
    expect(b.parcelada.parcelasVistas.sort()).toEqual([3, 4]);
    await repo.renomearParcelada(pessoaId, a.parcelada.id, "iPhone pessoal", "Casa");
    const [p] = await repo.parceladas(pessoaId);
    expect(p).toMatchObject({ nome: "iPhone pessoal", categoria: "Casa" });
  });

  it("apagar a conexão mantém a compra registrada e devolve a dívida para manual", async () => {
    const { conexao, conta } = await conexaoComConta();
    const compra = await repo.registrarCompra(pessoaId, { item: "iFood", categoria: "Comida pronta", valor: 4590, emocao: 3, necessidade: "sim", via: "banco" });
    await repo.salvarMovimentos(pessoaId, [movimento(conta.id, { situacao: "registrada", compraId: compra.id }), movimento(conta.id)]);
    await repo.receberSugestaoDeDivida(pessoaId, { ...daPluggy, pluggyLoanId: `loan-${crypto.randomUUID()}` }, { conexaoId: conexao.id });
    const [s] = await repo.sugestoes(pessoaId);
    await repo.aceitarSugestao(pessoaId, s.chave);

    expect(await repo.apagarConexao(pessoaId, conexao.id)).toBe(conexao.pluggyItemId);
    expect(await repo.movimentos(pessoaId)).toHaveLength(0);
    expect((await repo.compras(pessoaId)).map((c) => c.id)).toContain(compra.id);
    const [d] = await repo.dividas(pessoaId);
    expect(d.origem).toBe("manual");
    expect(await repo.conexoes(pessoaId)).toHaveLength(0);
  });

  it("desconectar não deixa sobras: correções viram os valores, fatura do banco e avisos somem", async () => {
    const { conexao, conta } = await conexaoComConta();
    const { novos } = await repo.salvarMovimentos(pessoaId, [movimento(conta.id)]);
    await repo.avisarDoMovimento(pessoaId, novos[0].id, "compra-banco", "Compra no banco", new Date());
    await repo.salvarFatura(pessoaId, { id: `aberta:${conta.id}:2026-11`, tipo: "fatura", origem: "Cartão", mes: "2026-11", lancamentos: [], fonte: "pluggy", contaId: conta.id });
    await repo.receberSugestaoDeDivida(pessoaId, { ...daPluggy, pluggyLoanId: `loan-${crypto.randomUUID()}` }, { conexaoId: conexao.id });
    const [s] = await repo.sugestoes(pessoaId);
    const divida = await repo.aceitarSugestao(pessoaId, s.chave);
    await repo.corrigirDivida(pessoaId, divida.id, "saldo", 1500000);

    await repo.apagarConexao(pessoaId, conexao.id);
    const [d] = await repo.dividas(pessoaId);
    expect(d).toMatchObject({ origem: "manual", saldo: 1500000 });
    expect(d.correcoes ?? {}).toEqual({});
    // Editar à mão depois de desconectar vale de verdade.
    await repo.salvarDivida(pessoaId, { ...d, saldo: 1400000 });
    expect((await repo.dividas(pessoaId))[0].saldo).toBe(1400000);
    expect((await repo.faturas(pessoaId)).filter((f) => f.fonte === "pluggy")).toHaveLength(0);
    expect(await repo.avisos([pessoaId], { apenas: ["compra-banco"] })).toHaveLength(0);
  });

  it("modo das compras e regras", async () => {
    expect(await repo.modoCompras(pessoaId)).toBe("revisar");
    await repo.salvarModoCompras(pessoaId, "automatico");
    expect(await repo.modoCompras(pessoaId)).toBe("automatico");
    await repo.salvarRegra(pessoaId, { padrao: "PIXJOAO", efeito: { natureza: "transferencia-propria" } });
    await repo.salvarRegra(pessoaId, { padrao: "PIXJOAO", efeito: { ignorar: true } });
    expect(await repo.regras(pessoaId)).toEqual([{ padrao: "PIXJOAO", efeito: { ignorar: true } }]);
  });
});
