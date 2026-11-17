/**
 * Documentos enviados (fatura, extrato, Registrato, contrato) gravando nas
 * mesmas estruturas da Pluggy. A leitura da IA é trocada por documentos
 * montados à mão. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONTRATO_DE_EXEMPLO, REGISTRATO_DE_EXEMPLO } from "@/fixtures/desafoga/documentos-de-exemplo";
import { clienteFalso } from "@/lib/banco/cliente-falso";
import type { DocumentoLido } from "@/lib/luana/ler";

const url = process.env.TEST_DATABASE_URL;
const PDF = { bytes: new Uint8Array([37, 80, 68, 70]), mime: "application/pdf" };

const documento = (extra: Partial<DocumentoLido>): DocumentoLido => ({
  legivel: true,
  tipo: "fatura_cartao",
  emissor: "Nubank",
  vencimento: "2026-12-10",
  total: "1.230,00",
  pagamentoMinimo: "184,50",
  taxaRotativoMensal: "14,9%",
  saldoEmConta: null,
  dataBase: null,
  contratos: [],
  lancamentos: [
    { data: "2026-11-02", descricao: "MERCADOLIVRE*CELULAR", valor: "480,00", natureza: "compra", categoria: "compras", parcela: "03/10" },
    { data: "2026-11-05", descricao: "PADARIA DO ZE", valor: "18,50", natureza: "compra", categoria: "alimentacao", parcela: null },
  ],
  ...extra,
});

const extrato = (mes: string, parcela: string): DocumentoLido =>
  documento({
    tipo: "extrato_conta",
    emissor: "Itaú",
    vencimento: null,
    total: null,
    pagamentoMinimo: null,
    taxaRotativoMensal: null,
    lancamentos: [
      { data: `${mes}-07`, descricao: `PARC EMPREST ${parcela}`, valor: "610,00", natureza: "parcela_emprestimo", categoria: "outros", parcela },
      { data: `${mes}-08`, descricao: "SUPERMERCADO", valor: "200,00", natureza: "compra", categoria: "mercado", parcela: null },
    ],
  });

describe.runIf(url)("documentos enviados no Postgres", () => {
  let repo: typeof import("./repositorio");
  let prisma: typeof import("./prisma").prisma;
  let docs: typeof import("./documentos");
  let pessoaId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    repo = await import("./repositorio");
    prisma = (await import("./prisma")).prisma;
    docs = await import("./documentos");
  });

  afterAll(async () => {
    await prisma().$disconnect();
  });

  beforeEach(async () => {
    const espaco = await prisma().espaco.create({ data: { tipo: "REAL" } });
    pessoaId = (await prisma().pessoa.create({ data: { espacoId: espaco.id, nome: "Teste", apelido: "Teste", cor: "azul" } })).id;
  });

  const ler = (doc: DocumentoLido) => docs.lerDocumentoEnviado(pessoaId, PDF, { ler: async () => doc, comIa: true });

  it("Registrato de 3 instituições vira 3 sugestões, e enviar de novo não duplica", async () => {
    const r = await ler(REGISTRATO_DE_EXEMPLO);
    expect(r).toMatchObject({ tipo: "dividas", fonte: "registrato" });
    expect(await repo.sugestoes(pessoaId)).toHaveLength(3);
    await ler(REGISTRATO_DE_EXEMPLO);
    expect(await repo.sugestoes(pessoaId)).toHaveLength(3);
  });

  it("o consignado do Registrato e o da Pluggy do mesmo banco são uma dívida só", async () => {
    await ler(REGISTRATO_DE_EXEMPLO);
    const { sincronizar } = await import("@/lib/banco/sincronizar");
    const c = clienteFalso();
    c.dados.item = { ...c.dados.item, connector: { ...c.dados.item.connector, name: "Itaú Unibanco" } };
    const sufixo = pessoaId.slice(0, 8);
    for (const conta of c.dados.contas) conta.id = `${conta.id}-${sufixo}`;
    c.dados.transacoes = {};
    c.dados.faturas = {};
    c.dados.emprestimos = c.dados.emprestimos.map((l) => ({ ...l, id: `${l.id}-${sufixo}` }));
    const conexao = await repo.criarConexao(pessoaId, { pluggyItemId: `item-${sufixo}`, banco: "Itaú", logo: null });
    await sincronizar(conexao.id, { cliente: c, agora: new Date("2026-11-17T15:00:00-03:00") });
    const consignados = (await repo.sugestoes(pessoaId)).filter((s) => s.dados.tipo === "emprestimo");
    expect(consignados).toHaveLength(1);
    expect(consignados[0].dados.fonte).toBe("pluggy");
  });

  it("contrato vira sugestão com taxa e parcelas", async () => {
    const r = await ler(CONTRATO_DE_EXEMPLO);
    expect(r).toMatchObject({ tipo: "dividas", fonte: "contrato" });
    const [s] = await repo.sugestoes(pessoaId);
    expect(s.dados).toMatchObject({ parcelaMinima: 61000, parcelasRestantes: 36, taxaMensal: 0.019, temSeguro: true });
  });

  it("fatura com parcela: uma parcelada e uma compra, mesmo salvando duas vezes", async () => {
    const r1 = await ler(documento({}));
    if (r1.tipo !== "fatura") throw new Error("esperava fatura");
    const parcela = r1.fatura.lancamentos.find((l) => l.parcela)!;
    await docs.salvarDocumento(pessoaId, r1.fatura, { [parcela.id]: { emocao: 2, necessidade: "nao" } }, null);
    const r2 = await ler(documento({}));
    if (r2.tipo !== "fatura") throw new Error("esperava fatura");
    await docs.salvarDocumento(pessoaId, r2.fatura, {}, null);

    const parceladas = await repo.parceladas(pessoaId);
    expect(parceladas).toHaveLength(1);
    expect(parceladas[0].parcelasVistas).toEqual([3]);
    const compras = (await repo.compras(pessoaId)).filter((c) => c.parcelas);
    expect(compras).toHaveLength(1);
    expect(compras[0]).toMatchObject({ valor: 480000, parcelas: 10, valorDaParcela: 48000, emocao: 2 });
    expect((await repo.faturas(pessoaId)).filter((f) => !f.foraDosCalculos)).toHaveLength(1);
  });

  it("a fatura do mês seguinte com a parcela 04/10 é a mesma parcelada, sem compra nova", async () => {
    const r1 = await ler(documento({}));
    if (r1.tipo !== "fatura") throw new Error();
    await docs.salvarDocumento(pessoaId, r1.fatura, { [r1.fatura.lancamentos[0].id]: { emocao: 3, necessidade: "sim" } }, null);
    const seguinte = documento({
      vencimento: "2027-01-10",
      lancamentos: [{ data: "2026-12-02", descricao: "MERCADOLIVRE*CELULAR", valor: "480,00", natureza: "compra", categoria: "compras", parcela: "04/10" }],
    });
    const r2 = await ler(seguinte);
    if (r2.tipo !== "fatura") throw new Error();
    await docs.salvarDocumento(pessoaId, r2.fatura, {}, null);
    const [p] = await repo.parceladas(pessoaId);
    expect(p.parcelasVistas).toEqual([3, 4]);
    expect((await repo.compras(pessoaId)).filter((c) => c.parcelas)).toHaveLength(1);
  });

  it("três extratos com PARC EMPREST viram uma sugestão; nada entra no orçamento", async () => {
    for (const [mes, p] of [["2026-09", "05/24"], ["2026-10", "06/24"], ["2026-11", "07/24"]] as const) {
      const r = await ler(extrato(mes, p));
      if (r.tipo !== "fatura") throw new Error();
      await docs.salvarDocumento(pessoaId, r.fatura, {}, null);
    }
    const sugestoes = await repo.sugestoes(pessoaId);
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].dados).toMatchObject({ fonte: "extrato", parcelaMinima: 61000, parcelasRestantes: 17 });
    expect((await repo.compras(pessoaId)).some((c) => c.valor === 61000)).toBe(false);
  });

  it("documento ilegível é recusado e nada é gravado", async () => {
    await expect(ler(documento({ legivel: false, lancamentos: [] }))).rejects.toThrow();
    expect(await repo.sugestoes(pessoaId)).toHaveLength(0);
    expect(await repo.faturas(pessoaId)).toHaveLength(0);
  });

  it("PDF sem cartão escolhido vai para o único cartão conectado do mesmo banco", async () => {
    const conexao = await repo.criarConexao(pessoaId, { pluggyItemId: `item-n-${pessoaId}`, banco: "Nubank", logo: null });
    const [cartao] = await repo.salvarContas(conexao.id, [
      { pluggyAccountId: `acc-n-${pessoaId}`, tipo: "cartao", nome: "Cartão Nubank", saldo: 0, limite: null, limiteDisponivel: null, fechamento: null, vencimento: null, chequeEspecialUsado: null, chequeEspecialLimite: null },
    ]);
    const r = await ler(documento({}));
    if (r.tipo !== "fatura") throw new Error();
    await docs.salvarDocumento(pessoaId, r.fatura, {}, null);
    expect((await repo.faturas(pessoaId))[0].contaId).toBe(cartao.id);
    expect((await repo.parceladas(pessoaId))[0].origem).toBe(cartao.id);
  });

  it("se gravar a fatura de novo falhar no meio, a anterior não some", async () => {
    const r1 = await ler(documento({ lancamentos: [{ data: "2026-11-05", descricao: "PADARIA", valor: "18,50", natureza: "compra", categoria: "alimentacao", parcela: null }] }));
    if (r1.tipo !== "fatura") throw new Error();
    await docs.salvarDocumento(pessoaId, r1.fatura, {}, null);
    // Mesma fatura, mas com um número que o banco de dados recusa: a gravação nova falha.
    const quebrada = { ...r1.fatura, id: "outra", lancamentos: r1.fatura.lancamentos.map((l) => ({ ...l, parcela: 3_000_000_000 })) };
    await expect(docs.salvarDocumento(pessoaId, quebrada, {}, null)).rejects.toThrow();
    expect(await repo.faturas(pessoaId)).toHaveLength(1);
  });

  it("PDF ligado a um cartão que já tem a fatura do banco fica fora dos cálculos", async () => {
    const conexao = await repo.criarConexao(pessoaId, { pluggyItemId: `item-${pessoaId}`, banco: "Nubank", logo: null });
    const [cartao] = await repo.salvarContas(conexao.id, [
      { pluggyAccountId: `acc-${pessoaId}`, tipo: "cartao", nome: "Nubank", saldo: 123000, limite: null, limiteDisponivel: null, fechamento: "2026-12-03", vencimento: "2026-12-10", chequeEspecialUsado: null, chequeEspecialLimite: null },
    ]);
    await repo.salvarFatura(pessoaId, { id: `aberta:${cartao.id}:2026-12`, tipo: "fatura", origem: "Nubank", mes: "2026-12", lancamentos: [], fonte: "pluggy", contaId: cartao.id, total: 123000 });
    const r = await ler(documento({}));
    if (r.tipo !== "fatura") throw new Error();
    await docs.salvarDocumento(pessoaId, r.fatura, {}, cartao.id);
    const faturas = await repo.faturas(pessoaId);
    expect(faturas.find((f) => f.fonte === "documento")!.foraDosCalculos).toBe(true);
    expect(faturas.find((f) => f.fonte === "pluggy")!.pagamentoMinimo).toBe(18450);
  });
});
