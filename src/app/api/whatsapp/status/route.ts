import type { NextRequest } from "next/server";
import { ultimosEventos } from "@/lib/whatsapp/diagnostico";

/**
 * Diagnóstico do WhatsApp: diz se cada variável tem o formato esperado, se o
 * token acessa o número e o que aconteceu nas últimas chamadas do webhook.
 * Não devolve nenhum valor secreto. Exige o token de verificação.
 */
export async function GET(request: NextRequest) {
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!esperado || request.nextUrl.searchParams.get("token") !== esperado) {
    return new Response("Não autorizado.", { status: 403 });
  }

  const token = process.env.WHATSAPP_TOKEN ?? "";
  const segredo = process.env.WHATSAPP_APP_SECRET ?? "";
  const numero = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  const versao = process.env.WHATSAPP_API_VERSION ?? "v23.0";

  let acessoAoNumero = "não testado";
  if (token && numero) {
    try {
      const r = await fetch(`https://graph.facebook.com/${versao}/${numero}?fields=display_phone_number`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      acessoAoNumero = r.ok ? "ok" : `erro ${r.status}: ${(await r.text()).slice(0, 300)}`;
    } catch (erro) {
      acessoAoNumero = `falha de rede: ${erro instanceof Error ? erro.message : "erro"}`;
    }
  }

  return Response.json({
    variaveis: {
      WHATSAPP_TOKEN: token ? (token.startsWith("EAA") ? "parece um token" : "não parece um token") : "vazia",
      WHATSAPP_APP_SECRET: segredo
        ? /^[0-9a-f]{32}$/.test(segredo)
          ? "parece uma chave secreta"
          : `não parece uma chave secreta (${segredo.length} caracteres)`
        : "vazia",
      WHATSAPP_PHONE_NUMBER_ID: numero ? (/^\d+$/.test(numero) ? "numérico" : "não é numérico") : "vazia",
    },
    acessoAoNumero,
    eventos: ultimosEventos(),
  });
}
