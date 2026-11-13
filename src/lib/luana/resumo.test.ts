import { describe, expect, it } from "vitest";
import { lerPercentual } from "@/lib/dinheiro";
import { acrescentar, anotar, converter, hojeEmBrasilia, type Lancamento, type LancamentoLido } from "./lancamentos";
import { type Conta, resumir } from "./resumo";
import { avisoDeOutroMes, blocoDeEncargos, blocoDeEntradasESaidas, blocoDeHoje, blocoDePoupanca, blocoDoMes, dicas } from "./textos";

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

  it("não duplica quando o mesmo arquivo é lido com descrições diferentes", () => {
    const primeira = converter([lido({ descricao: "PIX ENVIADO JOAO", valor: "100,00" })], HOJE, "Nubank");
    const segunda = converter([lido({ descricao: "Pix enviado - João S.", valor: "100,00" })], HOJE, "Nu Pagamentos S.A.");
    const existentes: Lancamento[] = [];
    expect(acrescentar(existentes, primeira)).toHaveLength(1);
    expect(acrescentar(existentes, segunda)).toHaveLength(0);
    expect(existentes).toHaveLength(1);
  });

  it("mantém dois lançamentos iguais do mesmo documento e não os soma de novo no reenvio", () => {
    const doisCafes = () => converter([lido({ descricao: "CAFE", valor: "8,00" }), lido({ descricao: "CAFE", valor: "8,00" })], HOJE);
    const existentes: Lancamento[] = [];
    expect(acrescentar(existentes, doisCafes())).toHaveLength(2);
    expect(acrescentar(existentes, doisCafes())).toHaveLength(0);
    const tres = [...doisCafes(), ...converter([lido({ descricao: "CAFE", valor: "8,00" })], HOJE)];
    expect(acrescentar(existentes, tres)).toHaveLength(1);
    expect(existentes).toHaveLength(3);
  });

  it("não confunde entrada com saída de mesmo valor no mesmo dia", () => {
    const existentes = converter([lido({ descricao: "PIX RECEBIDO", valor: "50,00", natureza: "entrada" })], HOJE);
    expect(acrescentar(existentes, converter([lido({ descricao: "PIX ENVIADO", valor: "50,00" })], HOJE))).toHaveLength(1);
  });

  it("anota o mesmo gasto escrito duas vezes no mesmo dia", () => {
    const cafe: Lancamento = {
      data: "2026-11-12",
      descricao: "Café",
      valor: 800,
      natureza: "compra",
      categoria: "alimentacao",
      parcela: null,
    };
    const existentes: Lancamento[] = [];
    expect(anotar(existentes, [cafe])).toHaveLength(1);
    expect(anotar(existentes, [{ ...cafe }])).toHaveLength(1);
    expect(existentes).toHaveLength(2);
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
    expect(comRenda.poupanca).toEqual({
      base: "renda_informada",
      comPrevisao: false,
      renda: 400000,
      meta: 80000,
      tetoDeGastos: 320000,
      sobraDoMes: 322574,
    });
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

describe("extrato de conta", () => {
  const BANCO = "Banco Exemplo";
  const extrato = converter(
    [
      lido({ descricao: "SALARIO", valor: "2.800,00", natureza: "entrada", data: "2026-11-05" }),
      lido({ descricao: "PIX RECEBIDO", valor: "150,00", natureza: "entrada", data: "2026-11-09" }),
      lido({ descricao: "ALUGUEL", valor: "950,00", categoria: "moradia_e_contas", data: "2026-11-06" }),
      lido({ descricao: "MERCADO", valor: "212,40", categoria: "mercado", data: "2026-11-08" }),
      lido({ descricao: "PIX ENVIADO", valor: "80,00", categoria: "transferencias", data: "2026-11-11" }),
      lido({ descricao: "TARIFA", valor: "24,90", natureza: "tarifa_ou_multa", data: "2026-11-11" }),
      lido({ descricao: "PAGAMENTO FATURA", valor: "351,11", natureza: "pagamento_de_fatura", data: "2026-11-07" }),
      lido({ descricao: "APLICACAO", valor: "200,00", natureza: "transferencia_propria", data: "2026-11-10" }),
    ],
    HOJE,
    BANCO,
  );
  const r = resumir(conta(extrato), HOJE);

  it("soma entradas e saídas e calcula o que sobrou", () => {
    expect(r.mes.entradas.total).toBe(295000);
    expect(r.mes.total).toBe(124240);
    expect(r.mes.saidas).toBe(126730);
    expect(r.mes.saldo).toBe(168270);
  });

  it("não conta pagamento de fatura nem movimentação entre contas próprias como gasto", () => {
    expect(r.mes.faturasPagas).toBe(35111);
    expect(r.mes.maiores.map((l) => l.descricao)).toEqual(["ALUGUEL", "MERCADO", "PIX ENVIADO"]);
  });

  it("usa as entradas como renda quando a pessoa não informou a renda", () => {
    expect(r.poupanca).toMatchObject({ base: "entradas_do_mes", renda: 295000, meta: 59000, sobraDoMes: 168270 });
    expect(blocoDePoupanca(r)).toContain("Usando como renda o que entrou no mês (R$ 2.950,00)");
  });

  it("separa por banco quando há mais de um", () => {
    const outro = converter(
      [lido({ descricao: "IFOOD", valor: "50,00", categoria: "alimentacao", data: "2026-11-10" })],
      HOJE,
      "Banco Dois",
    );
    const dois = resumir(conta([...extrato, ...outro]), HOJE);
    expect(r.mes.porOrigem).toEqual([]);
    expect(dois.mes.porOrigem).toEqual([
      { origem: BANCO, entradas: 295000, saidas: 126730 },
      { origem: "Banco Dois", entradas: 0, saidas: 5000 },
    ]);
  });

  it("monta o bloco de entradas e saídas, e não mostra nada sem entradas", () => {
    const bloco = blocoDeEntradasESaidas(r);
    expect(bloco).toContain("• Entrou: R$ 2.950,00");
    expect(bloco).toContain("• *Sobrou: R$ 1.682,70*");
    expect(bloco).toContain("Fatura de cartão paga pela conta: R$ 351,11");
    expect(blocoDeEntradasESaidas(resumir(conta(gastos), HOJE))).toBeNull();
  });

  it("avisa quando o arquivo é de um mês anterior ao do resumo", () => {
    const outubro = converter(
      [lido({ descricao: "LOJA", valor: "98,00", categoria: "compras", data: "2026-10-20" })],
      HOJE,
    );
    const tudo = resumir(conta([...extrato, ...outubro]), HOJE);
    expect(avisoDeOutroMes(outubro, tudo)).toContain("Esse arquivo é de outubro de 2026: R$ 98,00 em gastos");
    expect(avisoDeOutroMes(extrato, tudo)).toBeNull();
  });

  it("avisa quando saiu mais do que entrou", () => {
    const apertado = converter(
      [
        lido({ descricao: "PIX RECEBIDO", valor: "100,00", natureza: "entrada" }),
        lido({ descricao: "MERCADO", valor: "130,00", categoria: "mercado" }),
      ],
      HOJE,
    );
    expect(blocoDeEntradasESaidas(resumir(conta(apertado), HOJE))).toContain("• *Faltou: R$ 30,00*");
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
