import { describe, expect, it } from "vitest";
import { faturaDaCompra, faturasDoCartao, previsaoDoDinheiro, saldoDaConta } from "./cartao";

const fecha25vence5 = { id: "nu", nome: "Nubank", fechamento: 25, vencimento: 5 };
const fecha3vence10 = { id: "it", nome: "Itaú", fechamento: 3, vencimento: 10 };

describe("em qual fatura cai a compra", () => {
  it("cartão que fecha dia 25 e vence dia 5: até o dia 25, vence no dia 5 do mês seguinte; depois, no outro", () => {
    expect(faturaDaCompra("2026-11-18", fecha25vence5)).toEqual({ fecha: "2026-11-25", vence: "2026-12-05" });
    // No dia do fechamento ainda entra; no dia seguinte já vai para a próxima (o "melhor dia de compra").
    expect(faturaDaCompra("2026-11-25", fecha25vence5)).toEqual({ fecha: "2026-11-25", vence: "2026-12-05" });
    expect(faturaDaCompra("2026-11-26", fecha25vence5)).toEqual({ fecha: "2026-12-25", vence: "2027-01-05" });
  });

  it("cartão que fecha dia 3 e vence dia 10: vence no mesmo mês do fechamento", () => {
    expect(faturaDaCompra("2026-11-02", fecha3vence10)).toEqual({ fecha: "2026-11-03", vence: "2026-11-10" });
    expect(faturaDaCompra("2026-11-18", fecha3vence10)).toEqual({ fecha: "2026-12-03", vence: "2026-12-10" });
  });

  it("dia 31 em mês curto vira o último dia", () => {
    expect(faturaDaCompra("2026-02-10", { fechamento: 31, vencimento: 8 })).toEqual({ fecha: "2026-02-28", vence: "2026-03-08" });
  });
});

describe("faturas do cartão", () => {
  it("agrupa por fechamento e espalha as parcelas pelas faturas seguintes", () => {
    const f = faturasDoCartao(fecha25vence5, [
      { id: "a", dia: "2026-11-10", valor: 10000 },
      { id: "b", dia: "2026-11-20", valor: 30000, parcelas: 3, valorDaParcela: 10000 },
      { id: "c", dia: "2026-11-28", valor: 5000 },
    ]);
    expect(f.map((x) => [x.vence, x.valor])).toEqual([
      ["2026-12-05", 20000],
      ["2027-01-05", 15000],
      ["2027-02-05", 10000],
    ]);
    expect(f[1].itens.find((i) => i.compraId === "b")?.parcela).toBe("2/3");
  });

  it("parcela sem valor informado: divide e o resto vai na primeira", () => {
    const f = faturasDoCartao(fecha25vence5, [{ id: "b", dia: "2026-11-20", valor: 10000, parcelas: 3 }]);
    expect(f.map((x) => x.valor)).toEqual([3334, 3333, 3333]);
  });
});

describe("saldo da conta (sem banco)", () => {
  it("saldo informado + renda nos dias de renda + entradas − saídas, só depois da data informada", () => {
    const r = saldoDaConta(
      {
        saldoInformado: 50000,
        desde: "2026-11-01",
        renda: { valor: 280000, dia: 5 },
        movimentos: [
          { dia: "2026-11-03", valor: -2000, descricao: "Padaria", tipo: "compra" },
          { dia: "2026-10-30", valor: -9999, descricao: "Antes do saldo", tipo: "compra" },
          { dia: "2026-11-10", valor: -20000, descricao: "Aluguel", tipo: "conta" },
          { dia: "2026-11-12", valor: 15000, descricao: "Pix do irmão", tipo: "entrada" },
          { dia: "2026-11-20", valor: -1000, descricao: "Amanhã", tipo: "compra" },
        ],
      },
      "2026-11-18",
    );
    expect(r.saldo).toBe(50000 - 2000 + 280000 - 20000 + 15000);
    expect(r.extrato.map((m) => m.descricao)).toEqual(["Pix do irmão", "Aluguel", "Renda", "Padaria"]);
  });
});

describe("previsão do dinheiro", () => {
  it("até o fim do mês e no mês que vem, com a renda que ainda entra e as faturas no mês em que vencem", () => {
    const p = previsaoDoDinheiro({
      hoje: "2026-11-18",
      saldo: 100000,
      renda: { valor: 280000, dia: 5 },
      aPagarEsteMes: 47290,
      compromissosDoMesQueVem: 181270,
      faturas: [
        { vence: "2026-11-25", valor: 30000 },
        { vence: "2026-12-05", valor: 20000 },
        { vence: "2027-01-05", valor: 15000 },
      ],
    });
    // Renda do dia 5 já entrou neste mês.
    expect(p.fimDoMes).toBe(100000 - 47290 - 30000);
    expect(p.mesQueVem).toBe(p.fimDoMes + 280000 - 181270 - 20000);
    expect(p.faturaDoMesQueVem).toBe(20000);
  });

  it("renda que ainda não caiu neste mês entra no fim do mês", () => {
    const p = previsaoDoDinheiro({ hoje: "2026-11-02", saldo: 1000, renda: { valor: 5000, dia: 5 }, aPagarEsteMes: 0, compromissosDoMesQueVem: 0, faturas: [] });
    expect(p.fimDoMes).toBe(6000);
  });
});
