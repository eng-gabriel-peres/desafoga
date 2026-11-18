/** Conteúdos que os profissionais publicam (feed): tipos, temas, cores e regras simples. */

export type TipoDeConteudo = "dica" | "artigo" | "carrossel" | "enquete";
export type CorDaCapa = "azul" | "ambar" | "verde" | "violeta" | "rosa" | "petroleo";

export const TEMAS = ["Compras por impulso", "Orçamento", "Ansiedade e humor", "Família", "Hábitos"] as const;
export type Tema = (typeof TEMAS)[number];

export const TIPOS_DE_CONTEUDO: Record<TipoDeConteudo, { nome: string; descricao: string }> = {
  dica: { nome: "Dica rápida", descricao: "Uma frase curta e marcante, em destaque." },
  artigo: { nome: "Artigo", descricao: "Um texto para ler com calma, com título e parágrafos." },
  carrossel: { nome: "Carrossel", descricao: "Vários cartões para passar para o lado." },
  enquete: { nome: "Enquete", descricao: "Uma pergunta com opções para o pessoal votar." },
};

/** Gradiente da capa (as mesmas cores do protótipo; texto branco por cima). */
export const CORES_DA_CAPA: Record<CorDaCapa, [string, string]> = {
  azul: ["#1E3A8A", "#2350C8"],
  ambar: ["#7C2D12", "#C2410C"],
  verde: ["#14532D", "#17804F"],
  violeta: ["#4C1D95", "#6D28D9"],
  rosa: ["#831843", "#BE185D"],
  petroleo: ["#134E4A", "#0F766E"],
};

/** Parágrafos separados por uma linha em branco. */
export function paragrafos(texto: string): string[] {
  return texto
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function minutosDeLeitura(corpo: string[]): number {
  const palavras = corpo.join(" ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
}

export interface ResultadoDaEnquete {
  total: number;
  /** Opção em que quem está vendo votou. */
  meu: number | null;
  opcoes: { texto: string; votos: number; porcento: number }[];
}

export function resultadoDaEnquete(opcoes: string[], iniciais: number[], votos: { quem: string; opcao: number }[], quem: string | null): ResultadoDaEnquete {
  const contagem = opcoes.map((_, i) => (iniciais[i] ?? 0) + votos.filter((v) => v.opcao === i).length);
  const total = contagem.reduce((a, b) => a + b, 0);
  const meu = votos.find((v) => v.quem === quem)?.opcao ?? null;
  return {
    total,
    meu,
    opcoes: opcoes.map((texto, i) => ({ texto, votos: contagem[i], porcento: total ? Math.round((contagem[i] / total) * 100) : 0 })),
  };
}
