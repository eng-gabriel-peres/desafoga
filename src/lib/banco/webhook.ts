/**
 * Avisos da Pluggy (webhook). A Pluggy não assina o webhook: a URL leva um
 * segredo (?s=) e o corpo tem que trazer o nosso clientId. O aviso só diz que
 * algo mudou; os dados são buscados de novo com a nossa chave.
 */
import { timingSafeEqual } from "node:crypto";
import * as repo from "@/lib/desafoga/servidor/repositorio";
import { sincronizar } from "./sincronizar";

export interface EventoPluggy {
  event: string;
  eventId?: string;
  clientId: string;
  itemId?: string;
  transactionIds?: string[];
}

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** O evento, se o segredo da URL e o clientId conferem; senão null. */
export function conferirWebhook(segredoDaUrl: string | null, corpo: unknown): EventoPluggy | null {
  const segredo = process.env.PLUGGY_WEBHOOK_SEGREDO;
  const clientId = process.env.PLUGGY_CLIENT_ID;
  if (!segredo || !clientId || !segredoDaUrl || !iguais(segredoDaUrl, segredo)) return null;
  if (!corpo || typeof corpo !== "object") return null;
  const e = corpo as Partial<EventoPluggy>;
  if (typeof e.event !== "string" || e.clientId !== clientId) return null;
  return e as EventoPluggy;
}

/** URL que a Pluggy deve chamar, com o segredo; null sem URL pública https. */
export function urlDoWebhook(): string | null {
  const base = process.env.PLUGGY_WEBHOOK_URL;
  const segredo = process.env.PLUGGY_WEBHOOK_SEGREDO;
  if (!base || !segredo || !base.startsWith("https://")) return null;
  const url = new URL(base);
  url.searchParams.set("s", segredo);
  return url.toString();
}

/** Roda depois de responder à Pluggy (que só espera 10 s). */
export async function processarWebhook(e: EventoPluggy): Promise<void> {
  if (e.event === "transactions/deleted" && e.transactionIds?.length) {
    await repo.apagarMovimentos(e.transactionIds);
    return;
  }
  if (!e.itemId) return;
  const conexao = await repo.conexaoPorItem(e.itemId);
  if (!conexao) return;
  if (e.event === "item/deleted") {
    await repo.apagarConexao(conexao.pessoaId, conexao.id);
    return;
  }
  if (e.event.startsWith("item/") || e.event.startsWith("transactions/")) await sincronizar(conexao.id);
}
