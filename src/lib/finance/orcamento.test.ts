import { describe, expect, it } from "vitest";
import { explicarOrcamento } from "@/lib/assistente/textos";
import { diasAteOFimDoMes, gastoDoMes, orcamentoDoMes, situacaoDoOrcamento } from "./orcamento";
import type { Compra } from "./tipos";

const compra = (valor: number, quando: string, categoria: Compra["categoria"] = "Mercado"): Compra => ({
  id: quando + valor,
  item: "x",
  categoria,
  valor,
  emocao: 3,
  necessidade: "sim",
  quando,
  via: "app",
  avaliacaoProfissional: null,
});

// 16 de novembro: faltam 15 dias contando hoje (novembro tem 30).
const agora = new Date(2026, 10, 16, 10);

describe("orçamento por categoria", () => {
  it("conta os dias até o fim do mês, com hoje", () => {
    expect(diasAteOFimDoMes(agora)).toBe(15);
    expect(diasAteOFimDoMes(new Date(2026, 10, 30, 22))).toBe(1);
    expect(diasAteOFimDoMes(new Date(2028, 1, 1))).toBe(29);
  });

  it("soma só o mês atual e a categoria pedida", () => {
    const compras = [
      compra(30000, new Date(2026, 10, 2).toISOString()),
      compra(18000, new Date(2026, 10, 15).toISOString()),
      compra(9999, new Date(2026, 9, 31).toISOString()),
      compra(5000, new Date(2026, 10, 10).toISOString(), "Roupa"),
    ];
    expect(gastoDoMes(compras, "Mercado", agora)).toBe(48000);
  });

  it("o exemplo: R$ 600 de limite, R$ 480 gastos", () => {
    const s = situacaoDoOrcamento({ categoria: "Mercado", limite: 60000 }, 48000, agora);
    expect(s).toMatchObject({ usado: 0.8, restante: 12000, diasRestantes: 15, porDia: 800, estado: "atencao" });
    expect(explicarOrcamento(s)).toBe(
      "Você já utilizou 80% do seu orçamento de mercado. Restam R$ 120 até o final do mês. Considerando os dias restantes, seu limite diário recomendado é de R$ 8.",
    );
  });

  it("quando passa do limite, diz quanto passou sem culpa", () => {
    const s = situacaoDoOrcamento({ categoria: "Roupa", limite: 20000 }, 25000, agora);
    expect(s).toMatchObject({ restante: 0, passou: 5000, porDia: 0, estado: "estourou" });
    expect(explicarOrcamento(s)).toContain("Você passou R$ 50 do seu orçamento de roupa");
  });

  it("no último dia do mês, não fala de limite diário", () => {
    const s = situacaoDoOrcamento({ categoria: "Lazer", limite: 10000 }, 1000, new Date(2026, 10, 30, 9));
    expect(explicarOrcamento(s)).toContain("Hoje é o último dia do mês.");
  });

  it("lista do mais usado para o menos usado e ignora limite zero", () => {
    const compras = [compra(9000, agora.toISOString(), "Lazer"), compra(1000, agora.toISOString())];
    const lista = orcamentoDoMes(
      [
        { categoria: "Mercado", limite: 60000 },
        { categoria: "Lazer", limite: 10000 },
        { categoria: "Roupa", limite: 0 },
      ],
      compras,
      agora,
    );
    expect(lista.map((s) => s.categoria)).toEqual(["Lazer", "Mercado"]);
  });
});

