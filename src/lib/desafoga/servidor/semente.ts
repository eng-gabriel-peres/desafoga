/**
 * Cria um espaço de demonstração com os dados fictícios (Ana, Carlos, Lúcia,
 * Rafael, Paula e Marcos), com datas relativas a agora. Usado por
 * `pnpm db:seed` e por "Entrar como Ana" (cada visita ganha a sua cópia).
 */
import { randomBytes } from "node:crypto";
import { materializar, PROFISSIONAIS, SEMENTES } from "@/fixtures/desafoga";
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

    await db.divida.createMany({
      data: d.dividas.map((x) => ({
        pessoaId: pessoa.id,
        tipo: x.tipo,
        nome: x.nome,
        detalhe: x.detalhe,
        saldo: x.saldo,
        taxaMensal: x.taxaMensal,
        parcelaMinima: x.parcelaMinima,
        vencimento: x.vencimento,
      })),
    });

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
  }

  return { espacoId: espaco.id, pessoas, profissionais };
}
