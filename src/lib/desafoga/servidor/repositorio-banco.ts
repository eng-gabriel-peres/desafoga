/**
 * Gravação dos bancos conectados (Pluggy) e do que vem de documentos:
 * conexões, contas, movimentos, compras parceladas, sugestões de dívida e
 * regras que a pessoa ensinou. Reexportado por `repositorio.ts`.
 */
import type { RegraDoBanco } from "@/lib/banco/classificar";
import { encontrarDivida, fundirDivida } from "@/lib/banco/dividas";
import { encontrarParcelada } from "@/lib/banco/relacionar";
import type {
  CampoDaDivida,
  CompraParcelada,
  ConexaoBancaria,
  ContaBancaria,
  FonteDaDivida,
  ModoCompras,
  Movimento,
  SituacaoDoMovimento,
  SugestaoDeDivida,
} from "@/lib/banco/tipos";
import type { Categoria, Divida, TipoDivida } from "@/lib/finance";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { NaoEncontrado, paraDivida } from "./repositorio";

const iso = (d: Date) => d.toISOString();
const UMA_HORA = 60 * 60 * 1000;
const CINCO_MINUTOS = 5 * 60 * 1000;

// ---------- conexões e contas ----------

function paraConta(c: Prisma.ContaBancariaModel): ContaBancaria {
  return {
    id: c.id,
    conexaoId: c.conexaoId,
    pluggyAccountId: c.pluggyAccountId,
    tipo: c.tipo as ContaBancaria["tipo"],
    nome: c.nome,
    saldo: c.saldo,
    limite: c.limite,
    limiteDisponivel: c.limiteDisponivel,
    fechamento: c.fechamento,
    vencimento: c.vencimento,
    chequeEspecialUsado: c.chequeEspecialUsado,
    chequeEspecialLimite: c.chequeEspecialLimite,
  };
}

function paraConexao(c: Prisma.ConexaoBancariaModel & { contas: Prisma.ContaBancariaModel[] }, agora = Date.now()): ConexaoBancaria {
  const proxima = c.ultimoPedidoDeAtualizacao ? c.ultimoPedidoDeAtualizacao.getTime() + UMA_HORA : null;
  return {
    id: c.id,
    pluggyItemId: c.pluggyItemId,
    banco: c.banco,
    logo: c.logo,
    status: c.status as ConexaoBancaria["status"],
    ultimaSincronizacao: c.ultimaSincronizacao ? iso(c.ultimaSincronizacao) : null,
    proximaAtualizacaoPossivel: proxima && proxima > agora ? new Date(proxima).toISOString() : null,
    consentimentoAte: c.consentimentoAte ? iso(c.consentimentoAte) : null,
    conectadaEm: iso(c.conectadaEm),
    contas: c.contas.map(paraConta),
  };
}

export async function conexoes(pessoaId: string): Promise<ConexaoBancaria[]> {
  const lista = await prisma().conexaoBancaria.findMany({ where: { pessoaId }, include: { contas: true }, orderBy: { conectadaEm: "asc" } });
  return lista.map((c) => paraConexao(c));
}

/** Conexão com os dados internos que a sincronização precisa. */
export async function conexao(conexaoId: string) {
  return prisma().conexaoBancaria.findUnique({ where: { id: conexaoId }, include: { contas: true } });
}

export async function conexaoDaPessoa(pessoaId: string, conexaoId: string) {
  const c = await prisma().conexaoBancaria.findFirst({ where: { id: conexaoId, pessoaId }, include: { contas: true } });
  if (!c) throw new NaoEncontrado("Banco não encontrado.");
  return c;
}

export async function conexaoPorItem(pluggyItemId: string): Promise<{ id: string; pessoaId: string } | null> {
  return prisma().conexaoBancaria.findUnique({ where: { pluggyItemId }, select: { id: true, pessoaId: true } });
}

/** Cria a conexão (ou devolve a que já existe para o mesmo item da Pluggy). */
export async function criarConexao(pessoaId: string, d: { pluggyItemId: string | null; banco: string; logo: string | null }): Promise<ConexaoBancaria> {
  const existente = d.pluggyItemId ? await prisma().conexaoBancaria.findUnique({ where: { pluggyItemId: d.pluggyItemId }, include: { contas: true } }) : null;
  if (existente) {
    if (existente.pessoaId !== pessoaId) throw new NaoEncontrado("Conexão de outra pessoa.");
    return paraConexao(existente);
  }
  return paraConexao(await prisma().conexaoBancaria.create({ data: { pessoaId, ...d }, include: { contas: true } }));
}

export async function atualizarConexao(
  conexaoId: string,
  m: Partial<{
    banco: string;
    logo: string | null;
    status: ConexaoBancaria["status"];
    erro: string | null;
    ultimaSincronizacao: Date;
    ultimoPedidoDeAtualizacao: Date;
    consentimentoAte: Date | null;
    cpfDoTitular: string | null;
  }>,
): Promise<void> {
  await prisma().conexaoBancaria.update({ where: { id: conexaoId }, data: m });
}

/** Marca a conexão como sincronizando; false se outra sincronização começou há menos de 5 minutos. */
export async function travarSincronizacao(conexaoId: string, agora = new Date()): Promise<boolean> {
  const r = await prisma().conexaoBancaria.updateMany({
    where: { id: conexaoId, OR: [{ sincronizandoDesde: null }, { sincronizandoDesde: { lt: new Date(agora.getTime() - CINCO_MINUTOS) } }] },
    data: { sincronizandoDesde: agora },
  });
  return r.count === 1;
}

export async function soltarSincronizacao(conexaoId: string): Promise<void> {
  await prisma().conexaoBancaria.update({ where: { id: conexaoId }, data: { sincronizandoDesde: null } });
}

export async function salvarContas(conexaoId: string, contas: Omit<ContaBancaria, "id" | "conexaoId">[]): Promise<ContaBancaria[]> {
  const salvas: ContaBancaria[] = [];
  for (const c of contas) {
    const r = await prisma().contaBancaria.upsert({
      where: { pluggyAccountId: c.pluggyAccountId },
      create: { conexaoId, ...c },
      update: { ...c },
    });
    salvas.push(paraConta(r));
  }
  return salvas;
}

/** Apaga a conexão: contas e movimentos somem; compras registradas ficam; dívidas do banco viram manuais. */
export async function apagarConexao(pessoaId: string, conexaoId: string): Promise<string | null> {
  const c = await conexaoDaPessoa(pessoaId, conexaoId);
  const contas = c.contas.map((x) => x.id);
  await prisma().$transaction([
    prisma().compraParcelada.deleteMany({ where: { pessoaId, origem: { in: contas }, compraId: null } }),
    prisma().divida.updateMany({ where: { pessoaId, conexaoId }, data: { origem: "manual", fonte: null, pluggyLoanId: null, conexaoId: null } }),
    prisma().sugestao.deleteMany({ where: { pessoaId, situacao: "aberta", dados: { path: ["conexaoId"], equals: conexaoId } } }),
    prisma().conexaoBancaria.delete({ where: { id: conexaoId } }),
  ]);
  return c.pluggyItemId;
}

// ---------- movimentos ----------

function paraMovimento(m: Prisma.MovimentoModel): Movimento {
  return {
    id: m.id,
    pluggyId: m.pluggyId,
    contaId: m.contaId,
    data: m.data,
    descricao: m.descricao,
    descricaoOriginal: m.descricaoOriginal,
    valor: m.valor,
    direcao: m.direcao as Movimento["direcao"],
    categoriaPluggy: m.categoriaPluggy,
    parcela: m.parcela,
    totalParcelas: m.totalParcelas,
    valorTotalDaCompra: m.valorTotalDaCompra,
    compradaEm: m.compradaEm,
    faturaPrevista: m.faturaPrevista,
    cnpj: m.cnpj,
    mcc: m.mcc,
    documentoContraparte: m.documentoContraparte,
    jurosBoleto: m.jurosBoleto,
    pendente: m.pendente,
    natureza: m.natureza as Movimento["natureza"],
    categoria: m.categoria as Categoria | null,
    situacao: m.situacao as SituacaoDoMovimento,
    compraId: m.compraId,
    parceladaId: m.parceladaId,
  };
}

export async function movimentos(pessoaId: string, filtro: { situacao?: SituacaoDoMovimento[]; desde?: string } = {}): Promise<Movimento[]> {
  const lista = await prisma().movimento.findMany({
    where: {
      pessoaId,
      ...(filtro.situacao ? { situacao: { in: filtro.situacao } } : {}),
      ...(filtro.desde ? { data: { gte: filtro.desde } } : {}),
    },
    orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
  });
  return lista.map(paraMovimento);
}

/**
 * Grava por pluggyId. Movimento novo entra inteiro; o que já existia só tem
 * os dados do banco atualizados (valor, data, pendente…): a situação, a
 * natureza, a categoria e os vínculos decididos pela pessoa não mudam.
 */
export async function salvarMovimentos(pessoaId: string, movs: Omit<Movimento, "id">[]): Promise<{ novos: Movimento[]; atualizados: Movimento[] }> {
  if (!movs.length) return { novos: [], atualizados: [] };
  const existentes = new Set(
    (await prisma().movimento.findMany({ where: { pluggyId: { in: movs.map((m) => m.pluggyId) } }, select: { pluggyId: true } })).map((m) => m.pluggyId),
  );
  const novos: Movimento[] = [];
  const atualizados: Movimento[] = [];
  for (const m of movs) {
    if (existentes.has(m.pluggyId)) {
      const r = await prisma().movimento.update({
        where: { pluggyId: m.pluggyId },
        data: {
          data: m.data,
          descricao: m.descricao,
          descricaoOriginal: m.descricaoOriginal,
          valor: m.valor,
          pendente: m.pendente,
          categoriaPluggy: m.categoriaPluggy,
          faturaPrevista: m.faturaPrevista,
        },
      });
      atualizados.push(paraMovimento(r));
    } else {
      novos.push(paraMovimento(await prisma().movimento.create({ data: { pessoaId, ...m } })));
    }
  }
  return { novos, atualizados };
}

/** Apaga movimentos que o banco removeu (e os avisos deles). Só os que não viraram compra registrada. */
export async function apagarMovimentos(pluggyIds: string[]): Promise<number> {
  const alvo = await prisma().movimento.findMany({ where: { pluggyId: { in: pluggyIds } }, select: { id: true } });
  const ids = alvo.map((m) => m.id);
  await prisma().aviso.deleteMany({ where: { referencia: { in: ids } } });
  const r = await prisma().movimento.deleteMany({ where: { id: { in: ids } } });
  return r.count;
}

export async function mudarMovimento(
  pessoaId: string,
  movimentoId: string,
  m: Partial<Pick<Movimento, "situacao" | "natureza" | "categoria" | "compraId" | "parceladaId">>,
): Promise<Movimento> {
  const r = await prisma().movimento.updateMany({ where: { id: movimentoId, pessoaId }, data: m });
  if (!r.count) throw new NaoEncontrado("Movimento não encontrado.");
  if (m.situacao && m.situacao !== "revisar") await prisma().aviso.deleteMany({ where: { pessoaId, referencia: movimentoId } });
  return paraMovimento(await prisma().movimento.findUniqueOrThrow({ where: { id: movimentoId } }));
}

export async function movimentoDaPessoa(pessoaId: string, movimentoId: string): Promise<Movimento> {
  const m = await prisma().movimento.findFirst({ where: { id: movimentoId, pessoaId } });
  if (!m) throw new NaoEncontrado("Movimento não encontrado.");
  return paraMovimento(m);
}

/** Aviso ligado a um movimento (some se o movimento for resolvido ou apagado). */
export async function avisarDoMovimento(pessoaId: string, movimentoId: string, tipo: string, texto: string, quando = new Date()): Promise<void> {
  await prisma().aviso.create({ data: { pessoaId, tipo, texto, quando, referencia: movimentoId } });
}

// ---------- compras parceladas ----------

function paraParcelada(p: Prisma.CompraParceladaModel): CompraParcelada {
  return {
    id: p.id,
    chave: p.chave,
    origem: p.origem,
    fonte: p.fonte as CompraParcelada["fonte"],
    nome: p.nome,
    lojaOriginal: p.lojaOriginal,
    categoria: p.categoria as Categoria,
    valorTotal: p.valorTotal,
    valorParcela: p.valorParcela,
    totalParcelas: p.totalParcelas,
    mesDaPrimeira: p.mesDaPrimeira,
    compradaEm: p.compradaEm,
    compradaEmEstimada: p.compradaEmEstimada,
    compraId: p.compraId,
    parcelasVistas: [...p.parcelasVistas].sort((a, b) => a - b),
  };
}

export async function parceladas(pessoaId: string): Promise<CompraParcelada[]> {
  return (await prisma().compraParcelada.findMany({ where: { pessoaId }, orderBy: { compradaEm: "desc" } })).map(paraParcelada);
}

export async function parceladaAvisada(parceladaId: string): Promise<boolean> {
  return (await prisma().compraParcelada.findUniqueOrThrow({ where: { id: parceladaId }, select: { avisada: true } })).avisada;
}

export async function marcarParceladaAvisada(parceladaId: string): Promise<void> {
  await prisma().compraParcelada.update({ where: { id: parceladaId }, data: { avisada: true } });
}

/** Grava a compra parcelada ou junta com a mesma já vista (outra parcela, outra fonte). */
export async function salvarParcelada(pessoaId: string, d: Omit<CompraParcelada, "id">): Promise<{ parcelada: CompraParcelada; nova: boolean }> {
  const existentes = await parceladas(pessoaId);
  const mesma = encontrarParcelada(existentes, {
    origem: d.origem,
    descricao: d.lojaOriginal,
    valorParcela: d.valorParcela,
    totalParcelas: d.totalParcelas,
    parcelaAtual: 1,
    mesDaParcela: d.mesDaPrimeira,
    valorTotal: d.valorTotal,
    compradaEm: d.compradaEm,
  });
  if (!mesma) {
    const criada = await prisma().compraParcelada.create({ data: { pessoaId, ...d } });
    return { parcelada: paraParcelada(criada), nova: true };
  }
  const vistas = [...new Set([...mesma.parcelasVistas, ...d.parcelasVistas])];
  // O banco sabe a data e o total de verdade; o PDF só estima.
  const melhor = d.fonte === "pluggy" && mesma.compradaEmEstimada ? { compradaEm: d.compradaEm, compradaEmEstimada: d.compradaEmEstimada, valorTotal: d.valorTotal, fonte: "pluggy" } : {};
  const r = await prisma().compraParcelada.update({ where: { id: mesma.id }, data: { parcelasVistas: vistas, ...melhor } });
  return { parcelada: paraParcelada(r), nova: false };
}

export async function ligarParceladaACompra(parceladaId: string, compraId: string): Promise<void> {
  await prisma().compraParcelada.update({ where: { id: parceladaId }, data: { compraId } });
}

/** Renomeia (e recategoriza) a compra parcelada inteira, inclusive a compra registrada. */
export async function renomearParcelada(pessoaId: string, parceladaId: string, nome: string, categoria?: Categoria): Promise<CompraParcelada> {
  const r = await prisma().compraParcelada.updateMany({ where: { id: parceladaId, pessoaId }, data: { nome, ...(categoria ? { categoria } : {}) } });
  if (!r.count) throw new NaoEncontrado("Compra parcelada não encontrada.");
  const p = await prisma().compraParcelada.findUniqueOrThrow({ where: { id: parceladaId } });
  if (p.compraId) await prisma().compra.updateMany({ where: { id: p.compraId, pessoaId }, data: { item: nome, ...(categoria ? { categoria } : {}) } });
  await prisma().movimento.updateMany({ where: { pessoaId, parceladaId }, data: categoria ? { categoria } : {} });
  return paraParcelada(p);
}

// ---------- sugestões de dívida ----------

export interface SugestaoGuardada {
  chave: string;
  tipo: "divida" | "renda";
  dados: SugestaoDeDivida & { parecidaCom?: string; conexaoId?: string };
  situacao: "aberta" | "aceita" | "dispensada";
}

const paraSugestao = (s: Prisma.SugestaoModel): SugestaoGuardada => ({
  chave: s.chave,
  tipo: s.tipo as SugestaoGuardada["tipo"],
  dados: s.dados as unknown as SugestaoGuardada["dados"],
  situacao: s.situacao as SugestaoGuardada["situacao"],
});

export async function sugestoes(pessoaId: string, situacao: SugestaoGuardada["situacao"] = "aberta"): Promise<SugestaoGuardada[]> {
  return (await prisma().sugestao.findMany({ where: { pessoaId, situacao }, orderBy: { criadaEm: "asc" } })).map(paraSugestao);
}

/** Dívida vinda de fonte externa vista como sugestão (para comparar e fundir). */
function dividaComoSugestao(d: Prisma.DividaModel): SugestaoDeDivida {
  return {
    chave: d.chave ?? d.id,
    fonte: (d.fonte ?? "extrato") as FonteDaDivida,
    pluggyLoanId: d.pluggyLoanId,
    tipo: d.tipo as TipoDivida,
    nome: d.nome,
    instituicao: d.instituicao ?? d.nome,
    detalhe: d.detalhe,
    saldo: d.saldo,
    vencido: d.vencido,
    taxaMensal: d.confira.includes("taxaMensal") ? null : d.taxaMensal,
    parcelaMinima: d.parcelaMinima,
    vencimento: d.vencimento,
    parcelasRestantes: d.parcelasRestantes,
    cet: d.cet,
    temSeguro: d.temSeguro,
    faltaPagarComJuros: d.faltaPagarComJuros,
    confira: d.confira as CampoDaDivida[],
  };
}

/** Campos da dívida no banco a partir da sugestão (taxa desconhecida fica 0 e marcada "confira"). */
function camposDaDivida(s: SugestaoDeDivida, conexaoId: string | null | undefined) {
  return {
    tipo: s.tipo,
    nome: s.nome,
    detalhe: s.detalhe,
    saldo: s.saldo,
    taxaMensal: s.taxaMensal ?? 0,
    parcelaMinima: s.parcelaMinima,
    origem: s.fonte === "pluggy" ? "banco" : "documento",
    fonte: s.fonte,
    chave: s.chave,
    pluggyLoanId: s.pluggyLoanId,
    ...(conexaoId ? { conexaoId } : {}),
    instituicao: s.instituicao,
    cet: s.cet,
    parcelasRestantes: s.parcelasRestantes,
    temSeguro: s.temSeguro,
    vencido: s.vencido,
    faltaPagarComJuros: s.faltaPagarComJuros,
    confira: s.taxaMensal === null ? [...new Set<CampoDaDivida>([...s.confira, "taxaMensal"])] : s.confira,
    atualizadaEm: new Date(),
  };
}

const json = (x: unknown) => x as Prisma.InputJsonValue;

/**
 * Único caminho para gravar dívida vinda de fora (Pluggy ou documento):
 * atualiza a dívida já aceita, junta com a sugestão aberta, respeita a
 * dispensada e nunca mexe na dívida que a pessoa cadastrou à mão.
 */
export async function receberSugestaoDeDivida(
  pessoaId: string,
  s: SugestaoDeDivida,
  extra: { conexaoId?: string } = {},
): Promise<"nova" | "fundida" | "divida-atualizada" | "ignorada"> {
  const todas = await prisma().divida.findMany({ where: { pessoaId } });
  const externas = todas.filter((d) => d.origem !== "manual");
  const porLoan = s.pluggyLoanId ? externas.find((d) => d.pluggyLoanId === s.pluggyLoanId) : undefined;
  const comoSugestao = externas.map((d) => ({ d, s: dividaComoSugestao(d) }));
  const aceita = porLoan ? comoSugestao.find((x) => x.d.id === porLoan.id) : encontrarDivida(comoSugestao.map((x) => ({ ...x.s, ref: x })), s)?.ref;
  if (aceita) {
    const junta = fundirDivida(aceita.s, s);
    const campos = camposDaDivida(junta, extra.conexaoId);
    await prisma().divida.update({ where: { id: aceita.d.id }, data: { ...campos, nome: aceita.d.nome, chave: aceita.d.chave ?? campos.chave } });
    return "divida-atualizada";
  }

  const guardadas = (await prisma().sugestao.findMany({ where: { pessoaId, tipo: "divida" } })).map(paraSugestao);
  const dispensada = encontrarDivida(guardadas.filter((g) => g.situacao === "dispensada").map((g) => g.dados), s);
  if (dispensada) return "ignorada";
  const aberta = encontrarDivida(guardadas.filter((g) => g.situacao === "aberta").map((g) => g.dados), s);
  if (aberta) {
    const junta = { ...fundirDivida(aberta, s), parecidaCom: aberta.parecidaCom, conexaoId: extra.conexaoId ?? aberta.conexaoId };
    await prisma().sugestao.update({ where: { pessoaId_chave: { pessoaId, chave: aberta.chave } }, data: { dados: json(junta) } });
    return "fundida";
  }

  const manuais = todas.filter((d) => d.origem === "manual").map((d) => ({ ...dividaComoSugestao(d), instituicao: d.instituicao ?? d.nome, id: d.id }));
  const parecida = encontrarDivida(manuais, s);
  let chave = s.chave;
  for (let n = 2; guardadas.some((g) => g.chave === chave); n++) chave = `${s.chave}#${n}`;
  const dados = { ...s, chave, ...(parecida ? { parecidaCom: parecida.id } : {}), ...(extra.conexaoId ? { conexaoId: extra.conexaoId } : {}) };
  await prisma().sugestao.create({ data: { pessoaId, chave, tipo: "divida", dados: json(dados) } });
  return "nova";
}

async function sugestaoAberta(pessoaId: string, chave: string): Promise<SugestaoGuardada> {
  const s = await prisma().sugestao.findUnique({ where: { pessoaId_chave: { pessoaId, chave } } });
  if (!s || s.situacao !== "aberta") throw new NaoEncontrado("Sugestão não encontrada.");
  return paraSugestao(s);
}

export async function aceitarSugestao(
  pessoaId: string,
  chave: string,
  correcoes: Partial<Record<CampoDaDivida, number>> = {},
  vencimento?: number,
): Promise<Divida> {
  const { dados } = await sugestaoAberta(pessoaId, chave);
  const dia = dados.vencimento ?? vencimento ?? 10;
  const criada = await prisma().divida.create({
    data: { pessoaId, ...camposDaDivida(dados, dados.conexaoId), vencimento: dia, correcoes: Object.keys(correcoes).length ? json(correcoes) : undefined },
  });
  await prisma().sugestao.update({ where: { pessoaId_chave: { pessoaId, chave } }, data: { situacao: "aceita" } });
  return paraDivida(criada);
}

/** Liga a sugestão a uma dívida que a pessoa já tinha: a fonte passa a atualizá-la, e o que a pessoa escreveu vira correção. */
export async function vincularSugestao(pessoaId: string, chave: string, dividaId: string): Promise<Divida> {
  const { dados } = await sugestaoAberta(pessoaId, chave);
  const manual = await prisma().divida.findFirst({ where: { id: dividaId, pessoaId } });
  if (!manual) throw new NaoEncontrado("Dívida não encontrada.");
  const correcoes: Partial<Record<CampoDaDivida, number>> = {};
  if (manual.saldo !== dados.saldo) correcoes.saldo = manual.saldo;
  if (dados.taxaMensal === null || manual.taxaMensal !== dados.taxaMensal) correcoes.taxaMensal = manual.taxaMensal;
  if (manual.parcelaMinima && manual.parcelaMinima !== dados.parcelaMinima) correcoes.parcelaMinima = manual.parcelaMinima;
  const campos = camposDaDivida(dados, dados.conexaoId);
  const r = await prisma().divida.update({
    where: { id: dividaId },
    data: { ...campos, nome: manual.nome, vencimento: dados.vencimento ?? manual.vencimento, correcoes: json(correcoes) },
  });
  await prisma().sugestao.update({ where: { pessoaId_chave: { pessoaId, chave } }, data: { situacao: "aceita" } });
  return paraDivida(r);
}

export async function dispensarSugestao(pessoaId: string, chave: string): Promise<void> {
  await prisma().sugestao.updateMany({ where: { pessoaId, chave, situacao: "aberta" }, data: { situacao: "dispensada" } });
}

/** A dívida deixa de ser atualizada pela fonte: as correções viram os valores e ela volta a ser manual. */
export async function desvincularDivida(pessoaId: string, dividaId: string): Promise<Divida> {
  const d = await prisma().divida.findFirst({ where: { id: dividaId, pessoaId } });
  if (!d) throw new NaoEncontrado("Dívida não encontrada.");
  const lida = paraDivida(d);
  const r = await prisma().divida.update({
    where: { id: dividaId },
    data: {
      origem: "manual",
      fonte: null,
      pluggyLoanId: null,
      conexaoId: null,
      chave: null,
      saldo: lida.saldo,
      taxaMensal: lida.taxaMensal,
      parcelaMinima: lida.parcelaMinima,
      parcelasRestantes: lida.parcelasRestantes ?? null,
      confira: [],
      correcoes: Prisma.DbNull,
    },
  });
  return paraDivida(r);
}

/** A pessoa confere ou corrige um campo: vale sobre o que a fonte disser depois. */
export async function corrigirDivida(pessoaId: string, dividaId: string, campo: CampoDaDivida, valor: number): Promise<Divida> {
  const d = await prisma().divida.findFirst({ where: { id: dividaId, pessoaId } });
  if (!d) throw new NaoEncontrado("Dívida não encontrada.");
  const correcoes = { ...((d.correcoes ?? {}) as Record<string, number>), [campo]: valor };
  const r = await prisma().divida.update({ where: { id: dividaId }, data: { correcoes: json(correcoes), confira: d.confira.filter((c) => c !== campo) } });
  return paraDivida(r);
}

// ---------- regras e modo ----------

export async function regras(pessoaId: string): Promise<RegraDoBanco[]> {
  const lista = await prisma().regraDoBanco.findMany({ where: { pessoaId }, orderBy: { criadaEm: "asc" } });
  return lista.map((r) => ({ padrao: r.padrao, efeito: r.efeito as RegraDoBanco["efeito"] }));
}

export async function salvarRegra(pessoaId: string, r: RegraDoBanco): Promise<void> {
  await prisma().regraDoBanco.upsert({
    where: { pessoaId_padrao: { pessoaId, padrao: r.padrao } },
    create: { pessoaId, padrao: r.padrao, efeito: json(r.efeito) },
    update: { efeito: json(r.efeito) },
  });
}

export async function modoCompras(pessoaId: string): Promise<ModoCompras> {
  const p = await prisma().pessoa.findUniqueOrThrow({ where: { id: pessoaId }, select: { modoComprasDoBanco: true } });
  return p.modoComprasDoBanco as ModoCompras;
}

export async function salvarModoCompras(pessoaId: string, modo: ModoCompras): Promise<void> {
  await prisma().pessoa.update({ where: { id: pessoaId }, data: { modoComprasDoBanco: modo } });
}

// ---------- faturas do banco ----------

export async function faturaPorChave(pessoaId: string, pluggyBillId: string) {
  return prisma().fatura.findFirst({ where: { pessoaId, pluggyBillId }, include: { lancamentos: true } });
}

export async function faturasDoCartao(pessoaId: string, contaId: string, mes: string) {
  return prisma().fatura.findMany({ where: { pessoaId, contaId, mes }, include: { lancamentos: true } });
}

export async function atualizarFatura(
  faturaId: string,
  m: Partial<{ vencimento: string | null; total: number | null; pagamentoMinimo: number | null; taxaRotativoMensal: number | null; foraDosCalculos: boolean }>,
): Promise<void> {
  await prisma().fatura.update({ where: { id: faturaId }, data: m });
}

export async function apagarFatura(faturaId: string): Promise<void> {
  await prisma().fatura.delete({ where: { id: faturaId } });
}

export async function desmarcarParceladaAvisada(parceladaId: string): Promise<void> {
  await prisma().compraParcelada.update({ where: { id: parceladaId }, data: { avisada: false } });
}

/** Compra registrada sozinha pelo banco: a pessoa completa como estava. */
export async function completarEmocao(pessoaId: string, compraId: string, emocao: number, necessidade: string): Promise<void> {
  const r = await prisma().compra.updateMany({ where: { id: compraId, pessoaId }, data: { emocao, necessidade } });
  if (!r.count) throw new NaoEncontrado("Compra não encontrada.");
}
