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
});
