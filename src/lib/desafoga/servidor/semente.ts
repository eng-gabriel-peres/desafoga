/**
 * Cria um espaço de demonstração com os dados fictícios (Ana, Carlos, Lúcia,
 * Rafael, Paula e Marcos), com datas relativas a agora. Usado por
 * `pnpm db:seed` e por "Entrar como Ana" (cada visita ganha a sua cópia).
 */
import { randomBytes } from "node:crypto";
import { materializar, PROFISSIONAIS, SEMENTES } from "@/fixtures/desafoga";
import type { SementeBanco } from "@/fixtures/desafoga/banco-da-ana";
import { avisoDeCompraDoBanco, avisoDeConsentimento, avisoDeLimiteDoCartao } from "@/lib/assistente/textos";
import { diaEmBrasilia } from "@/lib/banco/normalizar";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Transacao = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/** Código de convite curto, sem letras que se confundem (0/O, 1/I). */
export function novoConvite(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(6), (b) => letras[b % letras.length]).join("");
}

export interface EspacoCriado {
  espacoId: string;
  /** Ids no banco, pelo id curto da semente ("ana", "paula"). */
  pessoas: Record<string, string>;
  profissionais: Record<string, string>;
}

export async function criarEspacoDemo(db: Transacao, agora = new Date()): Promise<EspacoCriado> {
  const espaco = await db.espaco.create({ data: { tipo: "DEMO" } });
  const profissionais: Record<string, string> = {};
  for (const p of PROFISSIONAIS) {
    const criado = await db.profissional.create({
      data: { espacoId: espaco.id, slug: p.id, nome: p.nome, papel: p.papel, cor: p.cor, convite: novoConvite() },
    });
    profissionais[p.id] = criado.id;
  }

  const pessoas: Record<string, string> = {};
  for (const semente of SEMENTES) {
    const d = materializar(semente, agora);
    const pessoa = await db.pessoa.create({
      data: {
        espacoId: espaco.id,
        slug: d.persona.id,
        nome: d.persona.nome,
        apelido: d.persona.apelido,
        idade: d.persona.idade,
        cor: d.persona.cor,
        perfil: d.persona.perfil,
        rendaMensal: d.renda?.valor ?? null,
        diaDaRenda: d.renda?.dia ?? null,
        plano: { create: { valorMensal: d.plano.valorMensal, estrategia: d.plano.estrategia, valorSugerido: d.plano.valorSugerido } },
        memoria: {
          create: { caracteristicas: d.memoria.caracteristicas, tom: d.memoria.tom, objetivo: d.memoria.objetivo, evitar: d.memoria.evitar },
        },
        // Na demo, os dois profissionais acompanham todas as pessoas.
        acompanhamentos: { create: Object.values(profissionais).map((profissionalId) => ({ profissionalId })) },
      },
    });
    pessoas[d.persona.id] = pessoa.id;

    // Compras com ids novos; o mapa liga os lançamentos das faturas.
    const compraNova = new Map<string, string>();
    for (const c of d.compras) {
      const criada = await db.compra.create({
        data: {
          pessoaId: pessoa.id,
          item: c.item,
          categoria: c.categoria,
          valor: c.valor,
          emocao: c.emocao,
          necessidade: c.necessidade,
          quando: new Date(c.quando),
          via: c.via,
          avaliacaoProfissional: c.avaliacaoProfissional,
        },
      });
      compraNova.set(c.id, criada.id);
    }

    // Dívidas uma a uma: os pagamentos do mês apontam para o id novo.
    const dividaNova = new Map<string, string>();
    for (const x of d.dividas) {
      const criada = await db.divida.create({
        data: {
          pessoaId: pessoa.id,
          tipo: x.tipo,
          nome: x.nome,
          detalhe: x.detalhe,
          saldo: x.saldo,
          taxaMensal: x.taxaMensal,
          parcelaMinima: x.parcelaMinima,
          vencimento: x.vencimento,
        },
      });
      dividaNova.set(x.id, criada.id);
    }

    if (d.orcamentos.length) {
      await db.orcamento.createMany({ data: d.orcamentos.map((o) => ({ pessoaId: pessoa.id, categoria: o.categoria, limite: o.limite })) });
    }
    const contaNova = new Map<string, string>();
    for (const c of d.contas) {
      const { id, ...dados } = c;
      contaNova.set(id, (await db.contaFixa.create({ data: { pessoaId: pessoa.id, ...dados } })).id);
    }
    if (d.pagamentos.length) {
      await db.pagamento.createMany({
        data: d.pagamentos.map((p) => ({ pessoaId: pessoa.id, tipo: p.tipo, alvoId: (p.tipo === "conta" ? contaNova : dividaNova).get(p.alvoId) ?? p.alvoId, mes: p.mes, valor: p.valor, quando: new Date(p.quando) })),
      });
    }
    if (d.checkins.length) {
      await db.checkIn.createMany({
        data: d.checkins.map((c) => ({ pessoaId: pessoa.id, dia: new Date(`${c.dia}T00:00:00Z`), periodo: c.periodo, humor: c.humor, quando: new Date(c.quando) })),
        skipDuplicates: true,
      });
    }

    for (const m of d.metas) {
      await db.meta.create({
        data: {
          pessoaId: pessoa.id,
          nome: m.nome,
          icone: m.icone,
          cor: m.cor,
          alvo: m.alvo,
          inicial: m.inicial,
          modo: m.modo,
          frequencia: m.frequencia,
          valorPorPeriodo: m.valorPorPeriodo,
          lembrete: m.lembrete,
          prazo: m.prazo ? new Date(`${m.prazo}T00:00:00Z`) : null,
          criadaEm: new Date(`${m.criadaEm}T12:00:00`),
          movimentos: { create: m.depositos.map((v) => ({ valor: v.valor, descricao: v.descricao, quando: new Date(v.quando), via: v.via })) },
        },
      });
    }

    for (const f of d.faturas) {
      await db.fatura.create({
        data: {
          pessoaId: pessoa.id,
          tipo: f.tipo,
          origem: f.origem,
          mes: f.mes,
          lancamentos: {
            create: f.lancamentos.map((l, ordem) => ({
              data: l.data,
              descricao: l.descricao,
              valor: l.valor,
              tipo: l.tipo,
              categoria: l.categoria ?? null,
              compraId: l.compraId ? (compraNova.get(l.compraId) ?? null) : null,
              ordem,
            })),
          },
        },
      });
    }

    await db.anotacao.createMany({
      data: d.memoria.anotacoes.map((a) => ({
        pessoaId: pessoa.id,
        autorId: profissionais[a.autorId],
        texto: a.texto,
        privada: a.privada,
        quando: new Date(a.quando),
      })),
    });
    await db.aviso.createMany({
      data: d.avisos.map((a) => ({ pessoaId: pessoa.id, tipo: a.tipo, texto: a.texto, quando: new Date(a.quando) })),
    });
    await db.mensagem.createMany({
      data: d.conversa.map((m) => ({
        pessoaId: pessoa.id,
        canal: "app",
        de: m.de,
        texto: m.texto,
        quando: new Date(m.quando),
        respostasRapidas: (m.respostasRapidas ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    });
    if (semente.banco) await criarBancoDaDemo(db, pessoa.id, semente.banco, agora);
  }

  return { espacoId: espaco.id, pessoas, profissionais };
}

/** Dia (YYYY-MM-DD, Brasília) de N dias atrás. */
const diaDeAtras = (dias: number, agora: Date) => diaEmBrasilia(new Date(agora.getTime() - dias * 86_400_000));

function mesAtras(agora: Date, meses: number): string {
  const [a, m] = diaEmBrasilia(agora).split("-").map(Number);
  const t = a * 12 + (m - 1) - meses;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Banco de demonstração (sem Pluggy): conexão, contas, movimentos, compra parcelada, avisos e sugestões de dívida. */
async function criarBancoDaDemo(db: Transacao, pessoaId: string, b: SementeBanco, agora: Date): Promise<void> {
  const conexao = await db.conexaoBancaria.create({
    data: { pessoaId, pluggyItemId: null, banco: b.banco, status: "ok", ultimaSincronizacao: agora, consentimentoAte: new Date(agora.getTime() + b.consentimentoEmDias * 86_400_000) },
  });
  const contas: Record<string, string> = {};
  for (const c of b.contas) {
    const criada = await db.contaBancaria.create({
      data: {
        conexaoId: conexao.id,
        pluggyAccountId: `demo-${conexao.id}-${c.id}`,
        tipo: c.id,
        nome: c.nome,
        saldo: c.saldo,
        limite: c.limite ?? null,
        limiteDisponivel: c.limiteDisponivel ?? c.limite ?? null,
        fechamento: c.fechamentoDia ? proximoDia(c.fechamentoDia, agora) : null,
        vencimento: c.vencimentoDia ? proximoDia(c.vencimentoDia, agora) : null,
        chequeEspecialUsado: c.chequeEspecialUsado ?? null,
        chequeEspecialLimite: c.chequeEspecialLimite ?? null,
      },
    });
    contas[c.id] = criada.id;
  }
  const p = b.parcelada;
  const mesDaPrimeira = mesAtras(agora, p.primeiraHaMeses);
  const parcelada = await db.compraParcelada.create({
    data: {
      pessoaId,
      chave: `${contas.cartao}|${p.lojaOriginal}|${p.totalParcelas}|${p.valorParcela}|${mesDaPrimeira}`,
      origem: contas.cartao,
      fonte: "pluggy",
      nome: p.nome,
      lojaOriginal: p.lojaOriginal,
      categoria: p.categoria,
      valorTotal: p.valorParcela * p.totalParcelas,
      valorParcela: p.valorParcela,
      totalParcelas: p.totalParcelas,
      mesDaPrimeira,
      compradaEm: `${mesDaPrimeira}-03`,
      compradaEmEstimada: false,
      parcelasVistas: p.parcelasVistas,
    },
  });
  for (const m of b.movimentos) {
    const criado = await db.movimento.create({
      data: {
        pessoaId,
        contaId: contas[m.conta],
        pluggyId: `demo-${conexao.id}-${m.id}`,
        data: diaDeAtras(m.dias, agora),
        descricao: m.descricao,
        descricaoOriginal: m.descricao,
        valor: m.valor,
        direcao: m.direcao,
        natureza: m.natureza,
        categoria: m.categoria ?? null,
        situacao: m.situacao,
        parceladaId: m.parcela ? parcelada.id : null,
        parcela: m.parcela ?? null,
        totalParcelas: m.parcela ? p.totalParcelas : null,
        valorTotalDaCompra: m.parcela ? p.valorParcela * p.totalParcelas : null,
        jurosBoleto: m.jurosBoleto ?? null,
      },
    });
    if (m.situacao === "revisar") {
      const nome = m.descricao.charAt(0) + m.descricao.slice(1).toLowerCase();
      await db.aviso.create({ data: { pessoaId, tipo: "compra-banco", texto: avisoDeCompraDoBanco(nome, m.valor), quando: new Date(`${diaDeAtras(m.dias, agora)}T12:00:00-03:00`), referencia: criado.id } });
    }
  }
  for (const s of b.sugestoes) {
    await db.sugestao.create({ data: { pessoaId, chave: s.chave, tipo: "divida", dados: { ...s, conexaoId: conexao.id } as unknown as Prisma.InputJsonValue } });
  }

  // Investimento ligado à meta: o guardado da meta acompanha o saldo do banco.
  const inv = await db.investimentoBancario.create({
    data: { pessoaId, conexaoId: conexao.id, pluggyId: `demo-${conexao.id}-investimento`, nome: b.investimento.nome, tipo: b.investimento.tipo, saldo: b.investimento.saldo },
  });
  await db.meta.updateMany({ where: { pessoaId, nome: b.investimento.meta }, data: { investimentos: [inv.id] } });

  // Avisos que a sincronização daria: limite do cartão e autorização vencendo.
  const cartao = b.contas.find((c) => c.id === "cartao");
  if (cartao?.limite && cartao.limiteDisponivel !== undefined) {
    const fracao = (cartao.limite - cartao.limiteDisponivel) / cartao.limite;
    await db.aviso.create({ data: { pessoaId, tipo: "limite-cartao", texto: avisoDeLimiteDoCartao(cartao.nome, fracao, cartao.limiteDisponivel), quando: agora, referencia: `limite:${contas.cartao}:${cartao.fechamentoDia ? proximoDia(cartao.fechamentoDia, agora) : ""}` } });
  }
  await db.aviso.create({ data: { pessoaId, tipo: "consentimento", texto: avisoDeConsentimento(b.banco, b.consentimentoEmDias), quando: agora, referencia: `consentimento:${conexao.id}:${diaEmBrasilia(conexao.consentimentoAte!)}:vence` } });
}

/** Próxima data (YYYY-MM-DD) com esse dia do mês, a partir de hoje. */
function proximoDia(dia: number, agora: Date): string {
  const hoje = diaEmBrasilia(agora);
  const [a, m, d] = hoje.split("-").map(Number);
  const [ano, mes] = d < dia ? [a, m] : m === 12 ? [a + 1, 1] : [a, m + 1];
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
