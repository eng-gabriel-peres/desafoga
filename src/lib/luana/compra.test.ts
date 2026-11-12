import { describe, expect, it } from "vitest";
import { analisarCompra, blocoDeCompra, type PedidoDeCompra } from "./compra";
import type { Lancamento } from "./lancamentos";
import { type Conta, resumir } from "./resumo";

const HOJE = "2026-11-12";

const gasto = (valor: number, extra: Partial<Lancamento> = {}): Lancamento => ({
  data: HOJE,
  descricao: "x",
  valor,
  natureza: "compra",
  categoria: "outros",
  parcela: null,
  ...extra,
});

function analisar(pedido: Partial<PedidoDeCompra>, conta: Partial<Conta> = {}) {
  const completa: Conta = { lancamentos: [], rendaMensal: null, saldoEmConta: null, fatura: null, ...conta };
  return analisarCompra(
    { item: "moto", valorTotal: null, parcela: null, numeroDeParcelas: null, compromissosCitados: 0, ...pedido },
    completa,
    resumir(completa, HOJE),
  );
}

describe("analisarCompra", () => {
  it("usa as contas citadas quando são maiores que as anotadas", () => {
    const a = analisar(
      { valorTotal: 1800000, parcela: 65000, numeroDeParcelas: 36, compromissosCitados: 650000 },
      { rendaMensal: 800000, lancamentos: [gasto(100000)] },
    );
    expect(a).toMatchObject({
      veredito: "cabe",
      saidas: 650000,
      origemDasSaidas: "citadas",
      sobra: 150000,
      comprometimento: 8,
      sobraDepois: 85000,
      totalParcelado: 2340000,
      custoDoParcelamento: 540000,
    });
  });

  it("diz que não cabe quando a parcela passa da sobra", () => {
    const a = analisar({ parcela: 65000, compromissosCitados: 760000 }, { rendaMensal: 800000 });
    expect(a.veredito).toBe("nao_cabe");
    expect(a.sobraDepois).toBe(-25000);
  });

  it("diz que não cabe quando as contas já usam toda a renda", () => {
    expect(analisar({ parcela: 10000, compromissosCitados: 900000 }, { rendaMensal: 800000 }).veredito).toBe("nao_cabe");
  });

  it("manda quitar antes quando a pessoa já paga juros", () => {
    const a = analisar(
      { parcela: 30000 },
      { rendaMensal: 500000, lancamentos: [gasto(200000), gasto(18744, { natureza: "juros" })] },
    );
    expect(a.veredito).toBe("quite_antes");
    expect(a.encargosAtuais).toBe(18744);
  });

  it("avisa que fica apertado quando sobra menos de 10% da renda", () => {
    expect(analisar({ parcela: 70000, compromissosCitados: 300000 }, { rendaMensal: 400000 }).veredito).toBe("aperta");
  });

  it("estima a parcela sem juros quando só há preço e número de parcelas", () => {
    const a = analisar({ valorTotal: 1200000, numeroDeParcelas: 24 }, { rendaMensal: 600000 });
    expect(a.parcela).toBe(50000);
    expect(a.parcelaSemJuros).toBe(true);
    expect(a.totalParcelado).toBeNull();
  });

  it("calcula em quantos meses dá para juntar e comprar à vista", () => {
    const a = analisar({ valorTotal: 300000, compromissosCitados: 300000 }, { rendaMensal: 400000 });
    expect(a).toMatchObject({ veredito: "junte_antes", mesesParaJuntar: 3 });
  });

  it("usa as entradas do mês como renda quando ela não foi informada", () => {
    const a = analisar(
      { parcela: 20000 },
      { lancamentos: [gasto(295000, { natureza: "entrada" }), gasto(120000)] },
    );
    expect(a).toMatchObject({ renda: 295000, origemDaRenda: "entradas_do_mes", sobra: 175000 });
  });

  it("pede a renda quando não conhece nenhuma", () => {
    const a = analisar({ parcela: 20000 });
    expect(a.veredito).toBe("sem_dados");
    expect(blocoDeCompra(a)).toContain("quanto você ganha por mês");
  });
});

describe("blocoDeCompra", () => {
  it("mostra as contas e o custo do parcelamento", () => {
    const texto = blocoDeCompra(
      analisar(
        { valorTotal: 1800000, parcela: 65000, numeroDeParcelas: 36, compromissosCitados: 650000 },
        { rendaMensal: 800000 },
      ),
    );
    expect(texto).toContain("*Moto: cabe no seu mês*");
    expect(texto).toContain("• Sobra hoje: R$ 1.500,00");
    expect(texto).toContain("• Parcela: R$ 650,00 (8% da renda)");
    expect(texto).toContain("R$ 23.400,00 no total, R$ 5.400,00 a mais que o preço à vista");
  });
});
