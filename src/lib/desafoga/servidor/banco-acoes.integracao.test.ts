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

  it("a demo da Ana já vem com banco, compras para revisar, parcelada e dívidas encontradas", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    const conexoes = await repo.conexoes(p);
    expect(conexoes).toHaveLength(1);
    expect(conexoes[0].pluggyItemId).toBeNull();
    expect(await repo.movimentos(p, { situacao: ["revisar"] })).toHaveLength(3);
    expect(await repo.avisos([p], { apenas: ["compra-banco"] })).toHaveLength(3);
    const parceladas = await repo.parceladas(p);
    expect(parceladas).toHaveLength(1);
    expect(parceladas[0]).toMatchObject({ totalParcelas: 10, valorParcela: 48000 });
    const sugestoes = await repo.sugestoes(p);
    expect(sugestoes.map((s) => s.dados.tipo).sort()).toEqual(["cheque", "emprestimo"]);
    // Extras da entrega 2.
    const cartao = conexoes[0].contas.find((c) => c.tipo === "cartao")!;
    expect(cartao).toMatchObject({ limite: 300000, limiteDisponivel: 45000 });
    expect(cartao.fechamento).not.toBeNull();
    expect(conexoes[0].consentimentoAte).not.toBeNull();
    const [cdb] = await repo.investimentos(p);
    expect(cdb).toMatchObject({ nome: "CDB Viagem" });
    const viagem = (await repo.metas(p)).find((m) => m.nome === "Viagem para a praia")!;
    expect(viagem.guardadoPeloBanco).toBe(cdb.saldo);
    const tipos = (await repo.avisos([p])).map((a) => a.tipo);
    expect(tipos).toEqual(expect.arrayContaining(["limite-cartao", "consentimento"]));

    // O Registrato de exemplo tem o mesmo consignado do extrato: junta, e soma Nubank e Caixa.
    const { lerDocumentoEnviado } = await import("./documentos");
    await lerDocumentoEnviado(p, null, { exemplo: "registrato" });
    const depois = await repo.sugestoes(p);
    expect(depois).toHaveLength(4);
    const consignados = depois.filter((s) => s.dados.tipo === "emprestimo");
    expect(consignados).toHaveLength(1);
    expect(consignados[0].dados).toMatchObject({ fonte: "registrato", parcelaMinima: 61000, saldo: 1840000 });
  });

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

  it("aceitar sugestão completando só alguns campos e o dia de vencimento", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    await repo.receberSugestaoDeDivida(p, {
      chave: "caixa|parcelamento",
      fonte: "registrato",
      pluggyLoanId: null,
      tipo: "parcelamento",
      nome: "Financiamento de veículo · Caixa",
      instituicao: "Caixa",
      detalhe: "Financiamento de veículo",
      saldo: 2290000,
      vencido: null,
      taxaMensal: null,
      parcelaMinima: 0,
      vencimento: null,
      parcelasRestantes: null,
      cet: null,
      temSeguro: null,
      faltaPagarComJuros: null,
      confira: ["taxaMensal", "parcelaMinima", "parcelasRestantes"],
    });
    const d = (await chamar("banco.aceitarSugestao", [p, "caixa|parcelamento", { taxaMensal: 0.019, parcelaMinima: 61000 }, 7], ana)) as { taxaMensal: number; vencimento: number; confira: string[] };
    expect(d).toMatchObject({ taxaMensal: 0.019, vencimento: 7 });
    expect(d.confira).toEqual(["parcelasRestantes"]);
  });

  it("não aceita dívida com juros ou saldo ainda a conferir (não entra no plano a 0%)", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    // A demo já tem o consignado do extrato, com saldo e juros a conferir.
    await expect(chamar("banco.aceitarSugestao", [p, "itau|emprestimo|61000", {}, 7], ana)).rejects.toThrow(/juros|saldo/i);
    const d = (await chamar("banco.aceitarSugestao", [p, "itau|emprestimo|61000", { taxaMensal: 0.019, saldo: 1840000 }], ana)) as { taxaMensal: number };
    expect(d.taxaMensal).toBe(0.019);
  });

  it("a profissional não vê a fatura do banco se a pessoa não compartilha as contas", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    await repo.salvarFatura(p, { id: `aberta:x:${p}`, tipo: "fatura", origem: "Cartão Itaú", mes: "2026-11", lancamentos: [], fonte: "pluggy", total: 100000 });
    await chamar("rotina.salvar", [p, { compartilharContas: false }], ana);
    const paula = await entrar("paula", ana);
    const faturas = (await chamar("faturas.listar", [p], paula)) as { fonte?: string }[];
    // Como no protótipo: sem compartilhar, nenhuma fatura (do banco ou em PDF).
    expect(faturas).toEqual([]);
  });

  it("o servidor recusa correção absurda (taxa acima de 30% ao mês, parcelas quebradas)", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    await expect(chamar("banco.aceitarSugestao", [p, "itau|emprestimo|61000", { taxaMensal: 5, saldo: 1840000 }], ana)).rejects.toThrow();
    const d = (await chamar("banco.aceitarSugestao", [p, "itau|emprestimo|61000", { taxaMensal: 0.019, saldo: 1840000 }], ana)) as { id: string };
    await expect(chamar("dividas.corrigir", [p, d.id, "taxaMensal", 0.9], ana)).rejects.toThrow();
    await expect(chamar("dividas.corrigir", [p, d.id, "parcelasRestantes", 2.5], ana)).rejects.toThrow();
    await expect(chamar("dividas.corrigir", [p, d.id, "parcelasRestantes", 36], ana)).resolves.toBeTruthy();
  });

  it("duplo clique em registrar compra do banco cria uma compra só", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    const [m] = await repo.movimentos(p, { situacao: ["revisar"] });
    const antes = (await repo.compras(p)).length;
    const r = { item: "Ifood", categoria: "Comida pronta", emocao: 3, necessidade: "sim" };
    await Promise.allSettled([chamar("banco.registrar", [p, m.id, r], ana), chamar("banco.registrar", [p, m.id, r], ana)]);
    expect((await repo.compras(p)).length).toBe(antes + 1);
  });

  it("duplo clique em adicionar sugestão cria uma dívida só", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    const antes = (await repo.dividas(p)).length;
    const args = [p, "itau|emprestimo|61000", { taxaMensal: 0.019, saldo: 1840000 }];
    await Promise.allSettled([chamar("banco.aceitarSugestao", args, ana), chamar("banco.aceitarSugestao", args, ana)]);
    expect((await repo.dividas(p)).length).toBe(antes + 1);
  });

  it("a profissional não vê o saldo do banco nas metas se a pessoa não compartilha as contas", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    await chamar("rotina.salvar", [p, { compartilharContas: false }], ana);
    const paula = await entrar("paula", ana);
    const metas = (await chamar("metas.listar", [p], paula)) as { nome: string; guardadoPeloBanco?: number | null; investimentos?: string[] }[];
    const viagem = metas.find((m) => m.nome === "Viagem para a praia")!;
    expect(viagem.guardadoPeloBanco ?? null).toBeNull();
    expect(viagem.investimentos ?? []).toEqual([]);
  });

  it("privacidade: sem compartilhar, a profissional não vê dívidas, plano nem faturas e não sugere valor", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    const paula0 = await entrar("paula", ana);
    expect(((await chamar("dividas.listar", [p], paula0)) as unknown[]).length).toBeGreaterThan(0);
    const ana2 = await entrar("ana", paula0);
    await chamar("rotina.salvar", [p, { compartilharContas: false }], ana2);
    const paula = await entrar("paula", ana2);
    expect(await chamar("dividas.listar", [p], paula)).toEqual([]);
    expect(await chamar("faturas.listar", [p], paula)).toEqual([]);
    expect(await chamar("dividas.plano", [p], paula)).toMatchObject({ valorMensal: 0, valorSugerido: null });
    await expect(chamar("dividas.sugerirValor", [p, 50000], paula)).rejects.toThrow();
    // A própria pessoa continua vendo tudo.
    const ana3 = await entrar("ana", paula);
    expect(((await chamar("dividas.listar", [p], ana3)) as unknown[]).length).toBeGreaterThan(0);
  });

  it("a pessoa vê o que a assistente sabe sobre ela, sem as anotações privadas", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    const m = (await chamar("memoria.minha", [p], ana)) as { caracteristicas: string[]; anotacoes: { privada: boolean }[]; temPrivadas: boolean; evitar?: string };
    expect(m.caracteristicas.length).toBeGreaterThan(0);
    expect(m.anotacoes.every((n) => !n.privada)).toBe(true);
    expect(typeof m.temPrivadas).toBe("boolean");
    expect(m.evitar).toBeUndefined();
    const paula = await entrar("paula", ana);
    await expect(chamar("memoria.minha", [p], paula)).rejects.toThrow();
  });

  it("ligar meta a investimento: ids que não são da pessoa (ou sumiram) são deixados de lado", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    const [cdb] = await repo.investimentos(p);
    const viagem = (await repo.metas(p)).find((m) => m.nome === "Viagem para a praia")!;
    await chamar("metas.ligarInvestimentos", [p, viagem.id, [crypto.randomUUID(), cdb.id]], ana);
    expect((await repo.metas(p)).find((m) => m.id === viagem.id)!.investimentos).toEqual([cdb.id]);
    const [meta] = await repo.metas(p);
    const paula = await entrar("paula", ana);
    await expect(chamar("metas.ligarInvestimentos", [p, meta.id, []], paula)).rejects.toThrow();
    await expect(chamar("banco.aceitarRenda", [p], paula)).rejects.toThrow();
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
    const daPluggy = async () => (await repo.conexoes(p)).filter((c) => c.pluggyItemId);
    expect(await daPluggy()).toHaveLength(0);
    const minha = clienteFalso({ contas: [], transacoes: {}, emprestimos: [] });
    minha.dados.item = { ...minha.dados.item, clientUserId: p };
    expect((await conectado(p, `item-${p}`, minha)).erro).toBeNull();
    expect(await daPluggy()).toHaveLength(1);
  });

  it("Pluggy fora do ar: abrir a conexão falha com mensagem clara", async () => {
    const { tokenDeConexao, RecusaDoBanco } = await import("./banco-acoes");
    const { clienteFalso } = await import("@/lib/banco/cliente-falso");
    const ana = await entrar("ana");
    const erro = await tokenDeConexao(ana.pessoa!.id, true, undefined, clienteFalso({ falhar: true }), true).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(RecusaDoBanco);
    expect((erro as Error).message).toMatch(/Pluggy/);
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

  it("o aviso de compra do banco aparece no sino da pessoa e não no painel da profissional", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    await chamar("banco.simularCompra", [p], ana);
    const meus = (await chamar("avisos.listar", [], ana)) as { tipo: string }[];
    expect(meus.some((a) => a.tipo === "compra-banco")).toBe(true);
    const paula = await entrar("paula", ana);
    const dela = (await chamar("avisos.daPessoa", [p], paula)) as { tipo: string }[];
    const doPainel = (await chamar("avisos.listar", [], paula)) as { tipo: string }[];
    expect([...dela, ...doPainel].some((a) => a.tipo === "compra-banco" || a.tipo === "divida-encontrada")).toBe(false);
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
