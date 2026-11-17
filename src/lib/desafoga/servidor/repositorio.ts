/**
 * Leitura e gravação dos dados do Desafoga no Postgres (Prisma), devolvendo
 * os tipos de domínio que as telas e a Luana usam. Quem pode ver ou mudar o
 * quê é decidido antes, em `acesso.ts`.
 */
import type { ContextoAssistente, EstadoConversa } from "@/lib/assistente/conversa";
import { ESTADO_INICIAL } from "@/lib/assistente/conversa";
import { chaveDoDia, ROTINA_PADRAO, situacaoDaMeta, type CategoriaDaConta, type CheckIn, type ContaFixa, type Pagamento, type Periodo, type Renda, type Rotina, type Categoria, type Emocao, type Estrategia, type Necessidade, type TipoDivida, type TipoLancamento } from "@/lib/finance";
import { avisoDeMetaConcluida } from "@/lib/assistente/textos";
import { Prisma } from "@/generated/prisma/client";
import type {
  ContaEditada,
  Anotacao,
  Aviso,
  Classificacao,
  Compra,
  Divida,
  Fatura,
  Memoria,
  Mensagem,
  Meta,
  MetaEditada,
  NovaCompra,
  Orcamento,
  Persona,
  Plano,
  Profissional,
  RespostaRapida,
  Tom,
} from "@/services/tipos";
import { avisoDeCompraAlta, avisoDeSugestao, mensagemDeSugestao, nomeDeCompraDaFatura } from "../regras";
import { hojeEmBrasilia } from "@/lib/luana/lancamentos";
import { prisma } from "./prisma";

export type Canal = "app" | "whatsapp";

/** O registro não existe para esta pessoa (ou é de outra). */
export class NaoEncontrado extends Error {}

const iso = (d: Date) => d.toISOString();

function paraPersona(p: { id: string; nome: string; apelido: string; idade: number | null; cor: string; perfil: string }): Persona {
  return { id: p.id, nome: p.nome, apelido: p.apelido, idade: p.idade, cor: p.cor, perfil: p.perfil };
}

function paraProfissional(p: { id: string; nome: string; papel: string; cor: string }): Profissional {
  return { id: p.id, nome: p.nome, papel: p.papel, cor: p.cor };
}

export function paraCompra(c: Prisma.CompraModel): Compra {
  return {
    id: c.id,
    item: c.item,
    categoria: c.categoria as Categoria,
    valor: c.valor,
    emocao: c.emocao as Emocao | null,
    necessidade: c.necessidade as Necessidade | null,
    quando: iso(c.quando),
    via: c.via as Compra["via"],
    avaliacaoProfissional: c.avaliacaoProfissional as Necessidade | null,
    ...(c.parcelas ? { parcelas: c.parcelas, valorDaParcela: c.valorDaParcela, parceladaId: c.parceladaId } : {}),
  };
}

/** Dívida como as telas veem: as correções da pessoa valem sobre o que a fonte disse. */
export function paraDivida(d: Prisma.DividaModel): Divida {
  const correcoes = (d.correcoes ?? {}) as NonNullable<Divida["correcoes"]>;
  const base: Divida = {
    id: d.id,
    tipo: d.tipo as TipoDivida,
    nome: d.nome,
    detalhe: d.detalhe,
    saldo: correcoes.saldo ?? d.saldo,
    taxaMensal: correcoes.taxaMensal ?? d.taxaMensal,
    parcelaMinima: correcoes.parcelaMinima ?? d.parcelaMinima,
    vencimento: d.vencimento,
  };
  if (d.origem === "manual" && !d.instituicao) return base;
  return {
    ...base,
    origem: d.origem as Divida["origem"],
    fonte: d.fonte as Divida["fonte"],
    instituicao: d.instituicao,
    cet: d.cet,
    parcelasRestantes: correcoes.parcelasRestantes ?? d.parcelasRestantes,
    temSeguro: d.temSeguro,
    vencido: d.vencido,
    faltaPagarComJuros: d.faltaPagarComJuros,
    confira: (d.confira as NonNullable<Divida["confira"]>).filter((c) => correcoes[c] === undefined),
    correcoes,
    atualizadaEm: d.atualizadaEm ? iso(d.atualizadaEm) : null,
  };
}

export function paraFatura(f: Prisma.FaturaModel & { lancamentos: Prisma.LancamentoModel[] }): Fatura {
  return {
    id: f.id,
    tipo: f.tipo as Fatura["tipo"],
    origem: f.origem,
    mes: f.mes,
    lancamentos: [...f.lancamentos]
      .sort((a, b) => a.ordem - b.ordem)
      .map((l) => ({
        id: l.id,
        data: l.data,
        descricao: l.descricao,
        valor: l.valor,
        tipo: l.tipo as TipoLancamento,
        ...(l.categoria ? { categoria: l.categoria as Categoria } : {}),
        compraId: l.compraId,
        ...(l.parcela && l.totalParcelas ? { parcela: l.parcela, totalParcelas: l.totalParcelas } : {}),
      })),
    vencimento: f.vencimento,
    total: f.total,
    pagamentoMinimo: f.pagamentoMinimo,
    taxaRotativoMensal: f.taxaRotativoMensal,
    contaId: f.contaId,
    fonte: f.fonte as Fatura["fonte"],
    foraDosCalculos: f.foraDosCalculos,
  };
}

function paraMensagem(m: Prisma.MensagemModel): Mensagem {
  return {
    id: m.id,
    de: m.de as Mensagem["de"],
    texto: m.texto,
    quando: iso(m.quando),
    ...(m.respostasRapidas ? { respostasRapidas: m.respostasRapidas as unknown as RespostaRapida[] } : {}),
  };
}

function paraAviso(a: Prisma.AvisoModel): Aviso {
  return { id: a.id, pessoaId: a.pessoaId, tipo: a.tipo as Aviso["tipo"], texto: a.texto, quando: iso(a.quando) };
}

type MetaDoBanco = Prisma.MetaModel & { movimentos: Prisma.MovimentoDaMetaModel[] };
const COM_DEPOSITOS = { movimentos: { orderBy: { quando: "asc" } } } as const;

function paraMeta(m: MetaDoBanco): Meta {
  return {
    id: m.id,
    nome: m.nome,
    icone: m.icone as Meta["icone"],
    cor: m.cor as Meta["cor"],
    alvo: m.alvo,
    inicial: m.inicial,
    modo: m.modo as Meta["modo"],
    frequencia: m.frequencia as Meta["frequencia"],
    valorPorPeriodo: m.valorPorPeriodo,
    prazo: m.prazo ? m.prazo.toISOString().slice(0, 10) : null,
    criadaEm: chaveDoDia(m.criadaEm),
    lembrete: m.lembrete,
    depositos: m.movimentos.map((v) => ({ id: v.id, valor: v.valor, descricao: v.descricao, quando: iso(v.quando), via: v.via as "app" | "whatsapp" })),
    ...(m.investimentos.length ? { investimentos: m.investimentos } : {}),
  };
}

/** Meta ligada a investimentos do banco: o guardado é o saldo deles (se algum ainda existir). */
async function comSaldoDoBanco(pessoaId: string, metas: Meta[]): Promise<Meta[]> {
  const ids = metas.flatMap((m) => m.investimentos ?? []);
  if (!ids.length) return metas;
  const saldos = new Map((await prisma().investimentoBancario.findMany({ where: { pessoaId, id: { in: ids } } })).map((i) => [i.id, i.saldo]));
  return metas.map((m) => {
    const ligados = (m.investimentos ?? []).filter((id) => saldos.has(id));
    return ligados.length ? { ...m, guardadoPeloBanco: ligados.reduce((s, id) => s + saldos.get(id)!, 0) } : m;
  });
}

const PLANO_VAZIO: Plano = { valorMensal: 0, estrategia: "mais-cara", valorSugerido: null };

// ---------- leituras ----------

export async function persona(pessoaId: string): Promise<Persona | null> {
  const p = await prisma().pessoa.findUnique({ where: { id: pessoaId } });
  return p ? paraPersona(p) : null;
}

/** Número de WhatsApp confirmado da pessoa, ou null. */
export async function telefone(pessoaId: string): Promise<string | null> {
  return (await prisma().pessoa.findUnique({ where: { id: pessoaId }, select: { telefone: true } }))?.telefone ?? null;
}

export async function compras(pessoaId: string): Promise<Compra[]> {
  return (await prisma().compra.findMany({ where: { pessoaId }, orderBy: { quando: "asc" } })).map(paraCompra);
}

export async function dividas(pessoaId: string): Promise<Divida[]> {
  return (await prisma().divida.findMany({ where: { pessoaId }, orderBy: { taxaMensal: "desc" } })).map(paraDivida);
}

export async function orcamentos(pessoaId: string): Promise<Orcamento[]> {
  const lista = await prisma().orcamento.findMany({ where: { pessoaId }, orderBy: { categoria: "asc" } });
  return lista.map((o) => ({ categoria: o.categoria as Categoria, limite: o.limite }));
}

export async function metas(pessoaId: string): Promise<Meta[]> {
  const lista = await prisma().meta.findMany({ where: { pessoaId }, include: COM_DEPOSITOS, orderBy: { criadaEm: "asc" } });
  return comSaldoDoBanco(pessoaId, lista.map(paraMeta));
}

export async function plano(pessoaId: string): Promise<Plano> {
  const p = await prisma().plano.findUnique({ where: { pessoaId } });
  return p ? { valorMensal: p.valorMensal, estrategia: p.estrategia as Estrategia, valorSugerido: p.valorSugerido } : PLANO_VAZIO;
}

export async function faturas(pessoaId: string): Promise<Fatura[]> {
  const lista = await prisma().fatura.findMany({ where: { pessoaId }, include: { lancamentos: true }, orderBy: { criadaEm: "asc" } });
  return lista.map(paraFatura);
}

/** Memória escrita pelos profissionais. `comPrivadas`: só para quem acompanha. */
export async function memoria(pessoaId: string, comPrivadas: boolean): Promise<Memoria> {
  const [m, notas] = await Promise.all([
    prisma().memoria.findUnique({ where: { pessoaId } }),
    prisma().anotacao.findMany({ where: { pessoaId, ...(comPrivadas ? {} : { privada: false }) }, orderBy: { quando: "asc" } }),
  ]);
  return {
    caracteristicas: m?.caracteristicas ?? [],
    tom: (m?.tom ?? "acolhedor") as Tom,
    objetivo: m?.objetivo ?? "",
    evitar: m?.evitar ?? "",
    anotacoes: notas.map(
      (n): Anotacao => ({ id: n.id, autorId: n.autorId, quando: iso(n.quando), texto: n.texto, privada: n.privada }),
    ),
  };
}

export async function avisos(pessoaIds: string[], tipos?: { apenas?: string[]; exceto?: string[] }): Promise<Aviso[]> {
  const lista = await prisma().aviso.findMany({
    where: {
      pessoaId: { in: pessoaIds },
      ...(tipos?.apenas ? { tipo: { in: tipos.apenas } } : {}),
      ...(tipos?.exceto ? { tipo: { notIn: tipos.exceto } } : {}),
    },
    orderBy: { quando: "desc" },
    take: 100,
  });
  return lista.map(paraAviso);
}

export async function conversa(pessoaId: string, canal: Canal = "app"): Promise<Mensagem[]> {
  return (await prisma().mensagem.findMany({ where: { pessoaId, canal }, orderBy: { quando: "asc" } })).map(paraMensagem);
}

/** Profissionais que acompanham a pessoa (o primeiro é o "responsável" dos avisos). */
export async function acompanhantes(pessoaId: string): Promise<Profissional[]> {
  const lista = await prisma().acompanhamento.findMany({
    where: { pessoaId },
    include: { profissional: true },
    orderBy: { consentidoEm: "asc" },
  });
  return lista.map((a) => paraProfissional(a.profissional));
}

/** Pessoas que o profissional acompanha. */
export async function acompanhados(profissionalId: string): Promise<Persona[]> {
  const lista = await prisma().acompanhamento.findMany({
    where: { profissionalId },
    include: { pessoa: true },
    orderBy: { consentidoEm: "asc" },
  });
  return lista.map((a) => paraPersona(a.pessoa));
}

export async function contextoDoAssistente(pessoaId: string, canal: Canal, agora = new Date()): Promise<ContextoAssistente> {
  const [p, c, d, pl, f, m, profs, orc, mt, contas, pags, rd] = await Promise.all([
    persona(pessoaId),
    compras(pessoaId),
    dividas(pessoaId),
    plano(pessoaId),
    faturas(pessoaId),
    memoria(pessoaId, true),
    acompanhantes(pessoaId),
    orcamentos(pessoaId),
    metas(pessoaId),
    contasFixas(pessoaId),
    pagamentos(pessoaId, agora),
    renda(pessoaId),
  ]);
  if (!p) throw new Error("Pessoa não encontrada");
  return {
    pessoa: p,
    memoria: m,
    profissionais: profs,
    responsavel: profs[0] ?? null,
    compras: c,
    dividas: d,
    plano: pl,
    faturas: f,
    orcamentos: orc,
    metas: mt,
    contas,
    pagamentos: pags,
    renda: rd,
    agora,
    canal,
  };
}

// ---------- gravações ----------

export async function avisar(pessoaId: string, tipo: Aviso["tipo"], texto: string, quando = new Date()): Promise<void> {
  await prisma().aviso.create({ data: { pessoaId, tipo, texto, quando } });
}

export async function registrarCompra(pessoaId: string, nova: NovaCompra, quando = new Date()): Promise<Compra> {
  const criada = await prisma().compra.create({ data: { pessoaId, ...nova, quando } });
  const p = await prisma().pessoa.findUniqueOrThrow({ where: { id: pessoaId }, select: { apelido: true } });
  const aviso = avisoDeCompraAlta(nova, p.apelido);
  if (aviso) await avisar(pessoaId, "gasto-alto", aviso, quando);
  return paraCompra(criada);
}

/** Cria (sem id) ou atualiza uma dívida da pessoa. */
export async function salvarDivida(pessoaId: string, d: Omit<Divida, "id"> & { id?: string }): Promise<Divida> {
  const dados = {
    tipo: d.tipo,
    nome: d.nome,
    detalhe: d.detalhe,
    saldo: d.saldo,
    taxaMensal: d.taxaMensal,
    parcelaMinima: d.parcelaMinima,
    vencimento: d.vencimento,
    ...(d.instituicao ? { instituicao: d.instituicao } : {}),
  };
  if (d.id) {
    // Só atualiza dívida desta pessoa (o id veio do navegador).
    const r = await prisma().divida.updateMany({ where: { id: d.id, pessoaId }, data: dados });
    if (!r.count) throw new NaoEncontrado("Dívida não encontrada.");
    return paraDivida(await prisma().divida.findUniqueOrThrow({ where: { id: d.id } }));
  }
  return paraDivida(await prisma().divida.create({ data: { pessoaId, ...dados } }));
}

export async function removerDivida(pessoaId: string, dividaId: string): Promise<void> {
  await prisma().divida.deleteMany({ where: { id: dividaId, pessoaId } });
  await prisma().pagamento.deleteMany({ where: { pessoaId, tipo: "divida", alvoId: dividaId } });
}

/** Define o limite do mês de uma categoria; limite 0 tira o orçamento dela. */
export async function salvarOrcamento(pessoaId: string, categoria: Categoria, limite: number): Promise<Orcamento[]> {
  if (limite > 0) {
    await prisma().orcamento.upsert({
      where: { pessoaId_categoria: { pessoaId, categoria } },
      create: { pessoaId, categoria, limite },
      update: { limite },
    });
  } else {
    await prisma().orcamento.deleteMany({ where: { pessoaId, categoria } });
  }
  return orcamentos(pessoaId);
}

const dataDoPrazo = (prazo: string | null) => (prazo ? new Date(`${prazo}T00:00:00Z`) : null);

async function metaDaPessoa(pessoaId: string, metaId: string): Promise<Meta> {
  const m = await prisma().meta.findFirst({ where: { id: metaId, pessoaId }, include: COM_DEPOSITOS });
  if (!m) throw new NaoEncontrado("Meta não encontrada.");
  return (await comSaldoDoBanco(pessoaId, [paraMeta(m)]))[0];
}

/** Cria (sem id) ou ajusta uma meta. O que já tinha guardado entra como primeiro depósito. */
export async function salvarMeta(pessoaId: string, m: MetaEditada, agora = new Date()): Promise<Meta> {
  const dados = {
    nome: m.nome,
    icone: m.icone,
    cor: m.cor,
    alvo: m.alvo,
    modo: m.modo,
    frequencia: m.frequencia,
    valorPorPeriodo: m.valorPorPeriodo,
    prazo: dataDoPrazo(m.prazo),
    lembrete: m.lembrete,
  };
  if (m.id) {
    // Só ajusta meta desta pessoa (o id veio do navegador); o valor inicial não muda depois de criada.
    const r = await prisma().meta.updateMany({ where: { id: m.id, pessoaId }, data: dados });
    if (!r.count) throw new NaoEncontrado("Meta não encontrada.");
    return metaDaPessoa(pessoaId, m.id);
  }
  const criada = await prisma().meta.create({
    data: {
      pessoaId,
      ...dados,
      inicial: m.inicial,
      criadaEm: agora,
      movimentos: m.inicial > 0 ? { create: { valor: m.inicial, descricao: "Já tinha guardado", quando: agora, via: "app" } } : undefined,
    },
    include: COM_DEPOSITOS,
  });
  return paraMeta(criada);
}

export async function removerMeta(pessoaId: string, metaId: string): Promise<void> {
  await prisma().meta.deleteMany({ where: { id: metaId, pessoaId } });
}

/**
 * Dinheiro guardado na meta: a transferência é registrada uma vez só e já
 * conta. Se a meta acabou de ser concluída, quem acompanha é avisado.
 */
export async function guardarNaMeta(
  pessoaId: string,
  metaId: string,
  dep: { valor: number; descricao: string; via: "app" | "whatsapp" },
  quando = new Date(),
): Promise<Meta> {
  const antes = await metaDaPessoa(pessoaId, metaId);
  await prisma().movimentoDaMeta.create({ data: { metaId, ...dep, quando } });
  const depois = await metaDaPessoa(pessoaId, metaId);
  if (!situacaoDaMeta(antes, quando).concluida && situacaoDaMeta(depois, quando).concluida) {
    const p = await prisma().pessoa.findUniqueOrThrow({ where: { id: pessoaId }, select: { apelido: true } });
    await avisar(pessoaId, "meta", avisoDeMetaConcluida(p.apelido, depois), quando);
  }
  return depois;
}

export async function apagarDeposito(pessoaId: string, metaId: string, depositoId: string): Promise<Meta> {
  await metaDaPessoa(pessoaId, metaId);
  await prisma().movimentoDaMeta.deleteMany({ where: { id: depositoId, metaId } });
  return metaDaPessoa(pessoaId, metaId);
}

/** Mensagem da Luana no chat do app (incentivo do profissional, lembrete). */
export async function mensagemDaLuana(pessoaId: string, texto: string, quando = new Date()): Promise<void> {
  await prisma().mensagem.create({ data: { pessoaId, canal: "app", de: "assistente", texto, quando } });
}

export async function metaPorId(pessoaId: string, metaId: string): Promise<Meta> {
  return metaDaPessoa(pessoaId, metaId);
}

export async function salvarPlano(pessoaId: string, mudancas: Partial<Pick<Plano, "valorMensal" | "estrategia">>): Promise<Plano> {
  await prisma().plano.upsert({ where: { pessoaId }, create: { pessoaId, ...mudancas }, update: mudancas });
  return plano(pessoaId);
}

/** O profissional sugere um valor mensal: vira aviso e mensagem da Luana para a pessoa. */
export async function sugerirValor(pessoaId: string, valor: number, profissional: Profissional): Promise<void> {
  await prisma().$transaction([
    prisma().plano.upsert({ where: { pessoaId }, create: { pessoaId, valorSugerido: valor }, update: { valorSugerido: valor } }),
    prisma().aviso.create({ data: { pessoaId, tipo: "sugestao", texto: avisoDeSugestao(profissional.nome, valor) } }),
    prisma().mensagem.create({ data: { pessoaId, canal: "app", de: "assistente", texto: mensagemDeSugestao(profissional.nome, valor) } }),
  ]);
}

/** Guarda a fatura lida e registra as compras novas que ganharam emoção e necessidade. */
export async function salvarFatura(pessoaId: string, fatura: Fatura, classificacoes: Record<string, Classificacao> = {}): Promise<Fatura> {
  const lancamentos = [];
  for (const [ordem, l] of fatura.lancamentos.entries()) {
    let compraId = l.compraId ?? null;
    const c = classificacoes[l.id];
    if (l.tipo === "compra" && !compraId && c?.emocao && c.necessidade) {
      const compra = await registrarCompra(
        pessoaId,
        { item: nomeDeCompraDaFatura(l.descricao), categoria: l.categoria ?? "Outro", valor: l.valor, emocao: c.emocao, necessidade: c.necessidade, via: "fatura" },
        new Date(`${l.data}T12:00:00`),
      );
      compraId = compra.id;
    }
    // Só liga a compras desta pessoa (o id veio do navegador).
    if (compraId && !(await prisma().compra.count({ where: { id: compraId, pessoaId } }))) compraId = null;
    lancamentos.push({
      data: l.data,
      descricao: l.descricao,
      valor: l.valor,
      tipo: l.tipo,
      categoria: l.categoria ?? null,
      compraId,
      ordem,
      parcela: l.parcela ?? null,
      totalParcelas: l.totalParcelas ?? null,
    });
  }
  return prisma().fatura.create({
    data: {
      pessoaId,
      tipo: fatura.tipo,
      origem: fatura.origem,
      mes: fatura.mes,
      lancamentos: { create: lancamentos },
      fonte: fatura.fonte ?? "documento",
      pluggyBillId: fatura.fonte === "pluggy" ? fatura.id : null,
      contaId: fatura.contaId ?? null,
      vencimento: fatura.vencimento ?? null,
      total: fatura.total ?? null,
      pagamentoMinimo: fatura.pagamentoMinimo ?? null,
      taxaRotativoMensal: fatura.taxaRotativoMensal ?? null,
      foraDosCalculos: fatura.foraDosCalculos ?? false,
    },
    include: { lancamentos: true },
  }).then(paraFatura);
}

export async function salvarMemoria(pessoaId: string, mudancas: Partial<Omit<Memoria, "anotacoes">>): Promise<void> {
  await prisma().memoria.upsert({ where: { pessoaId }, create: { pessoaId, caracteristicas: [], ...mudancas }, update: mudancas });
}

export async function anotar(pessoaId: string, nota: { autorId: string; texto: string; privada: boolean }): Promise<Anotacao> {
  const n = await prisma().anotacao.create({ data: { pessoaId, ...nota } });
  return { id: n.id, autorId: n.autorId, quando: iso(n.quando), texto: n.texto, privada: n.privada };
}

/** Apaga a anotação se ela é deste autor. Diz se apagou. */
export async function apagarAnotacao(pessoaId: string, anotacaoId: string, autorId: string): Promise<boolean> {
  return (await prisma().anotacao.deleteMany({ where: { id: anotacaoId, pessoaId, autorId } })).count > 0;
}

export async function estado(pessoaId: string, canal: Canal): Promise<EstadoConversa> {
  const e = await prisma().estadoConversa.findUnique({ where: { pessoaId_canal: { pessoaId, canal } } });
  return (e?.estado as unknown as EstadoConversa | undefined) ?? ESTADO_INICIAL;
}

export async function guardarEstado(pessoaId: string, canal: Canal, novo: EstadoConversa): Promise<void> {
  const valor = novo as unknown as Prisma.InputJsonValue;
  await prisma().estadoConversa.upsert({
    where: { pessoaId_canal: { pessoaId, canal } },
    create: { pessoaId, canal, estado: valor },
    update: { estado: valor },
  });
}

/** Grava mensagens da conversa. A mensagem da pessoa tira as respostas rápidas antigas. */
export async function guardarMensagens(
  pessoaId: string,
  canal: Canal,
  mensagens: { de: Mensagem["de"]; texto: string; respostasRapidas?: RespostaRapida[]; quando?: Date }[],
): Promise<Mensagem[]> {
  if (mensagens.some((m) => m.de === "pessoa")) {
    await prisma().mensagem.updateMany({
      where: { pessoaId, canal, respostasRapidas: { not: Prisma.DbNull } },
      data: { respostasRapidas: Prisma.DbNull },
    });
  }
  const criadas = [];
  const agora = Date.now();
  for (const [i, m] of mensagens.entries()) {
    criadas.push(
      await prisma().mensagem.create({
        data: {
          pessoaId,
          canal,
          de: m.de,
          texto: m.texto,
          // +1 ms por mensagem: gravadas juntas, continuam na ordem em que foram ditas.
          quando: new Date((m.quando?.getTime() ?? agora) + i),
          respostasRapidas: (m.respostasRapidas ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      }),
    );
  }
  return criadas.map(paraMensagem);
}

/** Conversa recente do canal, em texto, para a IA. */
export async function conversaRecente(pessoaId: string, canal: Canal, quantas = 12): Promise<string> {
  const ultimas = await prisma().mensagem.findMany({ where: { pessoaId, canal }, orderBy: { quando: "desc" }, take: quantas });
  return ultimas
    .reverse()
    .map((m) => `${m.de === "pessoa" ? "Pessoa" : "Luana"}: ${m.texto.slice(0, 400)}`)
    .join("\n");
}

// ---------- rotina e check-ins ----------

export async function rotina(pessoaId: string): Promise<Rotina> {
  const r = await prisma().rotina.findUnique({ where: { pessoaId } });
  if (!r) return ROTINA_PADRAO;
  return {
    horarios: { manha: r.horarioManha, tarde: r.horarioTarde, noite: r.horarioNoite },
    ligados: { manha: r.manhaLigado, tarde: r.tardeLigado, noite: r.noiteLigado },
    avisarQuandoTriste: r.avisarQuandoTriste,
    compartilharContas: r.compartilharContas,
  };
}

export interface MudancasNaRotina {
  horarios?: Partial<Record<Periodo, string>>;
  ligados?: Partial<Record<Periodo, boolean>>;
  avisarQuandoTriste?: boolean;
  compartilharContas?: boolean;
}

export async function salvarRotina(pessoaId: string, m: MudancasNaRotina): Promise<Rotina> {
  const dados = {
    ...(m.horarios?.manha !== undefined ? { horarioManha: m.horarios.manha } : {}),
    ...(m.horarios?.tarde !== undefined ? { horarioTarde: m.horarios.tarde } : {}),
    ...(m.horarios?.noite !== undefined ? { horarioNoite: m.horarios.noite } : {}),
    ...(m.ligados?.manha !== undefined ? { manhaLigado: m.ligados.manha } : {}),
    ...(m.ligados?.tarde !== undefined ? { tardeLigado: m.ligados.tarde } : {}),
    ...(m.ligados?.noite !== undefined ? { noiteLigado: m.ligados.noite } : {}),
    ...(m.avisarQuandoTriste !== undefined ? { avisarQuandoTriste: m.avisarQuandoTriste } : {}),
    ...(m.compartilharContas !== undefined ? { compartilharContas: m.compartilharContas } : {}),
  };
  await prisma().rotina.upsert({ where: { pessoaId }, create: { pessoaId, ...dados }, update: dados });
  return rotina(pessoaId);
}

const dataDoDia = (dia: string) => new Date(`${dia}T00:00:00Z`);
const diaDaData = (d: Date) => d.toISOString().slice(0, 10);

export async function checkins(pessoaId: string, dias = 14, agora = new Date()): Promise<CheckIn[]> {
  const desde = new Date(dataDoDia(hojeEmBrasilia(agora)).getTime() - dias * 86_400_000);
  const lista = await prisma().checkIn.findMany({ where: { pessoaId, dia: { gte: desde } }, orderBy: { quando: "asc" } });
  return lista.map((c) => ({ dia: diaDaData(c.dia), periodo: c.periodo as Periodo, humor: c.humor as Emocao, quando: iso(c.quando) }));
}

/** Grava (ou troca) a resposta do check-in de hoje naquele período. */
export async function responderCheckIn(pessoaId: string, periodo: Periodo, humor: Emocao, agora = new Date()): Promise<CheckIn> {
  const dia = hojeEmBrasilia(agora);
  await prisma().checkIn.upsert({
    where: { pessoaId_dia_periodo: { pessoaId, dia: dataDoDia(dia), periodo } },
    create: { pessoaId, dia: dataDoDia(dia), periodo, humor, quando: agora },
    update: { humor, quando: agora },
  });
  return { dia, periodo, humor, quando: iso(agora) };
}

// ---------- contas fixas, pagamentos e renda ----------

function paraConta(c: Prisma.ContaFixaModel): ContaFixa {
  return {
    id: c.id,
    nome: c.nome,
    categoria: c.categoria as CategoriaDaConta,
    valor: c.valor,
    vencimento: c.vencimento,
    variavel: c.variavel,
    debitoAutomatico: c.debitoAutomatico,
    lembrete: c.lembrete,
  };
}

export async function contasFixas(pessoaId: string): Promise<ContaFixa[]> {
  return (await prisma().contaFixa.findMany({ where: { pessoaId }, orderBy: [{ vencimento: "asc" }, { criadaEm: "asc" }] })).map(paraConta);
}

/** Pagamentos dos últimos meses (o mês atual é o que importa na tela). */
export async function pagamentos(pessoaId: string, agora = new Date()): Promise<Pagamento[]> {
  const [a, m] = hojeEmBrasilia(agora).split("-").map(Number);
  const anterior = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
  const lista = await prisma().pagamento.findMany({ where: { pessoaId, mes: { gte: anterior } }, orderBy: { quando: "asc" } });
  return lista.map((p) => ({ tipo: p.tipo as Pagamento["tipo"], alvoId: p.alvoId, mes: p.mes, valor: p.valor, quando: iso(p.quando) }));
}

export async function renda(pessoaId: string): Promise<Renda | null> {
  const p = await prisma().pessoa.findUnique({ where: { id: pessoaId }, select: { rendaMensal: true, diaDaRenda: true } });
  return p?.rendaMensal ? { valor: p.rendaMensal, dia: p.diaDaRenda ?? 5 } : null;
}

export async function salvarRenda(pessoaId: string, r: Renda | null): Promise<void> {
  await prisma().pessoa.update({ where: { id: pessoaId }, data: { rendaMensal: r?.valor || null, diaDaRenda: r?.dia ?? null } });
}

export async function salvarConta(pessoaId: string, c: ContaEditada): Promise<ContaFixa> {
  const dados = {
    nome: c.nome,
    categoria: c.categoria,
    valor: c.valor,
    vencimento: c.vencimento,
    variavel: c.variavel,
    debitoAutomatico: c.debitoAutomatico,
    lembrete: c.lembrete,
  };
  if (c.id) {
    const r = await prisma().contaFixa.updateMany({ where: { id: c.id, pessoaId }, data: dados });
    if (!r.count) throw new NaoEncontrado("Conta não encontrada.");
    return paraConta(await prisma().contaFixa.findUniqueOrThrow({ where: { id: c.id } }));
  }
  return paraConta(await prisma().contaFixa.create({ data: { pessoaId, ...dados } }));
}

export async function removerConta(pessoaId: string, contaId: string): Promise<void> {
  await prisma().contaFixa.deleteMany({ where: { id: contaId, pessoaId } });
  await prisma().pagamento.deleteMany({ where: { pessoaId, tipo: "conta", alvoId: contaId } });
}

/** A conta ou a dívida é desta pessoa? Devolve o valor previsto (conta) ou null (dívida). */
async function alvoDaPessoa(pessoaId: string, tipo: Pagamento["tipo"], alvoId: string): Promise<{ nome: string; valor: number | null }> {
  if (tipo === "conta") {
    const c = await prisma().contaFixa.findFirst({ where: { id: alvoId, pessoaId } });
    if (!c) throw new NaoEncontrado("Conta não encontrada.");
    return { nome: c.nome, valor: c.valor };
  }
  const d = await prisma().divida.findFirst({ where: { id: alvoId, pessoaId } });
  if (!d) throw new NaoEncontrado("Dívida não encontrada.");
  return { nome: d.nome, valor: null };
}

/** Marca como paga no mês (de Brasília). Sem valor, usa o valor da conta. */
export async function pagar(pessoaId: string, tipo: Pagamento["tipo"], alvoId: string, valor: number | null, agora = new Date()): Promise<void> {
  const alvo = await alvoDaPessoa(pessoaId, tipo, alvoId);
  const v = valor ?? alvo.valor;
  if (!v) throw new NaoEncontrado("Informe quanto foi pago.");
  const mes = hojeEmBrasilia(agora).slice(0, 7);
  await prisma().pagamento.upsert({
    where: { tipo_alvoId_mes: { tipo, alvoId, mes } },
    create: { pessoaId, tipo, alvoId, mes, valor: v, quando: agora },
    update: { valor: v, quando: agora },
  });
}

export async function desfazerPagamento(pessoaId: string, tipo: Pagamento["tipo"], alvoId: string, agora = new Date()): Promise<void> {
  await prisma().pagamento.deleteMany({ where: { pessoaId, tipo, alvoId, mes: hojeEmBrasilia(agora).slice(0, 7) } });
}

export * from "./repositorio-banco";
