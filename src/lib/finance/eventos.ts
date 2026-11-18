/**
 * Eventos: desafios em grupo (uma regra seguida por alguns dias, conferida
 * pelas compras registradas) e encontros presenciais. Datas em chaves
 * "YYYY-MM-DD"; quem chama calcula o dia de cada compra no fuso certo.
 */
import type { Categoria, Emocao, Necessidade } from "./tipos";

export type RegraDoDesafio = "sem-desnecessaria" | "sem-categoria" | "limite-dia" | "nota-boa";

export const REGRAS_DO_DESAFIO: Record<RegraDoDesafio, { titulo: string; descricao: string }> = {
  "sem-desnecessaria": { titulo: "Nenhuma compra não necessária", descricao: "O dia conta se nenhuma compra for marcada como não necessária." },
  "sem-categoria": { titulo: "Não comprar de uma categoria", descricao: "Por exemplo, nada de comida por aplicativo enquanto o desafio durar." },
  "limite-dia": { titulo: "Gastar no máximo um valor por dia", descricao: "O dia conta se a soma das compras ficar dentro do limite." },
  "nota-boa": { titulo: "Comprar só estando bem", descricao: "O dia conta se a nota do dia for 3 ou mais, ou se não houver compras." },
};

export interface RegrasDoDesafio {
  regra: RegraDoDesafio;
  categoria: Categoria | null;
  /** Centavos, na regra "limite-dia". */
  limite: number | null;
}

export interface CompraNoDia {
  /** "YYYY-MM-DD" da compra. */
  dia: string;
  categoria: Categoria;
  valor: number;
  emocao: Emocao | null;
  necessidade: Necessidade | null;
}

export function diaDentroDaRegra(r: RegrasDoDesafio, compras: CompraNoDia[]): boolean {
  if (r.regra === "sem-categoria") return !compras.some((c) => c.categoria === r.categoria);
  if (r.regra === "limite-dia") return compras.reduce((s, c) => s + c.valor, 0) <= (r.limite ?? 0);
  if (r.regra === "nota-boa") {
    const sentidas = compras.filter((c) => c.emocao !== null);
    if (!sentidas.length) return true;
    return sentidas.reduce((s, c) => s + (c.emocao ?? 0), 0) / sentidas.length >= 3;
  }
  return !compras.some((c) => c.necessidade === "nao");
}

const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Todas as chaves de `de` até `ate`, inclusive (no máximo 366). */
export function diasEntreChaves(de: string, ate: string): string[] {
  const dias: string[] = [];
  for (let d = de; d <= ate && dias.length < 366; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

export type EstadoDoDia = "ok" | "fora" | "futuro" | "antes";

export interface AndamentoNoDesafio {
  dias: { dia: string; estado: EstadoDoDia }[];
  ok: number;
  /** Dias que já contaram (desde que entrou até hoje). */
  contados: number;
  /** Dias seguidos dentro da regra, terminando no último dia contado. */
  sequencia: number;
  /** 10 por dia na regra e +5 por dia seguido, a partir do segundo. */
  pontos: number;
}

export const PONTOS_POR_DIA = 10;
export const BONUS_DE_SEQUENCIA = 5;

export function andamentoNoDesafio(
  desafio: RegrasDoDesafio & { inicio: string; fim: string },
  entrouEm: string,
  compras: CompraNoDia[],
  hoje: string,
): AndamentoNoDesafio {
  const porDia = new Map<string, CompraNoDia[]>();
  for (const c of compras) porDia.set(c.dia, [...(porDia.get(c.dia) ?? []), c]);
  let ok = 0;
  let contados = 0;
  let seguidos = 0;
  let pontos = 0;
  const dias = diasEntreChaves(desafio.inicio, desafio.fim).map((dia) => {
    if (dia > hoje) return { dia, estado: "futuro" as const };
    if (dia < entrouEm) return { dia, estado: "antes" as const };
    contados++;
    if (!diaDentroDaRegra(desafio, porDia.get(dia) ?? [])) {
      seguidos = 0;
      return { dia, estado: "fora" as const };
    }
    ok++;
    seguidos++;
    pontos += PONTOS_POR_DIA + (seguidos >= 2 ? BONUS_DE_SEQUENCIA : 0);
    return { dia, estado: "ok" as const };
  });
  return { dias, ok, contados, sequencia: seguidos, pontos };
}

/** Ordena o ranking; pontos iguais dividem a posição. */
export function classificar<T extends { nome: string; pontos: number; ok: number; sequencia: number }>(linhas: T[]): (T & { posicao: number })[] {
  const ordem = [...linhas].sort((a, b) => b.pontos - a.pontos || b.ok - a.ok || b.sequencia - a.sequencia || a.nome.localeCompare(b.nome));
  let posicao = 0;
  let ultimo: number | null = null;
  return ordem.map((l, i) => {
    if (l.pontos !== ultimo) {
      posicao = i + 1;
      ultimo = l.pontos;
    }
    return { ...l, posicao };
  });
}

export interface SituacaoDoEvento {
  fase: "breve" | "agora" | "fim";
  texto: string;
}

export function situacaoDoEvento(e: { tipo: "desafio" | "presencial"; inicio: string | null; fim: string | null; data: string | null }, hoje: string): SituacaoDoEvento {
  const inicio = (e.tipo === "desafio" ? e.inicio : e.data) ?? hoje;
  const fim = (e.tipo === "desafio" ? e.fim : e.data) ?? hoje;
  if (hoje < inicio) {
    const n = diasEntreChaves(hoje, inicio).length - 1;
    return { fase: "breve", texto: n === 1 ? "Começa amanhã" : `Começa em ${n} dias` };
  }
  if (hoje > fim) return { fase: "fim", texto: "Encerrado" };
  if (e.tipo === "presencial") return { fase: "agora", texto: "É hoje" };
  const dias = diasEntreChaves(inicio, fim);
  return { fase: "agora", texto: `Dia ${dias.indexOf(hoje) + 1} de ${dias.length}` };
}
