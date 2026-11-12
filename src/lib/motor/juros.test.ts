import { describe, expect, it } from "vitest";
import {
  type Divida,
  jurosDoMes,
  jurosMensaisTotais,
  ordenarPorCusto,
  simularQuitacao,
} from "./juros";
import ana from "../../../fixtures/personas/ana.json";

const rotativo: Divida = {
  id: "a",
  nome: "Cartão",
  tipo: "cartao_rotativo",
  saldo: 100_000,
  taxaMensal: 0.14,
  pagamentoMinimo: 10_000,
};
const emprestimo: Divida = {
  id: "b",
  nome: "Empréstimo",
  tipo: "emprestimo",
  saldo: 200_000,
  taxaMensal: 0.02,
  pagamentoMinimo: 10_000,
};

describe("jurosDoMes", () => {
  it("calcula os juros de um mês em centavos", () => {
    expect(jurosDoMes(rotativo)).toBe(14_000);
    expect(jurosMensaisTotais([rotativo, emprestimo])).toBe(18_000);
  });
});

describe("ordenarPorCusto", () => {
  it("coloca a maior taxa primeiro sem alterar a lista original", () => {
    const lista = [emprestimo, rotativo];
    expect(ordenarPorCusto(lista).map((d) => d.id)).toEqual(["a", "b"]);
    expect(lista[0].id).toBe("b");
  });
});

describe("simularQuitacao", () => {
  it("quita uma dívida simples e soma os juros", () => {
    const divida: Divida = { ...rotativo, taxaMensal: 0.1 };
    const r = simularQuitacao([divida], 60_000);
    // mês 1: 100.000 + 10.000 - 60.000 = 50.000; mês 2: 50.000 + 5.000 - 55.000 = 0
    expect(r.quitavel).toBe(true);
    expect(r.meses).toBe(2);
    expect(r.jurosTotal).toBe(15_000);
    expect(r.totalPago).toBe(115_000);
  });

  it("manda a sobra para a dívida mais cara", () => {
    const r = simularQuitacao([emprestimo, rotativo], 50_000);
    // a: 114.000 - 10.000 - 30.000 de sobra; b: 204.000 - 10.000
    expect(r.cronograma[0].saldos).toEqual({ a: 74_000, b: 194_000 });
  });

  it("recusa orçamento abaixo dos mínimos", () => {
    expect(() => simularQuitacao([rotativo, emprestimo], 15_000)).toThrow();
  });

  it("marca como não quitável quando os juros superam o pagamento", () => {
    const r = simularQuitacao([rotativo], 10_000);
    expect(r.quitavel).toBe(false);
  });

  it("roda com a persona fictícia Ana", () => {
    const r = simularQuitacao(ana.dividas as Divida[], 90_000);
    expect(r.quitavel).toBe(true);
    expect(r.jurosTotal).toBeGreaterThan(0);
  });
});
