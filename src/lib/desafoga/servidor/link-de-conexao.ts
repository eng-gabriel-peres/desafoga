/**
 * Link assinado para conectar o WhatsApp sem digitar código. A Luana manda o
 * link para o número que escreveu para ela; quem abre o link prova que tem
 * aquele WhatsApp na mão. Vale 30 minutos e uma vez só.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const VALIDADE_DO_LINK_MS = 30 * 60_000;

/**
 * Chave de assinatura, derivada de um segredo que o servidor já tem. Em
 * desenvolvimento, sem segredo, usa uma chave fixa; em produção, sem segredo,
 * o link fica indisponível.
 */
function chave(): Buffer | null {
  const base =
    process.env.PAINEL_LINK_SECRET ||
    process.env.TWILIO_AUTH_TOKEN ||
    process.env.WHATSAPP_APP_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "desafoga-desenvolvimento");
  return base ? createHmac("sha256", base).update("desafoga:conectar-whatsapp:v1").digest() : null;
}

const assinar = (dados: string, segredo: Buffer) => createHmac("sha256", segredo).update(dados).digest("base64url");

/** Código do link para o número; null quando não há chave. */
export function criarCodigoDeConexao(telefone: string, agora = Date.now()): string | null {
  const segredo = chave();
  if (!segredo) return null;
  const dados = Buffer.from(JSON.stringify({ t: telefone, e: agora + VALIDADE_DO_LINK_MS, n: randomUUID() })).toString("base64url");
  return `${dados}.${assinar(dados, segredo)}`;
}

/** Número e identificador de uso único de um código válido e no prazo; senão, null. */
export function lerCodigoDeConexao(codigo: unknown, agora = Date.now()): { telefone: string; uso: string } | null {
  const segredo = chave();
  if (!segredo || typeof codigo !== "string" || codigo.length > 600) return null;
  const [dados, assinatura, sobra] = codigo.split(".");
  if (!dados || !assinatura || sobra !== undefined) return null;
  const esperada = Buffer.from(assinar(dados, segredo));
  const recebida = Buffer.from(assinatura);
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;
  try {
    const { t, e, n } = JSON.parse(Buffer.from(dados, "base64url").toString("utf8")) as { t?: unknown; e?: unknown; n?: unknown };
    return typeof t === "string" && typeof e === "number" && typeof n === "string" && e > agora ? { telefone: t, uso: n } : null;
  } catch {
    return null;
  }
}

/** Endereço completo do link. O código vai depois do #: o navegador não o manda ao servidor nem a outros sites. */
export function linkDeConexao(origem: string, telefone: string): string | null {
  const codigo = criarCodigoDeConexao(telefone);
  return codigo ? `${origem}/app/conectar#${codigo}` : null;
}
