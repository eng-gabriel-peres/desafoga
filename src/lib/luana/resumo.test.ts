import { describe, expect, it } from "vitest";
import { lerPercentual } from "@/lib/dinheiro";
import { acrescentar, converter, hojeEmBrasilia, type Lancamento, type LancamentoLido } from "./lancamentos";
import { type Conta, resumir } from "./resumo";
import { blocoDeEncargos, blocoDeHoje, blocoDoMes, dicas } from "./textos";

const HOJE = "2026-11-12";

const lido = (p: Partial<LancamentoLido>): LancamentoLido => ({
  data: HOJE,
  descricao: "x",
  valor: "10,00",
  natureza: "compra",
  categoria: "outros",
  parcela: null,
  ...p,
});

function conta(lancamentos: Lancamento[], extra: Partial<Conta> = {}): Conta {
  return { lancamentos, rendaMensal: null, saldoEmConta: null, fatura: null, ...extra };
}

const gastos = converter(
  [
    lido({ descricao: "MERCADO BOM PRECO", valor: "412,30", categoria: "mercado", data: "2026-11-03" }),
    lido({ descricao: "RESTAURANTE", valor: "80,00", categoria: "alimentacao" }),
    lido({ descricao: "IFOOD", valor: "45,50", categoria: "alimentacao" }),
    lido({ descricao: "STREAMING", valor: "39,90", categoria: "assinaturas", data: "2026-11-05" }),
    lido({ descricao: "ENCARGOS ROTATIVO", valor: "187,44", natureza: "juros", data: "2026-11-10" }),
    lido({ descricao: "IOF", valor: "9,12", natureza: "iof", data: "2026-11-10" }),
    lido({ descricao: "PAGAMENTO RECEBIDO", valor: "500,00", natureza: "pagamento_ou_credito" }),
    lido({ descricao: "SALDO ANTERIOR", valor: "1.355,10", natureza: "saldo_anterior" }),
    lido({ descricao: "COMPRA DE OUTUBRO", valor: "999,00", categoria: "compras", data: "2026-10-20" }),
  ],
  HOJE,
);

describe("converter e acrescentar", () => {
  it("converte valores, usa hoje quando falta data e descarta o que não tem valor", () => {
    const r = converter([lido({ valor: "R$ 1.234,56", data: null }), lido({ valor: "sem valor" })], HOJE);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ valor: 123456, data: HOJE });
  });

  it("não duplica quando a mesma fatura é enviada duas vezes", () => {
    const existentes: Lancamento[] = [];
    expect(acrescentar(existentes, gastos)).toHaveLength(gastos.length);
    expect(acrescentar(existentes, gastos)).toHaveLength(0);
    expect(existentes).toHaveLength(gastos.length);
  });

  it("calcula a data de hoje no fuso de Brasília", () => {
    // 02h UTC do dia 13 ainda é dia 12 em Brasília.
    expect(hojeEmBrasilia(new Date("2026-11-13T02:00:00Z"))).toBe("2026-11-12");
  });

  it("lê percentuais com vírgula, ponto e símbolo", () => {
    expect(lerPercentual("13,80")).toBeCloseTo(0.138);
    expect(lerPercentual("8.5%")).toBeCloseTo(0.085);
    expect(lerPercentual("sem taxa")).toBeNull();
    expect(lerPercentual("450")).toBeNull();
  });
});

describe("resumir", () => {
  const r = resumir(conta(gastos), HOJE);

  it("soma só compras, só do mês de referência", () => {
    expect(r.mes.referencia).toBe("2026-11");
    // 412,30 + 80,00 + 45,50 + 39,90
    expect(r.mes.total).toBe(57770);
    expect(r.mes.quantidade).toBe(4);
  });

  it("guarda o mês anterior para comparação", () => {
    expect(r.mesAnterior).toMatchObject({ referencia: "2026-10", total: 99900, quantidade: 1, encargos: 0 });
  });

  it("agrupa por categoria, da maior para a menor, com percentual", () => {
    expect(r.mes.porCategoria).toEqual([
      { categoria: "mercado", total: 41230, percentual: 71 },
      { categoria: "alimentacao", total: 12550, percentual: 22 },
      { categoria: "assinaturas", total: 3990, percentual: 7 },
    ]);
  });

  it("separa juros e IOF dos gastos", () => {
    expect(r.mes.encargos).toEqual({ juros: 18744, iof: 912, tarifas: 0, total: 19656 });
  });

  it("soma o dia de hoje à parte", () => {
    expect(r.hoje.total).toBe(12550);
    expect(r.hoje.quantidade).toBe(2);
  });

  it("sugere corte na maior categoria ajustável, não no mercado", () => {
    expect(r.corte).toEqual({ categoria: "alimentacao", total: 12550, economia: 2510 });
  });

  it("calcula a poupança quando a renda é conhecida", () => {
    const comRenda = resumir(conta(gastos, { rendaMensal: 400000 }), HOJE);
    // meta 20% = 800,00; sobra = 4.000,00 - 577,70 - 196,56
    expect(comRenda.poupanca).toEqual({ meta: 80000, tetoDeGastos: 320000, sobraDoMes: 322574 });
    expect(r.poupanca).toBeNull();
  });

  it("estima os juros se só o mínimo da fatura for pago", () => {
    const fatura = {
      emissor: "Banco",
      vencimento: null,
      total: 234076,
      pagamentoMinimo: 35111,
      taxaRotativoMensal: 0.138,
    };
    // (2.340,76 - 351,11) x 13,8% = 274,57
    expect(resumir(conta(gastos, { fatura }), HOJE).jurosSePagarSoOMinimo).toBe(27457);
    expect(r.jurosSePagarSoOMinimo).toBeNull();
  });

  it("não quebra sem lançamentos", () => {
    const vazio = resumir(conta([]), HOJE);
    expect(vazio.mes.total).toBe(0);
    expect(vazio.corte).toBeNull();
    expect(blocoDeHoje(vazio)).toContain("ainda não anotei");
  });
});

describe("textos", () => {
  const r = resumir(conta(gastos), HOJE);

  it("monta os blocos com os valores formatados", () => {
    expect(blocoDoMes(r)).toContain("*Gastos de novembro de 2026: R$ 577,70*");
    expect(blocoDoMes(r)).toContain("• Mercado: R$ 412,30 (71%)");
    expect(blocoDeEncargos(r)).toContain("• IOF: R$ 9,12");
    expect(blocoDeHoje(r)).toContain("*Hoje (12/11): R$ 125,50*");
  });

  it("gera dicas a partir dos números e pede a renda quando falta", () => {
    const lista = dicas(r);
    expect(lista[0]).toContain("R$ 196,56 só de juros, IOF e tarifas");
    expect(lista.some((d) => d.includes("Cortar 20% guarda R$ 25,10"))).toBe(true);
    expect(lista.at(-1)).toContain("Me diga sua renda mensal");
  });
});
