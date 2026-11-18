import { describe, expect, it } from "vitest";
import { comprasParaAvaliar, opinioesDiferentes } from "./avaliacao";
import type { Compra } from "./tipos";

const HOJE = new Date(2026, 10, 18, 15, 0);
let n = 0;
function compra(diasAtras: number, necessidade: Compra["necessidade"], avaliacao: Compra["avaliacaoProfissional"]): Compra {
  const d = new Date(HOJE);
  d.setDate(d.getDate() - diasAtras);
  return { id: `c${n++}`, item: "x", categoria: "Outro", valor: 1000, emocao: 3, necessidade, quando: d.toISOString(), via: "app", avaliacaoProfissional: avaliacao } as Compra;
}

describe("avaliação das compras pelo profissional", () => {
  it("opiniões diferentes: avaliou e discorda, ou a pessoa não soube (ou não respondeu)", () => {
    expect(opinioesDiferentes(compra(0, "sim", null))).toBe(false);
    expect(opinioesDiferentes(compra(0, "sim", "sim"))).toBe(false);
    expect(opinioesDiferentes(compra(0, "sim", "nao"))).toBe(true);
    expect(opinioesDiferentes(compra(0, "talvez", "sim"))).toBe(true);
    expect(opinioesDiferentes(compra(0, null, "nao"))).toBe(true);
  });

  it("últimos 14 dias, da mais nova para a mais antiga, com os filtros e as contagens", () => {
    const l = [compra(20, "sim", null), compra(3, "sim", "nao"), compra(1, "nao", null), compra(2, "sim", "sim")];
    const todas = comprasParaAvaliar(l, HOJE, "todas");
    expect(todas.lista.map((c) => c.id)).toEqual([l[2].id, l[3].id, l[1].id]);
    expect(todas.contagem).toEqual({ todas: 3, pendentes: 1, diferentes: 1 });
    expect(comprasParaAvaliar(l, HOJE, "pendentes").lista.map((c) => c.id)).toEqual([l[2].id]);
    expect(comprasParaAvaliar(l, HOJE, "diferentes").lista.map((c) => c.id)).toEqual([l[1].id]);
  });
});
