import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Link pessoal para abrir o painel no navegador a partir do WhatsApp. O link
 * carrega a conta e o vencimento, assinados pelo servidor: não dá para
 * adivinhar nem alterar, e deixa de valer sozinho.
 */

/** Tempo de validade de um link, em minutos. */
export const VALIDADE_EM_MINUTOS = 30;

/**
 * Chave de assinatura. PAINEL_LINK_SECRET, quando existe; senão é derivada de
 * um segredo que o servidor já tem. Sem nenhum, o link fica indisponível.
 */
function chave(): Buffer | null {
  const base = process.env.PAINEL_LINK_SECRET || process.env.TWILIO_AUTH_TOKEN || process.env.WHATSAPP_APP_SECRET;
  return base ? createHmac("sha256", base).update("luana:link-do-painel:v1").digest() : null;
}

const assinar = (dados: string, segredo: Buffer) => createHmac("sha256", segredo).update(dados).digest("base64url");

/** Cria o código do link para uma conta; null quando não há chave de assinatura. */
export function criarCodigo(usuario: string, agora = Date.now(), minutos = VALIDADE_EM_MINUTOS): string | null {
  const segredo = chave();
  if (!segredo) return null;
  const dados = Buffer.from(JSON.stringify({ u: usuario, e: agora + minutos * 60_000 })).toString("base64url");
  return `${dados}.${assinar(dados, segredo)}`;
}

/** Devolve a conta de um código válido e ainda dentro do prazo; senão, null. */
export function lerCodigo(codigo: unknown, agora = Date.now()): string | null {
  const segredo = chave();
  if (!segredo || typeof codigo !== "string" || codigo.length > 600) return null;
  const [dados, assinatura, sobra] = codigo.split(".");
  if (!dados || !assinatura || sobra !== undefined) return null;

  const esperada = Buffer.from(assinar(dados, segredo));
  const recebida = Buffer.from(assinatura);
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;

  try {
    const { u, e } = JSON.parse(Buffer.from(dados, "base64url").toString("utf8")) as { u?: unknown; e?: unknown };
    return typeof u === "string" && typeof e === "number" && e > agora ? u : null;
  } catch {
    return null;
  }
}

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/[.!?\s]+$/, "")
    .toLowerCase();

const PEDIDOS = new Set(["painel", "ver painel", "abrir painel", "link", "link do painel", "resumo geral", "grafico", "graficos"]);

/** A mensagem é um pedido do link do painel? */
export function pedidoDePainel(texto: string): boolean {
  return PEDIDOS.has(semAcento(texto));
}

/**
 * Endereço público do site. Em produção na Vercel vale o domínio do projeto;
 * fora dela, o host por onde a chamada chegou.
 */
export function origemDoSite(cabecalhos: Headers): string {
  const daVercel = process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined;
  if (daVercel) return `https://${daVercel}`;
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host") ?? "localhost:3000";
  const protocolo = cabecalhos.get("x-forwarded-proto")?.split(",")[0] ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

/** Texto que a Luana manda no WhatsApp com o link do painel. */
export function mensagemDoPainel(usuario: string, origem: string, agora = Date.now()): string {
  const codigo = criarCodigo(usuario, agora);
  if (!codigo) return "O painel pelo link não está disponível agora. Escreva _resumo_ que eu mando os números aqui.";
  // O código vai depois do #: o navegador não o envia na abertura da página.
  return [
    "Seu painel, com os meses, as categorias e o previsto:",
    `${origem}/p#${codigo}`,
    `O link vale por ${VALIDADE_EM_MINUTOS} minutos e mostra os seus gastos: não encaminhe. Para abrir de novo, escreva _painel_.`,
  ].join("\n\n");
}
