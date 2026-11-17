import { describe, expect, it } from "vitest";
import type { CompraParcelada, ContaBancaria } from "@/lib/banco/tipos";
import { cartoesDasFontes, proximosMeses, type CartaoNoMes } from "./proximos-meses";
import type { ContaFixa, Divida, Fatura } from "./tipos";

const AGORA = new Date(2026, 11, 2, 10); // 2 de dezembro de 2026

const aluguel: ContaFixa = { id: "a", nome: "Aluguel", categoria: "moradia", valor: 120000, vencimento: 10, variavel: false, debitoAutomatico: false, lembrete: false } as ContaFixa;

const parcelada = (origem: string, extra: Partial<CompraParcelada> = {}): CompraParcelada => ({
  id: "p1",
  chave: "k",
  origem,
  fonte: "documento",
  nome: "iPhone pessoal",
  lojaOriginal: "MERCADOLIVRE*CELULAR",
  categoria: "Outro",
  valorTotal: 480000,
  valorParcela: 48000,
  totalParcelas: 10,
  // 10 parcelas de set/2026 a jun/2027: em dez já foram 3 (set, out, nov), faltam 7 contando dez.
  mesDaPrimeira: "2026-09",
  compradaEm: "2026-09-01",
  compradaEmEstimada: true,
  compraId: null,
  parcelasVistas: [3],
  ...extra,
});

const cartao = (origem: string): CartaoNoMes => ({ origem, nome: "Nubank", vencimento: 10, faturaAberta: { mes: "2026-12", valor: 123000 } });
const plano = { valorMensal: 0, estrategia: "mais-cara" as const, valorSugerido: null };

describe("proximosMeses", () => {
  const meses = proximosMeses({ contas: [aluguel], dividas: [], plano, parceladas: [parcelada("doc:nubank")], cartoes: [cartao("doc:nubank")], renda: null }, AGORA);

  it("12 meses a partir do atual", () => {
    expect(meses).toHaveLength(12);
    expect(meses[0].mes).toBe("2026-12");
    expect(meses[11].mes).toBe("2027-11");
  });

  it("no mês da fatura aberta, o total real; a parcela não vira item à parte", () => {
    const dez = meses[0];
    expect(dez.itens).toContainEqual(expect.objectContaining({ tipo: "fatura", nome: "Nubank", valor: 123000, previsto: false }));
    expect(dez.itens.some((i) => i.nome === "iPhone pessoal")).toBe(false);
    expect(dez.total).toBe(120000 + 123000);
  });

  it("nos meses seguintes, a fatura prevista é a soma das parcelas conhecidas", () => {
    const jan = meses[1];
    expect(jan.itens).toContainEqual(expect.objectContaining({ tipo: "fatura", valor: 48000, previsto: true }));
  });

  it("marca o mês em que a parcelada termina e depois some", () => {
    const jun = meses.find((m) => m.mes === "2027-06")!;
    expect(jun.terminam).toContain("iPhone pessoal");
    const jul = meses.find((m) => m.mes === "2027-07")!;
    expect(jul.itens.some((i) => i.tipo === "fatura")).toBe(false);
  });

  it("com um cartão conectado como origem dá o mesmo resultado", () => {
    const outro = proximosMeses({ contas: [aluguel], dividas: [], plano, parceladas: [parcelada("conta-1")], cartoes: [cartao("conta-1")], renda: null }, AGORA);
    expect(outro.map((m) => m.total)).toEqual(meses.map((m) => m.total));
  });

  it("dívida do banco usa a parcela real pelo número de parcelas restantes", () => {
    const divida = { id: "d", tipo: "emprestimo", nome: "Consignado", detalhe: "", saldo: 120000, taxaMensal: 0.02, parcelaMinima: 61000, vencimento: 7, origem: "banco", parcelasRestantes: 2 } as Divida;
    const r = proximosMeses({ contas: [], dividas: [divida], plano, parceladas: [], cartoes: [], renda: null }, AGORA);
    expect(r[0].itens).toContainEqual(expect.objectContaining({ tipo: "divida", nome: "Consignado", valor: 61000 }));
    expect(r[1].itens).toContainEqual(expect.objectContaining({ valor: 61000 }));
    expect(r[1].terminam).toContain("Consignado");
    expect(r[2].itens).toHaveLength(0);
  });

  it("dívida manual segue o plano até quitar", () => {
    const divida = { id: "m", tipo: "cartao", nome: "Cartão", detalhe: "", saldo: 100000, taxaMensal: 0, parcelaMinima: 50000, vencimento: 10 } as Divida;
    const r = proximosMeses({ contas: [], dividas: [divida], plano, parceladas: [], cartoes: [], renda: null }, AGORA);
    expect(r[0].itens[0]).toMatchObject({ tipo: "divida", valor: 50000 });
    expect(r[1].itens[0]).toMatchObject({ valor: 50000 });
    expect(r[1].terminam).toContain("Cartão");
    expect(r[2].itens).toHaveLength(0);
  });

  it("renda e sobra", () => {
    const r = proximosMeses({ contas: [aluguel], dividas: [], plano, parceladas: [], cartoes: [], renda: { valor: 280000, dia: 5 } }, AGORA);
    expect(r[0]).toMatchObject({ renda: 280000, sobra: 160000 });
    expect(meses[0]).toMatchObject({ renda: null, sobra: null });
  });
});

describe("cartoesDasFontes", () => {
  const contaCartao: ContaBancaria = {
    id: "conta-1",
    conexaoId: "x",
    pluggyAccountId: "pa",
    tipo: "cartao",
    nome: "Mastercard Black",
    saldo: 100620,
    limite: 30000000,
    limiteDisponivel: 29899380,
    fechamento: "2026-12-03",
    vencimento: "2026-12-10",
    chequeEspecialUsado: null,
    chequeEspecialLimite: null,
  };
  const pdf: Fatura = { id: "f", tipo: "fatura", origem: "Nubank", mes: "2026-12", lancamentos: [], total: 123000, vencimento: "2026-12-10", fonte: "documento" };

  it("cartão conectado usa o saldo como fatura aberta", () => {
    expect(cartoesDasFontes([contaCartao], [])).toEqual([{ origem: "conta-1", nome: "Mastercard Black", vencimento: 10, faturaAberta: { mes: "2026-12", valor: 100620 } }]);
  });

  it("fatura em PDF sem cartão conectado vira cartão de documento", () => {
    expect(cartoesDasFontes([], [pdf])).toEqual([{ origem: "doc:nubank", nome: "Nubank", vencimento: 10, faturaAberta: { mes: "2026-12", valor: 123000 } }]);
  });

  it("PDF fora dos cálculos não conta", () => {
    expect(cartoesDasFontes([], [{ ...pdf, foraDosCalculos: true }])).toEqual([]);
  });

  it("a fatura da Pluggy do cartão manda no valor", () => {
    const daPluggy: Fatura = { ...pdf, id: "g", fonte: "pluggy", contaId: "conta-1", total: 110000 };
    expect(cartoesDasFontes([contaCartao], [daPluggy])[0].faturaAberta).toEqual({ mes: "2026-12", valor: 110000 });
  });
});
