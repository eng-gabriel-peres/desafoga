/** Conquistas: metas com prêmio que o profissional cria; o progresso sai das compras. */
import { chaveDoDia, diaDe } from "./datas";
import { notaMedia } from "./emocao";
import type { Compra, Conquista, TipoDeConquista } from "./tipos";

export const TIPOS_DE_CONQUISTA: Record<TipoDeConquista, { titulo: string; unidade: string; descricao: string }> = {
  "sem-impulso": {
    titulo: "Dias seguidos sem compra desnecessária",
    unidade: "dias",
    descricao: "Conta os dias em que a pessoa não marcou nenhuma compra como não necessária.",
  },
  registrar: { titulo: "Compras registradas", unidade: "compras", descricao: "Incentiva a anotar tudo, pelo app ou pelo WhatsApp." },
  "nota-boa": { titulo: "Dias com nota do dia 3 ou mais", unidade: "dias", descricao: "Conta os dias em que a pessoa comprou estando bem." },
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O nome sugerido quando o profissional não escreve um. */
export function tituloAutomatico(tipo: TipoDeConquista, n: number): string {
  if (tipo === "sem-impulso") return `${plural(n, "dia", "dias")} sem compra por impulso`;
  if (tipo === "registrar") return `Anotar ${plural(n, "compra", "compras")}`;
  return `${plural(n, "dia", "dias")} comprando de bem com a vida`;
}

/** Quanto já foi feito, contando só a partir de quando a conquista foi criada. */
export function progressoDaConquista(c: Conquista, compras: Compra[], agora: Date): number {
  const inicio = diaDe(c.criadaEm);
  const depois = compras.filter((x) => x.quando >= c.criadaEm);
  if (c.tipo === "registrar") return depois.length;

  const porDia = new Map<string, Compra[]>();
  for (const x of compras) {
    const dia = diaDe(x.quando);
    if (dia >= inicio) porDia.set(dia, [...(porDia.get(dia) ?? []), x]);
  }
  if (c.tipo === "nota-boa") return [...porDia.values()].filter((l) => (notaMedia(l) ?? 0) >= 3).length;

  // Dias seguidos sem "não necessária", de hoje para trás, até o dia da criação.
  let n = 0;
  for (const d = new Date(agora); chaveDoDia(d) >= inicio; d.setDate(d.getDate() - 1)) {
    if ((porDia.get(chaveDoDia(d)) ?? []).some((x) => x.necessidade === "nao")) break;
    n++;
  }
  return n;
}

export function conquistada(c: Conquista, compras: Compra[], agora: Date): boolean {
  return c.concluidaEm !== null || progressoDaConquista(c, compras, agora) >= c.alvo;
}
