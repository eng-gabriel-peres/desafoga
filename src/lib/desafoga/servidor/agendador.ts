/**
 * Roda o agendador: para cada pessoa (fora da demo), vê o que a Luana tem a
 * mandar agora e manda cada chave uma vez só. A mensagem sempre fica no chat
 * do app; o WhatsApp é tentado para quem confirmou o número, mas fora da
 * janela de 24 horas ele só aceita modelos aprovados, então pode recusar.
 */
import { chaveDoCheckIn, enviosDoMomento, enviosDosEventos } from "@/lib/desafoga/agendador";
import type { Periodo } from "@/lib/finance";
import { hojeEmBrasilia } from "@/lib/luana/lancamentos";
import { pluggyConfigurado } from "@/lib/banco/pluggy";
import { sincronizar } from "@/lib/banco/sincronizar";
import { enviarPeloWhatsapp, whatsappConfigurado } from "./enviar";
import { prisma } from "./prisma";
import { registros } from "./registros";
import * as repo from "./repositorio";

export interface ResultadoDoAgendador {
  pessoas: number;
  enviados: number;
  whatsapp: number;
  falhas: number;
  /** Conexões de banco atualizadas nesta rodada. */
  bancos: number;
}

interface Opcoes {
  agora?: Date;
  /** Só estas pessoas (testes). */
  pessoas?: string[];
  /** Quem manda no WhatsApp; null não tenta. Padrão: o canal configurado, se houver. */
  whatsapp?: ((numero: string, texto: string) => Promise<void>) | null;
  /** Atualiza uma conexão de banco; null não atualiza. Padrão: a Pluggy, se configurada. */
  sincronizarBanco?: ((conexaoId: string) => Promise<unknown>) | null;
}

/**
 * Sem o webhook da Pluggy, o banco só atualizava quando a pessoa abria o app
 * (e o aviso de compra nova esperava por isso). A cada rodada, as conexões
 * paradas há mais de 6 horas são atualizadas, poucas por vez para caber no
 * tempo da função.
 */
const HORAS_SEM_ATUALIZAR = 6;
const BANCOS_POR_RODADA = 2;

const chaveDoEnvio = (chave: string) => `agendador:${chave}`;

/** O agendador já mandou a pergunta deste check-in hoje (para o chat não repetir). */
export async function checkInJaPerguntado(pessoaId: string, periodo: Periodo, agora = new Date()): Promise<boolean> {
  return (await registros().ler(chaveDoEnvio(chaveDoCheckIn(pessoaId, hojeEmBrasilia(agora), periodo)))) !== null;
}

export async function rodarAgendador({ agora = new Date(), pessoas, whatsapp, sincronizarBanco }: Opcoes = {}): Promise<ResultadoDoAgendador> {
  const enviar = whatsapp === undefined ? (whatsappConfigurado() ? enviarPeloWhatsapp : null) : whatsapp;
  const atualizarBanco =
    sincronizarBanco === undefined ? (pluggyConfigurado() ? (id: string) => sincronizar(id, { agora, pedirAtualizacao: true }) : null) : sincronizarBanco;
  const lista = await prisma().pessoa.findMany({
    where: { espaco: { tipo: "REAL" }, ...(pessoas ? { id: { in: pessoas } } : {}) },
    select: { id: true, apelido: true, telefone: true },
  });
  const r: ResultadoDoAgendador = { pessoas: lista.length, enviados: 0, whatsapp: 0, falhas: 0, bancos: 0 };

  if (atualizarBanco) {
    const paradas = await repo.reservarConexoesParadas(agora, { horas: HORAS_SEM_ATUALIZAR, limite: BANCOS_POR_RODADA, pessoas });
    const feitas = await Promise.allSettled(paradas.map((id) => atualizarBanco(id)));
    r.bancos = feitas.filter((f) => f.status === "fulfilled").length;
    for (const f of feitas) if (f.status === "rejected") console.error("Desafoga: agendador não atualizou um banco,", f.reason instanceof Error ? f.reason.message.slice(0, 200) : "erro");
  }

  for (const p of lista) {
    try {
      const [rotina, checkins, contas, pagamentos, metas, config, compras, dividas, plano] = await Promise.all([
        repo.rotina(p.id),
        repo.checkins(p.id, 1, agora),
        repo.contasFixas(p.id),
        repo.pagamentos(p.id, agora),
        repo.metas(p.id),
        repo.configDosAvisos(p.id),
        repo.comprasDesde(p.id, new Date(agora.getTime() - 8 * 86_400_000)),
        repo.dividas(p.id),
        repo.plano(p.id),
      ]);
      await repo.conferirConquistas(p.id, agora);
      const envios = [
        ...enviosDoMomento({ pessoaId: p.id, apelido: p.apelido, rotina, checkins, contas, pagamentos, metas, config, compras, dividas, plano }, agora),
        ...enviosDosEventos(p.id, await repo.eventosDe({ pessoaId: p.id }, agora), agora),
      ];
      for (const [i, e] of envios.entries()) {
        // Reserva a chave antes: duas chamadas ao mesmo tempo não mandam duas vezes.
        if (!(await registros().criarSeNaoExiste(chaveDoEnvio(e.chave), { quando: agora.toISOString() }))) continue;
        try {
          await repo.mensagemDaLuana(p.id, e.texto, new Date(agora.getTime() + i));
        } catch (erro) {
          await registros().apagar(chaveDoEnvio(e.chave));
          throw erro;
        }
        r.enviados++;
        if (e.paraQuemAcompanha) await repo.avisar(p.id, "resumo-semana", e.paraQuemAcompanha, agora);
        if (enviar && p.telefone) {
          await enviar(p.telefone, e.texto).then(
            () => r.whatsapp++,
            (erro: unknown) => console.error("Desafoga: agendador sem WhatsApp,", erro instanceof Error ? erro.message.slice(0, 200) : "erro"),
          );
        }
      }
    } catch (erro) {
      // Uma pessoa com problema não pode travar as outras.
      r.falhas++;
      console.error("Desafoga: agendador falhou para uma pessoa,", erro instanceof Error ? erro.message.slice(0, 200) : "erro");
    }
  }
  return r;
}
