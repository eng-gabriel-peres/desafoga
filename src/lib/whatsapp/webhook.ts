import { createHmac, timingSafeEqual } from "node:crypto";

export interface MensagemRecebida {
  id: string;
  /** Telefone de quem enviou, no formato da Meta (só dígitos, com DDI). */
  de: string;
  tipo: string;
  /** Presente só quando tipo === "text". */
  texto?: string;
}

/**
 * Confere o cabeçalho X-Hub-Signature-256 que a Meta envia em cada chamada:
 * "sha256=" + HMAC-SHA256 do corpo bruto com o App Secret.
 */
export function assinaturaValida(
  corpoBruto: string,
  cabecalho: string | null,
  appSecret: string,
): boolean {
  if (!cabecalho?.startsWith("sha256=")) return false;
  const esperado = createHmac("sha256", appSecret).update(corpoBruto).digest();
  const recebido = Buffer.from(cabecalho.slice("sha256=".length), "hex");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/** Extrai as mensagens do corpo do webhook, ignorando avisos de status. */
export function extrairMensagens(corpo: unknown): MensagemRecebida[] {
  const saida: MensagemRecebida[] = [];
  for (const entrada of lista(campo(corpo, "entry"))) {
    for (const mudanca of lista(campo(entrada, "changes"))) {
      for (const m of lista(campo(campo(mudanca, "value"), "messages"))) {
        const id = campo(m, "id");
        const de = campo(m, "from");
        const tipo = campo(m, "type");
        if (typeof id !== "string" || typeof de !== "string" || typeof tipo !== "string") continue;
        const texto = campo(campo(m, "text"), "body");
        saida.push({ id, de, tipo, texto: typeof texto === "string" ? texto : undefined });
      }
    }
  }
  return saida;
}

function campo(obj: unknown, chave: string): unknown {
  return typeof obj === "object" && obj !== null
    ? (obj as Record<string, unknown>)[chave]
    : undefined;
}

function lista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : [];
}
