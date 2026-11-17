import { describe, expect, it } from "vitest";
import { custoEmocional, encargosDasFaturas, fundirFaturas, separarFatura, type Fatura, type Lancamento } from "@/lib/finance";
import type { DocumentoLido } from "@/lib/luana/ler";
import { CONTRATO_DE_EXEMPLO, REGISTRATO_DE_EXEMPLO } from "@/fixtures/desafoga/documentos-de-exemplo";
import { paraFatura } from "./fatura-lida";
import { parceladasDoDocumento, parcelasDeEmprestimoNosExtratos, sugestaoDeRotativoDaFatura, sugestaoDoContrato, sugestoesDoRegistrato, tipoDaModalidade } from "./documentos";

const AGORA = new Date("2026-11-17T15:00:00-03:00");

const documento = (extra: Partial<DocumentoLido>): DocumentoLido => ({
  legivel: true,
  tipo: "fatura_cartao",
  emissor: "Nubank",
  vencimento: null,
  total: null,
  pagamentoMinimo: null,
  taxaRotativoMensal: null,
  saldoEmConta: null,
  dataBase: null,
  contratos: [],
  lancamentos: [],
  ...extra,
});

const contrato = (extra: Partial<DocumentoLido["contratos"][number]>): DocumentoLido["contratos"][number] => ({
  instituicao: "Itaú Unibanco",
  modalidade: "Empréstimo consignado",
  aVencer: null,
  vencido: null,
  saldoDevedor: null,
  valorParcela: null,
  parcelasPagas: null,
  parcelasRestantes: null,
  totalParcelas: null,
  taxaMensal: null,
  taxaAnual: null,
  cet: null,
  seguro: null,
  proximoVencimento: null,
  ...extra,
});

describe("fatura em PDF: números e parcelas", () => {
  const doc = documento({
    vencimento: "2026-12-10",
    total: "1.230,00",
    pagamentoMinimo: "184,50",
    taxaRotativoMensal: "14,9%",
    lancamentos: [
      { data: "2026-11-02", descricao: "MERCADOLIVRE*CELULAR", valor: "480,00", natureza: "compra", categoria: "compras", parcela: "03/10" },
      { data: "2026-11-05", descricao: "IFOOD", valor: "45,90", natureza: "compra", categoria: "alimentacao", parcela: null },
      { data: null, descricao: "JUROS ROTATIVO", valor: "120,00", natureza: "juros", categoria: "outros", parcela: null },
    ],
  });

  it("guarda vencimento, total, mínimo e juros do rotativo, e o mês é o do vencimento", () => {
    const f = paraFatura(doc, [], AGORA, "f1");
    expect(f).toMatchObject({ mes: "2026-12", vencimento: "2026-12-10", total: 123000, pagamentoMinimo: 18450, taxaRotativoMensal: 0.149, fonte: "documento" });
    expect(f.lancamentos[0]).toMatchObject({ parcela: 3, totalParcelas: 10, valor: 48000 });
    expect(f.lancamentos[1].parcela).toBeUndefined();
  });

  it("a parcela vira candidata de compra parcelada", () => {
    expect(parceladasDoDocumento(doc, "doc:nubank")).toEqual([
      { origem: "doc:nubank", descricao: "MERCADOLIVRE*CELULAR", valorParcela: 48000, totalParcelas: 10, parcelaAtual: 3, mesDaParcela: "2026-12", valorTotal: null, compradaEm: null },
    ]);
  });

  it("fatura com juros vira sugestão de rotativo com a taxa impressa", () => {
    const f = paraFatura(doc, [], AGORA, "f1");
    expect(sugestaoDeRotativoDaFatura(f)).toMatchObject({ tipo: "cartao", fonte: "fatura", saldo: 123000, taxaMensal: 0.149, parcelaMinima: 18450, vencimento: 10, instituicao: "Nubank" });
  });

  it("fatura sem juros não sugere rotativo", () => {
    const f = paraFatura(documento({ total: "100,00", lancamentos: [doc.lancamentos[1]] }), [], AGORA, "f2");
    expect(sugestaoDeRotativoDaFatura(f)).toBeNull();
  });
});

describe("Registrato", () => {
  it("cada linha vira uma sugestão, com o vencido em destaque e a taxa para conferir", () => {
    const s = sugestoesDoRegistrato(REGISTRATO_DE_EXEMPLO);
    expect(s).toHaveLength(3);
    expect(s.every((x) => x.fonte === "registrato" && x.confira.includes("taxaMensal"))).toBe(true);
    const nubank = s.find((x) => x.instituicao.toUpperCase().includes("NU"))!;
    expect(nubank).toMatchObject({ tipo: "cartao", vencido: 41000 });
    expect(nubank.saldo).toBe(123000 + 41000);
    expect(s.find((x) => x.tipo === "parcelamento")).toBeDefined();
  });

  it("nomes de banco legíveis e só pede parcelas do que é parcelado", () => {
    const s = sugestoesDoRegistrato(REGISTRATO_DE_EXEMPLO);
    const itau = s.find((x) => x.tipo === "emprestimo")!;
    expect(itau.nome).toBe("Consignado · Itaú");
    expect(itau.confira).toEqual(expect.arrayContaining(["parcelaMinima", "parcelasRestantes"]));
    const cartao = s.find((x) => x.tipo === "cartao")!;
    expect(cartao.nome).toBe("Cartão de crédito · Nubank");
    expect(cartao.confira).not.toContain("parcelasRestantes");
  });

  it("modalidades do SCR", () => {
    expect(tipoDaModalidade("Empréstimo - crédito pessoal consignado")).toEqual({ tipo: "emprestimo", detalhe: "Consignado" });
    expect(tipoDaModalidade("Cheque especial")).toMatchObject({ tipo: "cheque" });
    expect(tipoDaModalidade("Cartão de crédito - rotativo")).toMatchObject({ tipo: "cartao" });
    expect(tipoDaModalidade("Financiamento de veículos")).toMatchObject({ tipo: "parcelamento" });
    expect(tipoDaModalidade("Crédito pessoal sem consignação")).toMatchObject({ tipo: "emprestimo" });
  });

  it("duas linhas do mesmo banco e tipo não colidem na chave", () => {
    const doc = documento({
      tipo: "registrato",
      contratos: [contrato({ aVencer: "1.000,00" }), contrato({ aVencer: "2.000,00" })],
    });
    const s = sugestoesDoRegistrato(doc);
    expect(new Set(s.map((x) => x.chave)).size).toBe(2);
  });
});

describe("contrato ou print do empréstimo", () => {
  it("lê taxa, parcelas e seguro", () => {
    const doc = documento({
      tipo: "contrato_emprestimo",
      contratos: [contrato({ saldoDevedor: "7.100,00", valorParcela: "610,00", parcelasPagas: "24", totalParcelas: "36", taxaMensal: "1,99% a.m.", cet: "28,5% a.a.", seguro: true, proximoVencimento: "2026-12-07" })],
    });
    expect(sugestaoDoContrato(doc)).toMatchObject({ fonte: "contrato", saldo: 710000, parcelaMinima: 61000, parcelasRestantes: 12, taxaMensal: 0.0199, cet: 0.285, temSeguro: true, vencimento: 7, confira: [] });
  });

  it("taxa absurda fica para conferir", () => {
    const doc = documento({ tipo: "contrato_emprestimo", contratos: [contrato({ saldoDevedor: "7.100,00", valorParcela: "610,00", parcelasRestantes: "12", taxaMensal: "145%" })] });
    const s = sugestaoDoContrato(doc)!;
    expect(s.taxaMensal).toBeNull();
    expect(s.confira).toContain("taxaMensal");
  });

  it("taxa anual vira mensal", () => {
    const doc = documento({ tipo: "contrato_emprestimo", contratos: [contrato({ saldoDevedor: "7.100,00", valorParcela: "610,00", parcelasRestantes: "12", taxaAnual: "26,82%" })] });
    expect(sugestaoDoContrato(doc)!.taxaMensal).toBeCloseTo(0.02, 3);
  });

  it("o exemplo de contrato é lido", () => {
    expect(sugestaoDoContrato(CONTRATO_DE_EXEMPLO)).not.toBeNull();
  });
});

describe("parcela de empréstimo no extrato", () => {
  const extrato = (mes: string, parcela: string): Fatura => ({
    id: `e-${mes}`,
    tipo: "extrato",
    origem: "Itaú",
    mes,
    lancamentos: [
      { id: `l-${mes}-1`, data: `${mes}-07`, descricao: `PARC EMPREST ${parcela}`, valor: 61000, tipo: "parcela_emprestimo" },
      { id: `l-${mes}-2`, data: `${mes}-08`, descricao: "MERCADO", valor: 20000, tipo: "compra", categoria: "Mercado" },
    ],
  });
  const tres = [extrato("2026-09", "05/24"), extrato("2026-10", "06/24"), extrato("2026-11", "07/24")];

  it("três meses viram uma sugestão de dívida", () => {
    const s = parcelasDeEmprestimoNosExtratos(tres);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ fonte: "extrato", tipo: "emprestimo", parcelaMinima: 61000, parcelasRestantes: 17, vencimento: 7, instituicao: "Itaú" });
    expect(s[0].confira).toEqual(expect.arrayContaining(["saldo", "taxaMensal"]));
  });

  it("um mês só, sem PARC x/y, não basta", () => {
    const um: Fatura = { ...extrato("2026-11", ""), lancamentos: [{ id: "l", data: "2026-11-07", descricao: "CONSIGNADO INSS", valor: 61000, tipo: "parcela_emprestimo" }] };
    expect(parcelasDeEmprestimoNosExtratos([um])).toEqual([]);
  });

  it("um mês com PARC x/y já basta", () => {
    expect(parcelasDeEmprestimoNosExtratos([tres[2]])).toHaveLength(1);
  });

  it("nunca é compra nova nem custo emocional", () => {
    for (const f of tres) expect(separarFatura(f).novas.every((l: Lancamento) => l.tipo === "compra")).toBe(true);
    expect(separarFatura(tres[0]).novas.map((l) => l.descricao)).toEqual(["MERCADO"]);
  });

  it("o extrato lido marca a natureza como parcela de empréstimo", () => {
    const doc = documento({
      tipo: "extrato_conta",
      emissor: "Itaú",
      lancamentos: [{ data: "2026-11-07", descricao: "PARC EMPREST 07/24", valor: "610,00", natureza: "parcela_emprestimo", categoria: "outros", parcela: "07/24" }],
    });
    expect(paraFatura(doc, [], AGORA, "x").lancamentos[0].tipo).toBe("parcela_emprestimo");
  });
});

describe("fundirFaturas", () => {
  const pluggy: Fatura = {
    id: "p",
    tipo: "fatura",
    origem: "Nubank",
    mes: "2026-12",
    fonte: "pluggy",
    vencimento: "2026-12-10",
    total: 123000,
    pagamentoMinimo: null,
    taxaRotativoMensal: null,
    lancamentos: [{ id: "j1", data: "2026-11-20", descricao: "JUROS", valor: 12000, tipo: "juros" }],
  };
  const doPdf: Fatura = { ...pluggy, id: "d", fonte: "documento", pagamentoMinimo: 18450, taxaRotativoMensal: 0.149, total: 999999 };

  it("a da Pluggy vence; o PDF só completa o que falta e sai dos cálculos", () => {
    const r = fundirFaturas(pluggy, doPdf);
    expect(r.pluggy).toMatchObject({ total: 123000, pagamentoMinimo: 18450, taxaRotativoMensal: 0.149 });
    expect(r.doc.foraDosCalculos).toBe(true);
    expect(encargosDasFaturas([r.pluggy, r.doc]).juros).toBe(12000);
  });

  it("fatura fora dos cálculos não entra no custo emocional", () => {
    const fora: Fatura = { ...doPdf, foraDosCalculos: true, lancamentos: [...doPdf.lancamentos, { id: "c", data: "2026-11-21", descricao: "LOJA", valor: 50000, tipo: "compra" }] };
    expect(custoEmocional([fora], [])).toBeNull();
  });
});
