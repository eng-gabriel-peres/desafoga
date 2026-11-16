import { describe, expect, it } from "vitest";
import { custoEmocional, encargosDasFaturas, separarFatura } from "./fatura";
import type { Compra, Fatura, Lancamento } from "./tipos";

const L = (id: string, tipo: Lancamento["tipo"], valor: number, compraId: string | null = null): Lancamento => ({
  id,
  data: "2026-11-10",
  descricao: id.toUpperCase(),
  valor,
  tipo,
  compraId,
});

const compra = (id: string, emocao: Compra["emocao"], necessidade: Compra["necessidade"]): Compra => ({
  id,
  item: id,
  categoria: "Outro",
  valor: 0,
  emocao,
  necessidade,
  quando: "2026-11-10T22:00:00.000Z",
  via: "app",
  avaliacaoProfissional: null,
});

const fatura: Fatura = {
  id: "f1",
  tipo: "fatura",
  origem: "Cartão final 4417",
  mes: "2026-11",
  lancamentos: [
    L("roupa", "compra", 30000, "c-roupa"),
    L("mercado", "compra", 50000, "c-mercado"),
    L("fone", "compra", 20000, null),
    L("rotativo", "juros", 18000),
    L("iof", "iof", 2000),
    L("anuidade", "tarifa", 3200),
    L("streaming", "assinatura", 3990),
    L("pagamento", "pagamento", 90000),
  ],
};

const compras = [compra("c-roupa", 1, "nao"), compra("c-mercado", 3, "sim")];

describe("encargos das faturas", () => {
  it("separa juros, IOF e tarifas e soma o total", () => {
    expect(encargosDasFaturas([fatura])).toEqual({ juros: 18000, iof: 2000, tarifas: 3200, total: 23200 });
  });

  it("soma várias faturas e zera sem faturas", () => {
    expect(encargosDasFaturas([fatura, fatura]).total).toBe(46400);
    expect(encargosDasFaturas([]).total).toBe(0);
  });
});

describe("custo emocional", () => {
  it("divide juros e IOF do cartão na proporção das compras tristes", () => {
    const c = custoEmocional([fatura], compras);
    // compras: 100000; tristes (emoção 1 ou 2): 30000 = 30%; juros + IOF = 20000
    expect(c).toEqual({
      encargos: 20000,
      totalCompras: 100000,
      parteTriste: 0.3,
      parteNaoNecessaria: 0.3,
      custoTriste: 6000,
      custoNaoNecessaria: 6000,
    });
  });

  it("ignora extratos e é null sem compras ou sem juros", () => {
    expect(custoEmocional([{ ...fatura, tipo: "extrato" }], compras)).toBeNull();
    const semJuros = { ...fatura, lancamentos: fatura.lancamentos.filter((l) => l.tipo === "compra") };
    expect(custoEmocional([semJuros], compras)).toBeNull();
  });
});

describe("separar a fatura lida", () => {
  it("separa encargos, compras já registradas, compras novas e assinaturas", () => {
    const s = separarFatura(fatura);
    expect(s.encargos.map((l) => l.id)).toEqual(["rotativo", "iof", "anuidade"]);
    expect(s.jaRegistradas.map((l) => l.id)).toEqual(["roupa", "mercado"]);
    expect(s.novas.map((l) => l.id)).toEqual(["fone"]);
    expect(s.assinaturas.map((l) => l.id)).toEqual(["streaming"]);
    expect(s.totalEncargos).toBe(23200);
  });
});
