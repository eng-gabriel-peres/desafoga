/**
 * Leitura e gravação dos dados do Desafoga no Postgres (Prisma), devolvendo
 * os tipos de domínio que as telas e a Luana usam. Quem pode ver ou mudar o
 * quê é decidido antes, em `acesso.ts`.
 */
import type { ContextoAssistente, EstadoConversa } from "@/lib/assistente/conversa";
import { ESTADO_INICIAL } from "@/lib/assistente/conversa";
import type { Categoria, Emocao, Estrategia, Necessidade, TipoDivida, TipoLancamento } from "@/lib/finance";
import { Prisma } from "@/generated/prisma/client";
import type {
  Anotacao,
  Aviso,
  Classificacao,
  Compra,
  Divida,
  Fatura,
  Memoria,
  Mensagem,
  NovaCompra,
  Persona,
  Plano,
  Profissional,
  RespostaRapida,
  Tom,
} from "@/services/tipos";
import { avisoDeCompraAlta, avisoDeSugestao, mensagemDeSugestao, nomeDeCompraDaFatura } from "../regras";
import { prisma } from "./prisma";

export type Canal = "app" | "whatsapp";

const iso = (d: Date) => d.toISOString();

function paraPersona(p: { id: string; nome: string; apelido: string; idade: number | null; cor: string; perfil: string }): Persona {
  return { id: p.id, nome: p.nome, apelido: p.apelido, idade: p.idade, cor: p.cor, perfil: p.perfil };
}

function paraProfissional(p: { id: string; nome: string; papel: string; cor: string }): Profissional {
  return { id: p.id, nome: p.nome, papel: p.papel, cor: p.cor };
}

function paraCompra(c: Prisma.CompraModel): Compra {
  return {
    id: c.id,
    item: c.item,
    categoria: c.categoria as Categoria,
    valor: c.valor,
    emocao: c.emocao as Emocao,
    necessidade: c.necessidade as Necessidade,
    quando: iso(c.quando),
    via: c.via as Compra["via"],
    avaliacaoProfissional: c.avaliacaoProfissional as Necessidade | null,
  };
}

function paraDivida(d: Prisma.DividaModel): Divida {
  return {
    id: d.id,
    tipo: d.tipo as TipoDivida,
    nome: d.nome,
    detalhe: d.detalhe,
    saldo: d.saldo,
    taxaMensal: d.taxaMensal,
    parcelaMinima: d.parcelaMinima,
    vencimento: d.vencimento,
  };
}

function paraFatura(f: Prisma.FaturaModel & { lancamentos: Prisma.LancamentoModel[] }): Fatura {
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
      })),
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
  const [p, c, d, pl, f, m, profs] = await Promise.all([
    persona(pessoaId),
    compras(pessoaId),
    dividas(pessoaId),
    plano(pessoaId),
    faturas(pessoaId),
    memoria(pessoaId, true),
    acompanhantes(pessoaId),
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
export async function salvarFatura(pessoaId: string, fatura: Fatura, classificacoes: Record<string, Classificacao> = {}): Promise<void> {
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
    lancamentos.push({ data: l.data, descricao: l.descricao, valor: l.valor, tipo: l.tipo, categoria: l.categoria ?? null, compraId, ordem });
  }
  await prisma().fatura.create({
    data: { pessoaId, tipo: fatura.tipo, origem: fatura.origem, mes: fatura.mes, lancamentos: { create: lancamentos } },
  });
}

export async function salvarMemoria(pessoaId: string, mudancas: Partial<Omit<Memoria, "anotacoes">>): Promise<void> {
  await prisma().memoria.upsert({ where: { pessoaId }, create: { pessoaId, caracteristicas: [], ...mudancas }, update: mudancas });
}

export async function anotar(pessoaId: string, nota: { autorId: string; texto: string; privada: boolean }): Promise<Anotacao> {
  const n = await prisma().anotacao.create({ data: { pessoaId, ...nota } });
  return { id: n.id, autorId: n.autorId, quando: iso(n.quando), texto: n.texto, privada: n.privada };
}

export async function apagarAnotacao(pessoaId: string, anotacaoId: string): Promise<void> {
  await prisma().anotacao.deleteMany({ where: { id: anotacaoId, pessoaId } });
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
  for (const m of mensagens) {
    criadas.push(
      await prisma().mensagem.create({
        data: {
          pessoaId,
          canal,
          de: m.de,
          texto: m.texto,
          quando: m.quando ?? new Date(),
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
