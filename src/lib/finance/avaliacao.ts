/** O profissional diz se, na opinião dele, cada compra era necessária (a pessoa vê só a própria resposta). */
import type { Compra } from "./tipos";

export type FiltroDaAvaliacao = "todas" | "pendentes" | "diferentes";

/** Avaliou e discorda, ou a pessoa não soube (ou não respondeu): bom assunto para a conversa. */
export function opinioesDiferentes(c: Compra): boolean {
  if (c.avaliacaoProfissional === null) return false;
  return c.necessidade === null || c.necessidade === "talvez" || c.avaliacaoProfissional !== c.necessidade;
}

const QUATORZE_DIAS = 14 * 86_400_000;

export function comprasParaAvaliar(compras: Compra[], agora: Date, filtro: FiltroDaAvaliacao) {
  const recentes = compras.filter((c) => agora.getTime() - Date.parse(c.quando) <= QUATORZE_DIAS).sort((a, b) => b.quando.localeCompare(a.quando));
  const pendentes = recentes.filter((c) => c.avaliacaoProfissional === null);
  const diferentes = recentes.filter(opinioesDiferentes);
  return {
    lista: filtro === "pendentes" ? pendentes : filtro === "diferentes" ? diferentes : recentes,
    contagem: { todas: recentes.length, pendentes: pendentes.length, diferentes: diferentes.length },
  };
}
