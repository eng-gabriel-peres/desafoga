import { describe, expect, it } from "vitest";
import type { Lancamento } from "./lancamentos";
import { montarPainel } from "./painel";
import type { Conta } from "./resumo";

const l = (data: string, descricao: string, valor: number, extra: Partial<Lancamento> = {}): Lancamento => ({
  data,
  descricao,
  valor,
  natureza: "compra",
  categoria: "alimentacao",
  parcela: null,
  ...extra,
});

const conta: Conta = {
  lancamentos: [
    l("2026-11-05", "SALARIO", 500000, { natureza: "entrada", categoria: "outros" }),
    l("2026-11-06", "IFOOD", 5000),
    l("2026-11-08", "ifood", 3000),
    l("2026-11-09", "RESTAURANTE", 7000),
    l("2026-11-10", "ALUGUEL", 150000, { categoria: "moradia_e_contas" }),
    l("2026-11-11", "TARIFA", 2490, { natureza: "tarifa_ou_multa", categoria: "outros" }),
    l("2026-11-12", "PAGAMENTO FATURA", 90000, { natureza: "pagamento_de_fatura", categoria: "outros" }),
    l("2026-10-20", "MERCADO", 40000, { categoria: "mercado" }),
  ],
  rendaMensal: null,
  saldoEmConta: null,
  fatura: null,
};

describe("montarPainel", () => {
  const painel = montarPainel(conta, "2026-11-12");

  it("traz um bloco por mês, do mais recente para o mais antigo", () => {
    expect(painel.meses.map((m) => m.referencia)).toEqual(["2026-11", "2026-10"]);
  });

  it("calcula entradas, gastos, encargos e sobra do mês", () => {
    expect(painel.meses[0]).toMatchObject({
      entradas: 500000,
      gastos: 165000,
      encargos: 2490,
      saldo: 332510,
      faturasPagas: 90000,
    });
  });

  it("deixa a sobra em branco quando o mês não tem entrada conhecida", () => {
    expect(painel.meses[1]).toMatchObject({ gastos: 40000, saldo: null });
  });

  it("abre cada categoria nos itens, somando descrições iguais", () => {
    const [moradia, alimentacao] = painel.meses[0].categorias;
    expect(moradia).toMatchObject({ categoria: "moradia_e_contas", total: 150000, percentual: 91 });
    expect(alimentacao.itens).toEqual([
      { descricao: "IFOOD", total: 8000, quantidade: 2 },
      { descricao: "RESTAURANTE", total: 7000, quantidade: 1 },
    ]);
  });

  it("limita a quantidade de meses", () => {
    expect(montarPainel(conta, "2026-11-12", 1).meses).toHaveLength(1);
  });

  it("lista os documentos do mais recente para o mais antigo", () => {
    const doc = { tipo: "extrato_conta", emissor: "Banco", lancamentos: 3, de: null, ate: null };
    const comDocs = montarPainel({
      ...conta,
      documentos: [
        { ...doc, recebidoEm: "2026-11-10" },
        { ...doc, recebidoEm: "2026-11-12" },
      ],
    }, "2026-11-12");
    expect(comDocs.documentos.map((d) => d.recebidoEm)).toEqual(["2026-11-12", "2026-11-10"]);
  });
});
