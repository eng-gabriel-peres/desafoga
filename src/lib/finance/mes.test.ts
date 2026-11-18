import { describe, expect, it } from "vitest";
import { cabeNoMes, dinheiroDoMes, metaNoMes } from "./mes";
import type { Meta } from "./tipos";

const meta = (valorPorPeriodo: number, frequencia: Meta["frequencia"], extra: Partial<Meta> = {}) =>
  ({ id: "m", nome: "Viagem", alvo: 1_000_000, inicial: 0, valorPorPeriodo, frequencia, depositos: [], criadaEm: "2026-11-01", ...extra }) as Meta;

describe("dinheiro do mês", () => {
  it("meta no mês: por dia × 30, por semana × 52/12, por mês × 1", () => {
    expect(metaNoMes(meta(1000, "dia"))).toBe(30000);
    expect(metaNoMes(meta(12000, "semana"))).toBe(52000);
    expect(metaNoMes(meta(50000, "mes"))).toBe(50000);
  });

  it("renda − contas fixas − parcelas − metas = o que sobra para os orçamentos", () => {
    const d = dinheiroDoMes({ renda: 500000, contas: 180000, parcelas: 60000, metas: [meta(12000, "semana")], orcamentos: [{ categoria: "Mercado", limite: 100000 }] });
    expect(d).toEqual({ renda: 500000, contas: 180000, parcelas: 60000, metas: 52000, orcamentos: 100000, paraOrcamentos: 208000, sobra: 108000 });
  });

  it("orçamento de R$ 7 mil com renda de R$ 5 mil: sobra negativa", () => {
    const d = dinheiroDoMes({ renda: 500000, contas: 0, parcelas: 0, metas: [], orcamentos: [{ categoria: "Mercado", limite: 700000 }] });
    expect(d.sobra).toBe(-200000);
  });

  it("sem renda informada, não dá para conferir", () => {
    expect(dinheiroDoMes({ renda: null, contas: 1000, parcelas: 0, metas: [], orcamentos: [] })).toMatchObject({ paraOrcamentos: null, sobra: null });
  });

  it("cabe: o novo valor no lugar do antigo; diminuir sempre cabe; sem renda, cabe", () => {
    const d = dinheiroDoMes({ renda: 500000, contas: 300000, parcelas: 0, metas: [], orcamentos: [{ categoria: "Mercado", limite: 150000 }] });
    // Sobram 50 mil; o Mercado pode ir até 150 + 50 = 200 mil.
    expect(cabeNoMes(d, 150000, 200000)).toEqual({ cabe: true, ate: 200000 });
    expect(cabeNoMes(d, 150000, 200001)).toEqual({ cabe: false, ate: 200000 });
    const estourado = dinheiroDoMes({ renda: 500000, contas: 0, parcelas: 0, metas: [], orcamentos: [{ categoria: "Mercado", limite: 700000 }] });
    expect(cabeNoMes(estourado, 700000, 600000).cabe).toBe(true);
    expect(cabeNoMes(dinheiroDoMes({ renda: null, contas: 0, parcelas: 0, metas: [], orcamentos: [] }), 0, 9e9).cabe).toBe(true);
  });
});
