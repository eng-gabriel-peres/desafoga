/**
 * Sincronização com a Pluggy (cliente falso com as respostas do sandbox) no
 * Postgres de teste. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clienteFalso } from "./cliente-falso";
import type { PluggyTransacao } from "./pluggy";

const url = process.env.TEST_DATABASE_URL;
const AGORA = new Date("2026-11-17T15:00:00-03:00");
const CONTA = "891f0e61-463b-44b1-a914-908e579ac8df";
const CARTAO = "d2cbd67e-2de7-45b3-bdae-63ab6541349f";

describe.runIf(url)("sincronizar com a Pluggy", () => {
  let repo: typeof import("@/lib/desafoga/servidor/repositorio");
  let prisma: typeof import("@/lib/desafoga/servidor/prisma").prisma;
  let sincronizar: typeof import("./sincronizar").sincronizar;
  let pessoaId: string;
  let conexaoId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    repo = await import("@/lib/desafoga/servidor/repositorio");
    prisma = (await import("@/lib/desafoga/servidor/prisma")).prisma;
    sincronizar = (await import("./sincronizar")).sincronizar;
  });

  afterAll(async () => {
    await prisma().$disconnect();
  });

  beforeEach(async () => {
    const espaco = await prisma().espaco.create({ data: { tipo: "REAL" } });
    const p = await prisma().pessoa.create({ data: { espacoId: espaco.id, nome: "Teste", apelido: "Teste", cor: "azul" } });
    pessoaId = p.id;
    // Cada teste usa ids próprios: as contas e transações da Pluggy são únicas no banco.
    const c = await repo.criarConexao(pessoaId, { pluggyItemId: `item-${crypto.randomUUID()}`, banco: "Pluggy Bank", logo: null });
    conexaoId = c.id;
    await prisma().conexaoBancaria.update({ where: { id: conexaoId }, data: { conectadaEm: AGORA } });
  });

  /** Cliente falso com ids únicos para este teste. */
  function cliente(extra: Parameters<typeof clienteFalso>[0] = {}) {
    const base = clienteFalso(extra);
    const sufixo = conexaoId.slice(0, 8);
    const trocar = (id: string) => `${id}-${sufixo}`;
    const dados = base.dados;
    for (const conta of dados.contas) conta.id = trocar(conta.id);
    dados.transacoes = Object.fromEntries(
      Object.entries(dados.transacoes).map(([conta, lista]) => [trocar(conta), lista.map((t) => ({ ...t, id: trocar(t.id), accountId: trocar(conta) }))]),
    );
    dados.faturas = Object.fromEntries(Object.entries(dados.faturas).map(([conta, l]) => [trocar(conta), l]));
    dados.emprestimos = dados.emprestimos.map((l) => ({ ...l, id: trocar(l.id) }));
    dados.investimentos = dados.investimentos.map((i) => ({ ...i, id: trocar(i.id) }));
    return base;
  }

  const sync = (c = cliente(), extra: { pedirAtualizacao?: boolean } = {}) => sincronizar(conexaoId, { cliente: c, agora: AGORA, ...extra });
  const avisosDeCompra = async () => (await repo.avisos([pessoaId], { apenas: ["compra-banco"] })).length;

  it("primeira sincronização: contas, movimentos e avisos só dos últimos 7 dias", async () => {
    const r = await sync();
    expect(r.erro).toBeNull();
    expect(r.contas).toBe(2);
    const movs = await repo.movimentos(pessoaId);
    expect(movs).toHaveLength(50);
    const revisar = movs.filter((m) => m.situacao === "revisar");
    expect(revisar.length).toBeGreaterThan(0);
    expect(revisar.every((m) => m.data >= "2026-11-10")).toBe(true);
    expect(await avisosDeCompra()).toBe(revisar.length);
    expect((await repo.conversa(pessoaId)).filter((m) => m.de === "assistente")).toHaveLength(revisar.length);
    expect((await repo.conexoes(pessoaId))[0]).toMatchObject({ status: "ok" });
  });

  it("sincronizar de novo não duplica nada", async () => {
    await sync();
    const antes = { avisos: await avisosDeCompra(), msgs: (await repo.conversa(pessoaId)).length, sugestoes: (await repo.sugestoes(pessoaId)).length };
    const r = await sync();
    expect(r.novos).toBe(0);
    expect(await repo.movimentos(pessoaId)).toHaveLength(50);
    expect({ avisos: await avisosDeCompra(), msgs: (await repo.conversa(pessoaId)).length, sugestoes: (await repo.sugestoes(pessoaId)).length }).toEqual(antes);
  });

  it("modo automático cria compras sem emoção", async () => {
    await repo.salvarModoCompras(pessoaId, "automatico");
    await sync();
    const doBanco = (await repo.compras(pessoaId)).filter((c) => c.via === "banco");
    expect(doBanco.length).toBeGreaterThan(0);
    expect(doBanco.every((c) => c.emocao === null && c.necessidade === null)).toBe(true);
    expect(await avisosDeCompra()).toBe(0);
  });

  it("modo desligado não avisa nem registra", async () => {
    await repo.salvarModoCompras(pessoaId, "desligado");
    await sync();
    expect(await avisosDeCompra()).toBe(0);
    expect((await repo.compras(pessoaId)).filter((c) => c.via === "banco")).toHaveLength(0);
  });

  it("o consignado vira sugestão; aceito, a próxima sincronização só atualiza a dívida", async () => {
    await sync();
    const [s] = (await repo.sugestoes(pessoaId)).filter((x) => x.dados.fonte === "pluggy" && x.dados.tipo === "emprestimo");
    expect(s.dados).toMatchObject({ parcelaMinima: 100004, temSeguro: true });
    expect((await repo.avisos([pessoaId], { apenas: ["divida-encontrada"] })).length).toBe(1);
    await repo.aceitarSugestao(pessoaId, s.chave);
    await sync();
    expect((await repo.sugestoes(pessoaId)).filter((x) => x.dados.tipo === "emprestimo")).toHaveLength(0);
    const dividas = (await repo.dividas(pessoaId)).filter((d) => d.origem === "banco");
    expect(dividas).toHaveLength(1);
  });

  it("Pluggy fora do ar: conexão com erro e nada apagado", async () => {
    await sync();
    const r = await sync(cliente({ falhar: true }));
    // Mensagem para a pessoa, sem o texto técnico da Pluggy.
    expect(r.erro).toBe("Não consegui ler o banco agora. Tente atualizar daqui a pouco.");
    expect((await repo.conexoes(pessoaId))[0].status).toBe("erro");
    expect(await repo.movimentos(pessoaId)).toHaveLength(50);
    // a trava foi solta: dá para sincronizar de novo
    expect((await sync()).erro).toBeNull();
  });

  it("transação pendente que é confirmada com outro valor não gera aviso novo; apagada, o aviso some", async () => {
    const c1 = cliente();
    const cartao = Object.keys(c1.dados.transacoes).find((k) => k.startsWith(CARTAO))!;
    const smart = c1.dados.transacoes[cartao].find((t) => t.description === "SMART FIT ACADEMIA")!;
    smart.status = "PENDING" as PluggyTransacao["status"];
    await sync(c1);
    const avisos = await avisosDeCompra();
    const c2 = cliente();
    const smart2 = c2.dados.transacoes[cartao].find((t) => t.description === "SMART FIT ACADEMIA")!;
    smart2.amount = -99.9;
    await sync(c2);
    expect(await avisosDeCompra()).toBe(avisos);
    const m = (await repo.movimentos(pessoaId)).find((x) => x.pluggyId === smart.id)!;
    expect(m).toMatchObject({ valor: 9990, pendente: false });
    await repo.apagarMovimentos([smart.id]);
    expect(await avisosDeCompra()).toBe(avisos - 1);
  });

  it("compra já registrada à mão não vira aviso", async () => {
    await repo.registrarCompra(pessoaId, { item: "Academia", categoria: "Lazer", valor: 8990, emocao: 4, necessidade: "sim", via: "app" }, new Date("2026-11-10T19:00:00-03:00"));
    await sync();
    const smart = (await repo.movimentos(pessoaId)).find((m) => m.descricao === "SMART FIT ACADEMIA" && m.data === "2026-11-10")!;
    expect(smart.situacao).toBe("registrada");
    expect(smart.compraId).not.toBeNull();
  });

  it("parcelada já vista num PDF é a mesma quando a Pluggy vê outra parcela", async () => {
    const c = cliente();
    await sync(c);
    const contaDoCartao = (await repo.conexoes(pessoaId))[0].contas.find((x) => x.tipo === "cartao")!;
    // Recomeça só as parceladas: o PDF tinha visto a parcela 1/6 em abril.
    await prisma().movimento.updateMany({ where: { pessoaId }, data: { parceladaId: null } });
    await prisma().compraParcelada.deleteMany({ where: { pessoaId } });
    await repo.salvarParcelada(pessoaId, {
      chave: "do-pdf",
      origem: contaDoCartao.id,
      fonte: "documento",
      nome: "NETFLIX.COM",
      lojaOriginal: "NETFLIX.COM",
      categoria: "Lazer",
      valorTotal: 33540,
      valorParcela: 5590,
      totalParcelas: 6,
      mesDaPrimeira: "2026-04",
      compradaEm: "2026-04-01",
      compradaEmEstimada: true,
      compraId: null,
      parcelasVistas: [1],
    });
    await prisma().movimento.deleteMany({ where: { pessoaId, contaId: contaDoCartao.id } });
    await sync(c);
    const parceladas = await repo.parceladas(pessoaId);
    expect(parceladas).toHaveLength(1);
    expect(parceladas[0].parcelasVistas).toEqual([1, 2]);
  });

  it("a fatura em PDF do mesmo cartão e mês sai dos cálculos e completa a da Pluggy", async () => {
    await sync();
    const cartao = (await repo.conexoes(pessoaId))[0].contas.find((x) => x.tipo === "cartao")!;
    await repo.salvarFatura(pessoaId, { id: "pdf", tipo: "fatura", origem: "Mastercard", mes: "2026-11", lancamentos: [], contaId: cartao.id, fonte: "documento", pagamentoMinimo: 18450 });
    await sync();
    const faturas = await repo.faturas(pessoaId);
    const doPdf = faturas.find((f) => f.fonte === "documento")!;
    const daPluggy = faturas.find((f) => f.fonte === "pluggy" && f.contaId === cartao.id)!;
    expect(doPdf.foraDosCalculos).toBe(true);
    expect(daPluggy).toMatchObject({ mes: "2026-11", pagamentoMinimo: 18450, total: 100620 });
  });

  it("item OUTDATED (desatualizado no banco) não pede reconexão: lê o que tem", async () => {
    const c = cliente();
    c.dados.item = { ...c.dados.item, status: "OUTDATED" };
    const r = await sync(c);
    expect(r.erro).toBeNull();
    expect((await repo.conexoes(pessoaId))[0].status).toBe("ok");
    expect(await repo.movimentos(pessoaId)).toHaveLength(50);
  });

  it("releitura (transactions/updated) atualiza transações antigas, não só as recém-criadas", async () => {
    const c1 = cliente();
    await sync(c1);
    const c2 = cliente();
    const conta = Object.keys(c2.dados.transacoes).find((k) => k.startsWith(CONTA))!;
    const condominio = c2.dados.transacoes[conta].find((t) => t.description === "CONDOMINIO EDIFICIO SOLAR")!;
    condominio.amount = -850;
    // createdAt antigo: a leitura incremental não pegaria.
    condominio.createdAt = new Date("2026-11-01T00:00:00Z");
    await sincronizar(conexaoId, { cliente: c2, agora: AGORA, releituraDias: 30 });
    const m = (await repo.movimentos(pessoaId)).find((x) => x.pluggyId === condominio.id)!;
    expect(m.valor).toBe(85000);
  });

  it("um produto opcional que falha (empréstimos) não derruba a sincronização", async () => {
    const r = await sync(cliente({ falharEm: ["emprestimos"] }));
    expect(r.erro).toBeNull();
    const [c] = await repo.conexoes(pessoaId);
    expect(c.status).toBe("ok");
    expect(c.ultimaSincronizacao).not.toBeNull();
    expect((await repo.faturas(pessoaId)).some((f) => f.fonte === "pluggy")).toBe(true);
  });

  it("ao conectar o cartão, a parcelada e a fatura do PDF do mesmo banco passam para ele", async () => {
    await repo.salvarParcelada(pessoaId, {
      chave: "pdf",
      origem: "doc:pluggybank",
      fonte: "documento",
      nome: "LOJA X",
      lojaOriginal: "LOJA X",
      categoria: "Outro",
      valorTotal: 60000,
      valorParcela: 10000,
      totalParcelas: 6,
      mesDaPrimeira: "2026-10",
      compradaEm: "2026-10-01",
      compradaEmEstimada: true,
      compraId: null,
      parcelasVistas: [2],
    });
    await repo.salvarFatura(pessoaId, { id: "pdf", tipo: "fatura", origem: "Pluggy Bank", mes: "2026-10", lancamentos: [], fonte: "documento", total: 50000 });
    await sync();
    const cartao = (await repo.conexoes(pessoaId))[0].contas.find((x) => x.tipo === "cartao")!;
    expect((await repo.parceladas(pessoaId)).find((x) => x.chave === "pdf")?.origem).toBe(cartao.id);
    expect((await repo.faturas(pessoaId)).find((f) => f.fonte === "documento")?.contaId).toBe(cartao.id);
  });

  it("investimentos são lidos e a meta ligada a eles passa a usar o saldo", async () => {
    await sync();
    const investimentos = await repo.investimentos(pessoaId);
    expect(investimentos).toHaveLength(8);
    const previdencia = investimentos.find((i) => i.nome === "ITAU Sandbox previdencia")!;
    expect(previdencia.saldo).toBe(1172042);
    const meta = await repo.salvarMeta(pessoaId, { nome: "Reserva", icone: "shield", cor: "azul", alvo: 2000000, inicial: 0, modo: "valor", frequencia: "mes", valorPorPeriodo: 50000, prazo: null, lembrete: false } as never);
    await repo.ligarInvestimentos(pessoaId, meta.id, [previdencia.id]);
    const [lida] = (await repo.metas(pessoaId)).filter((m) => m.id === meta.id);
    expect(lida).toMatchObject({ investimentos: [previdencia.id], guardadoPeloBanco: 1172042 });
    // Investimento de outra pessoa não pode ser ligado.
    await expect(repo.ligarInvestimentos(pessoaId, meta.id, ["nao-existe"])).rejects.toThrow();
  });

  it("parcela de empréstimo na conta não é compra nem aviso", async () => {
    const c = cliente();
    const conta = Object.keys(c.dados.transacoes).find((k) => k.startsWith(CONTA))!;
    const base = c.dados.transacoes[conta][0];
    c.dados.transacoes[conta].push({ ...base, id: `parc-${conexaoId}`, description: "PARC EMPREST 05/24", amount: -610, type: "DEBIT", date: new Date("2026-11-16T03:00:00Z"), paymentData: null } as unknown as PluggyTransacao);
    await sync(c);
    const m = (await repo.movimentos(pessoaId)).find((x) => x.descricao === "PARC EMPREST 05/24")!;
    expect(m).toMatchObject({ natureza: "parcela-emprestimo", situacao: "historico" });
  });
});
