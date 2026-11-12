import { describe, expect, it } from "vitest";
import { formatarReais, lerValorEmReais } from "./dinheiro";

describe("dinheiro", () => {
  it("formata centavos em reais", () => {
    expect(formatarReais(123456)).toBe("R$ 1.234,56");
  });

  it("lê valores escritos de vários jeitos", () => {
    expect(lerValorEmReais("900")).toBe(90000);
    expect(lerValorEmReais("pago R$ 1.200,50 por mês")).toBe(120050);
    expect(lerValorEmReais("350,5")).toBe(35050);
    expect(lerValorEmReais("não sei")).toBeNull();
  });

  it("entende valores ditos com mil", () => {
    expect(lerValorEmReais("8 mil")).toBe(800000);
    expect(lerValorEmReais("ganho 8mil por mês")).toBe(800000);
    expect(lerValorEmReais("1,5 mil")).toBe(150000);
    expect(lerValorEmReais("2k")).toBe(200000);
    expect(lerValorEmReais("8 mil e 500")).toBe(850000);
    expect(lerValorEmReais("R$ 8.000,00")).toBe(800000);
    expect(lerValorEmReais("650 de milhas")).toBe(65000);
  });
});
