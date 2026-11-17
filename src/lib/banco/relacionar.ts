/**
 * Liga movimentos entre si e com o que a pessoa já registrou:
 * - transferência entre as próprias contas (saída num banco, entrada no outro);
 * - parcelas da mesma compra parcelada, venham da Pluggy ou de um PDF;
 * - compra registrada à mão que é a mesma do banco.
 */
import type { Categoria, Compra } from "@/lib/finance";
import { chaveDaDescricao } from "./classificar";
import { diaEmBrasilia } from "./normalizar";
import type { CandidataParcelada, CompraParcelada, Movimento } from "./tipos";

const DIA = 86_400_000;
const diasEntre = (a: string, b: string) => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DIA;

/** Naturezas que um par de transferência pode remarcar (as outras já foram decididas). */
const REMARCAVEL = new Set<Movimento["natureza"]>(["compra", "outra-saida", "outra-entrada", "renda"]);

export function paresDeTransferencia(movs: Pick<Movimento, "pluggyId" | "contaId" | "data" | "valor" | "direcao" | "natureza">[]): string[] {
  const candidatos = movs.filter((m) => REMARCAVEL.has(m.natureza));
  const saidas = candidatos.filter((m) => m.direcao === "saida");
  const entradas = candidatos.filter((m) => m.direcao === "entrada");
  const usados = new Set<string>();
  for (const s of saidas) {
    const par = entradas
      .filter((e) => !usados.has(e.pluggyId) && e.contaId !== s.contaId && e.valor === s.valor && diasEntre(e.data, s.data) <= 2)
      .sort((a, b) => diasEntre(a.data, s.data) - diasEntre(b.data, s.data))[0];
    if (par) {
      usados.add(s.pluggyId);
      usados.add(par.pluggyId);
    }
  }
  return [...usados];
}

function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
const mesesEntre = (a: string, b: string) => {
  const [aa, am] = a.split("-").map(Number);
  const [ba, bm] = b.split("-").map(Number);
  return Math.abs(aa * 12 + am - (ba * 12 + bm));
};

export function mesDaPrimeira(c: CandidataParcelada): string {
  return somarMeses(c.mesDaParcela, -(c.parcelaAtual - 1));
}

export function chaveDaParcelada(c: CandidataParcelada): string {
  return `${c.origem}|${chaveDaDescricao(c.descricao)}|${c.totalParcelas}|${c.valorParcela}|${mesDaPrimeira(c)}`;
}

export function encontrarParcelada(existentes: CompraParcelada[], c: CandidataParcelada): CompraParcelada | null {
  const loja = chaveDaDescricao(c.descricao);
  const primeira = mesDaPrimeira(c);
  return (
    existentes.find(
      (p) =>
        p.origem === c.origem &&
        chaveDaDescricao(p.lojaOriginal) === loja &&
        p.totalParcelas === c.totalParcelas &&
        Math.abs(p.valorParcela - c.valorParcela) <= 5 &&
        mesesEntre(p.mesDaPrimeira, primeira) <= 1,
    ) ?? null
  );
}

/** Nome legível: a descrição sem o marcador de parcela. */
const semParcela = (d: string) =>
  d
    .replace(/\s*\bPARC(ELA)?\.?\s*\d{1,3}\s*(\/|DE)\s*\d{1,3}\b/gi, "")
    .replace(/\s*\b\d{1,3}\s*\/\s*\d{1,3}\b/g, "")
    .trim();

export function novaParcelada(c: CandidataParcelada, categoria: Categoria, fonte: "pluggy" | "documento"): Omit<CompraParcelada, "id"> {
  const primeira = mesDaPrimeira(c);
  const loja = semParcela(c.descricao);
  return {
    chave: chaveDaParcelada(c),
    origem: c.origem,
    fonte,
    nome: loja,
    lojaOriginal: loja,
    categoria,
    valorTotal: c.valorTotal ?? c.valorParcela * c.totalParcelas,
    valorParcela: c.valorParcela,
    totalParcelas: c.totalParcelas,
    mesDaPrimeira: primeira,
    compradaEm: c.compradaEm ?? `${primeira}-01`,
    compradaEmEstimada: !c.compradaEm,
    compraId: null,
    parcelasVistas: [c.parcelaAtual],
  };
}

/** Compras que podem ser a mesma do banco: registradas à mão, pela fatura em PDF ou pelo próprio banco (ainda sem movimento ligado). */
const REGISTRAVEIS = new Set<Compra["via"]>(["app", "whatsapp", "fatura", "banco"]);

export function compraManualCorrespondente(
  alvo: { valor: number; data: string; parcelada: { valorTotal: number; valorParcela: number; compradaEm: string } | null },
  compras: Compra[],
  jaLigadas: Set<string>,
  folgaEmDias: 1 | 3,
): Compra | null {
  const livres = compras.filter((c) => REGISTRAVEIS.has(c.via) && !jaLigadas.has(c.id));
  const p = alvo.parcelada;
  if (p) {
    return (
      livres.find(
        (c) =>
          diasEntre(diaEmBrasilia(c.quando), p.compradaEm) <= 3 &&
          (Math.abs(c.valor - p.valorTotal) <= p.valorTotal * 0.01 || Math.abs(c.valor - p.valorParcela) <= 50),
      ) ?? null
    );
  }
  return livres.find((c) => Math.abs(c.valor - alvo.valor) <= 50 && diasEntre(diaEmBrasilia(c.quando), alvo.data) <= folgaEmDias) ?? null;
}
