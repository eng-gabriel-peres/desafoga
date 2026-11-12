const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 123456 -> "R$ 1.234,56" */
export function formatarReais(centavos: number): string {
  // Intl usa espaço não separável; trocamos por espaço comum para o WhatsApp.
  return BRL.format(centavos / 100).replace(/ /g, " ");
}

/**
 * Lê o primeiro valor em reais de um texto e devolve em centavos.
 * Aceita "900", "R$ 1.200", "1.200,50", "350,5" e também "8 mil", "1,5 mil",
 * "2k" e "8 mil e 500". Devolve null se não houver número.
 */
export function lerValorEmReais(texto: string): number | null {
  const m = texto.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/);
  if (!m) return null;
  const reais = Number(m[1].replace(/\./g, ""));
  const centavos = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
  const valor = reais * 100 + centavos;

  // "8 mil", "1,5 mil", "2k", com um complemento opcional: "8 mil e 500".
  const depois = texto.slice((m.index ?? 0) + m[0].length);
  const mil = /^\s*(?:mil|k)\b(?:\s+e\s+(\d{1,3})\b)?/i.exec(depois);
  if (!mil) return valor;
  return valor * 1000 + (mil[1] ? Number(mil[1]) * 100 : 0);
}

/** "13,80" ou "13.8%" -> 0.138. Devolve null se não for um percentual plausível. */
export function lerPercentual(texto: string): number | null {
  const m = texto.match(/(\d+)(?:[.,](\d+))?/);
  if (!m) return null;
  const valor = Number(`${m[1]}.${m[2] ?? "0"}`);
  return valor > 0 && valor < 100 ? valor / 100 : null;
}
