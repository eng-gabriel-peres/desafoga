import { describe, expect, it } from "vitest";
import type { Compra } from "@/lib/finance";
import { chaveDaParcelada, compraManualCorrespondente, encontrarParcelada, mesDaPrimeira, novaParcelada, paresDeTransferencia } from "./relacionar";
import type { CandidataParcelada, CompraParcelada, Movimento } from "./tipos";

type MovPar = Pick<Movimento, "pluggyId" | "contaId" | "data" | "valor" | "direcao" | "natureza">;
const m = (pluggyId: string, contaId: string, data: string, valor: number, direcao: "saida" | "entrada", natureza: Movimento["natureza"] = "compra"): MovPar => ({
  pluggyId,
  contaId,
  data,
  valor,
  direcao,
  natureza: direcao === "entrada" && natureza === "compra" ? "outra-entrada" : natureza,
});

describe("paresDeTransferencia", () => {
  it("saída num banco e entrada do mesmo valor em outro no dia seguinte", () => {
    expect(paresDeTransferencia([m("a", "nubank", "2026-11-10", 20000, "saida"), m("b", "picpay", "2026-11-11", 20000, "entrada")]).sort()).toEqual(["a", "b"]);
  });

  it("com 4 dias de distância não é par", () => {
    expect(paresDeTransferencia([m("a", "nubank", "2026-11-10", 20000, "saida"), m("b", "picpay", "2026-11-14", 20000, "entrada")])).toEqual([]);
  });

  it("na mesma conta não é par", () => {
    expect(paresDeTransferencia([m("a", "nubank", "2026-11-10", 20000, "saida"), m("b", "nubank", "2026-11-10", 20000, "entrada")])).toEqual([]);
  });

  it("cada movimento entra em um par só", () => {
    const r = paresDeTransferencia([
      m("a", "nubank", "2026-11-10", 20000, "saida"),
      m("b", "picpay", "2026-11-10", 20000, "entrada"),
      m("c", "inter", "2026-11-10", 20000, "entrada"),
    ]);
    expect(r).toHaveLength(2);
  });

  it("não remarca o que já é transferência ou pagamento de fatura", () => {
    expect(paresDeTransferencia([m("a", "nubank", "2026-11-10", 20000, "saida", "pagamento-fatura"), m("b", "cartao", "2026-11-10", 20000, "entrada", "pagamento-fatura")])).toEqual([]);
  });
});

const cand = (extra: Partial<CandidataParcelada> = {}): CandidataParcelada => ({
  origem: "cartao-1",
  descricao: "MERCADOLIVRE*CELULAR 03/10",
  valorParcela: 48000,
  totalParcelas: 10,
  parcelaAtual: 3,
  mesDaParcela: "2026-11",
  valorTotal: null,
  compradaEm: null,
  ...extra,
});
const salva = (c: CandidataParcelada, id = "p1"): CompraParcelada => ({ ...novaParcelada(c, "Outro", "documento"), id });

describe("parceladas", () => {
  it("a parcela 3/10 em nov e a 4/10 em dez são a mesma compra", () => {
    const a = cand();
    const b = cand({ descricao: "MERCADO LIVRE CELULAR PARC 04/10", parcelaAtual: 4, mesDaParcela: "2026-12" });
    expect(mesDaPrimeira(a)).toBe("2026-09");
    expect(chaveDaParcelada(a)).toBe(chaveDaParcelada(b));
  });

  it("o mês vira o ano direito", () => {
    expect(mesDaPrimeira(cand({ parcelaAtual: 3, mesDaParcela: "2027-01" }))).toBe("2026-11");
  });

  it("encontra a mesma parcelada com 1 mês de diferença entre PDF e Pluggy", () => {
    const doPdf = salva(cand());
    const daPluggy = cand({ descricao: "MERCADOLIVRE*CELULAR", parcelaAtual: 4, mesDaParcela: "2027-01", valorTotal: 480000, compradaEm: "2026-10-02" });
    expect(encontrarParcelada([doPdf], daPluggy)?.id).toBe("p1");
  });

  it("não confunde com outro número de parcelas, outro valor ou outra origem", () => {
    const existente = salva(cand());
    expect(encontrarParcelada([existente], cand({ totalParcelas: 12 }))).toBeNull();
    expect(encontrarParcelada([existente], cand({ valorParcela: 50000 }))).toBeNull();
    expect(encontrarParcelada([existente], cand({ origem: "outro-cartao" }))).toBeNull();
    expect(encontrarParcelada([existente], cand({ parcelaAtual: 3, mesDaParcela: "2027-02" }))).toBeNull();
  });

  it("nova parcelada sem total nem data estima os dois", () => {
    const p = novaParcelada(cand(), "Outro", "documento");
    expect(p).toMatchObject({ valorTotal: 480000, mesDaPrimeira: "2026-09", compradaEm: "2026-09-01", compradaEmEstimada: true, parcelasVistas: [3], nome: "MERCADOLIVRE*CELULAR" });
  });

  it("com data e total do banco, usa os dois", () => {
    const p = novaParcelada(cand({ valorTotal: 479990, compradaEm: "2026-08-28" }), "Outro", "pluggy");
    expect(p).toMatchObject({ valorTotal: 479990, compradaEm: "2026-08-28", compradaEmEstimada: false });
  });
});

const compra = (id: string, valor: number, quando: string, via: Compra["via"] = "app"): Compra =>
  ({ id, item: "x", categoria: "Outro", valor, emocao: 3, necessidade: "sim", quando, via, avaliacaoProfissional: null }) as Compra;

describe("compraManualCorrespondente", () => {
  const almoco = compra("c1", 3500, "2026-11-10T12:30:00-03:00");

  it("casa valor e dia iguais", () => {
    expect(compraManualCorrespondente({ valor: 3500, data: "2026-11-10", parcelada: null }, [almoco], new Set(), 1)?.id).toBe("c1");
  });

  it("aceita até 50 centavos de diferença", () => {
    expect(compraManualCorrespondente({ valor: 3550, data: "2026-11-10", parcelada: null }, [almoco], new Set(), 1)?.id).toBe("c1");
    expect(compraManualCorrespondente({ valor: 3600, data: "2026-11-10", parcelada: null }, [almoco], new Set(), 1)).toBeNull();
  });

  it("dois dias depois só casa com folga de 3", () => {
    expect(compraManualCorrespondente({ valor: 3500, data: "2026-11-12", parcelada: null }, [almoco], new Set(), 1)).toBeNull();
    expect(compraManualCorrespondente({ valor: 3500, data: "2026-11-12", parcelada: null }, [almoco], new Set(), 3)?.id).toBe("c1");
  });

  it("compra já ligada ou que veio do banco nunca casa", () => {
    expect(compraManualCorrespondente({ valor: 3500, data: "2026-11-10", parcelada: null }, [almoco], new Set(["c1"]), 1)).toBeNull();
    const doBanco = compra("c2", 3500, "2026-11-10T12:30:00-03:00", "banco" as Compra["via"]);
    expect(compraManualCorrespondente({ valor: 3500, data: "2026-11-10", parcelada: null }, [doBanco], new Set(), 1)).toBeNull();
  });

  it("parcelada casa com a compra manual do valor total", () => {
    const iphone = compra("c3", 480000, "2026-09-02T18:00:00-03:00");
    const parcelada = { valorTotal: 480000, valorParcela: 48000, compradaEm: "2026-09-01" };
    expect(compraManualCorrespondente({ valor: 48000, data: "2026-11-10", parcelada }, [iphone], new Set(), 3)?.id).toBe("c3");
  });

  it("parcelada casa com a compra manual do valor da parcela", () => {
    const iphone = compra("c4", 48000, "2026-09-03T18:00:00-03:00");
    const parcelada = { valorTotal: 480000, valorParcela: 48000, compradaEm: "2026-09-01" };
    expect(compraManualCorrespondente({ valor: 48000, data: "2026-11-10", parcelada }, [iphone], new Set(), 3)?.id).toBe("c4");
  });
});
