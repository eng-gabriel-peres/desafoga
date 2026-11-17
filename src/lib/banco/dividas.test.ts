import { describe, expect, it } from "vitest";
import { dadosDoSandbox } from "./cliente-falso";
import { aplicarTravas, chaveDaDivida, encontrarDivida, fundirDivida, sugestaoDoChequeEspecial, sugestaoDoEmprestimo, taxaMensalDe, TRAVAS } from "./dividas";
import { chaveDaInstituicao } from "./instituicoes";
import type { PluggyEmprestimo } from "./pluggy";
import type { ContaBancaria, SugestaoDeDivida } from "./tipos";

const consignado = dadosDoSandbox().emprestimos[0];

const sugestao = (extra: Partial<SugestaoDeDivida> = {}): SugestaoDeDivida => ({
  chave: "itau|emprestimo",
  fonte: "registrato",
  pluggyLoanId: null,
  tipo: "emprestimo",
  nome: "Empréstimo Itaú",
  instituicao: "ITAU UNIBANCO",
  detalhe: "Consignado",
  saldo: 1850000,
  vencido: null,
  taxaMensal: null,
  parcelaMinima: 0,
  vencimento: null,
  parcelasRestantes: null,
  cet: null,
  temSeguro: null,
  faltaPagarComJuros: null,
  confira: ["taxaMensal", "parcelaMinima", "parcelasRestantes"],
  ...extra,
});

describe("taxas", () => {
  it("anual vira mensal composta", () => {
    expect(taxaMensalDe({ valor: 0.6, periodicidade: "YEARLY" })).toBeCloseTo(0.03994, 5);
    expect(taxaMensalDe({ valor: 0.05, periodicidade: "MONTHLY" })).toBe(0.05);
  });
});

describe("sugestaoDoEmprestimo (consignado do sandbox)", () => {
  const s = sugestaoDoEmprestimo(consignado, "Pluggy Bank")!;

  it("traz parcela, seguro, CET e o quanto falta com juros", () => {
    expect(s).toMatchObject({
      fonte: "pluggy",
      pluggyLoanId: consignado.id,
      tipo: "emprestimo",
      detalhe: "Crédito Pessoal Consignado",
      parcelaMinima: 100004,
      temSeguro: true,
      cet: 0.29,
      faltaPagarComJuros: 2850004,
      vencimento: 15,
    });
    expect(s.taxaMensal).toBeCloseTo(0.03994, 5);
  });

  it("ignora os números de parcelas absurdos do sandbox", () => {
    expect(s.parcelasRestantes).not.toBeNull();
    expect(s.parcelasRestantes).toBeLessThanOrEqual(TRAVAS.parcelasMax);
    expect([14600, 130632, 57]).not.toContain(s.parcelasRestantes);
  });

  it("saldo sem juros futuros: nem o saldo incoerente (≤ parcela) nem o total com juros", () => {
    expect(s.saldo).toBeGreaterThan(100004);
    expect(s.saldo).toBeLessThan(2850004);
  });

  it("taxa mensal informada é usada como está", () => {
    const mensal = { ...consignado, interestRates: [{ ...consignado.interestRates![0], preFixedRate: 0.05, taxPeriodicity: "MONTHLY" }] } as PluggyEmprestimo;
    expect(sugestaoDoEmprestimo(mensal, "X")!.taxaMensal).toBe(0.05);
  });

  it("sem nenhum saldo, não sugere", () => {
    const vazio = { ...consignado, totalRemainingAmount: null, payments: null, nextInstallmentAmount: null } as unknown as PluggyEmprestimo;
    expect(sugestaoDoEmprestimo(vazio, "X")).toBeNull();
  });
});

describe("aplicarTravas", () => {
  it("taxa acima de 30% a.m. fica para conferir", () => {
    const s = aplicarTravas(sugestao({ taxaMensal: 1.45, parcelaMinima: 61000, parcelasRestantes: 12, confira: [] }));
    expect(s.taxaMensal).toBeNull();
    expect(s.confira).toContain("taxaMensal");
    expect(s.confira).not.toContain("parcelaMinima");
  });

  it("parcelas demais ou parcela maior que o dobro do saldo", () => {
    const s = aplicarTravas(sugestao({ taxaMensal: 0.02, parcelaMinima: 5000000, parcelasRestantes: 900, confira: [] }));
    expect(s.parcelasRestantes).toBeNull();
    expect(s.confira).toEqual(expect.arrayContaining(["parcelasRestantes", "parcelaMinima"]));
  });
});

describe("sugestaoDoChequeEspecial", () => {
  const conta: ContaBancaria = {
    id: "c",
    conexaoId: "x",
    pluggyAccountId: "p",
    tipo: "corrente",
    nome: "Conta",
    saldo: 0,
    limite: null,
    limiteDisponivel: null,
    fechamento: null,
    vencimento: null,
    chequeEspecialUsado: 50000,
    chequeEspecialLimite: 100000,
  };

  it("cheque especial em uso vira sugestão com a taxa para conferir", () => {
    expect(sugestaoDoChequeEspecial(conta, "Itaú")).toMatchObject({ tipo: "cheque", saldo: 50000, taxaMensal: null, confira: ["taxaMensal"] });
  });

  it("sem uso, nada", () => {
    expect(sugestaoDoChequeEspecial({ ...conta, chequeEspecialUsado: 0 }, "Itaú")).toBeNull();
  });
});

describe("instituições e chave", () => {
  it("nomes diferentes do mesmo banco", () => {
    expect(chaveDaInstituicao("ITAÚ UNIBANCO S.A.")).toBe("itau");
    expect(chaveDaInstituicao("Banco Itaú Consignado")).toBe("itau");
    expect(chaveDaInstituicao("NU PAGAMENTOS S.A.")).toBe("nubank");
    expect(chaveDaInstituicao("Caixa Econômica Federal")).toBe("caixa");
    expect(chaveDaInstituicao("Banco Desconhecido Ltda")).toBe("desconhecido");
  });

  it("chave com e sem parcela", () => {
    expect(chaveDaDivida({ instituicao: "Itaú", tipo: "emprestimo", parcelaMinima: 0 })).toBe("itau|emprestimo");
    expect(chaveDaDivida({ instituicao: "Itaú", tipo: "emprestimo", parcelaMinima: 61000 })).toBe("itau|emprestimo|61000");
  });
});

describe("fusão de fontes", () => {
  const doRegistrato = sugestao();
  const daPluggy = sugestaoDoEmprestimo(consignado, "Itaú Unibanco")!;

  it("Registrato e depois Pluggy do mesmo banco são a mesma dívida", () => {
    expect(encontrarDivida([doRegistrato], daPluggy)).toBe(doRegistrato);
    const junta = fundirDivida(doRegistrato, daPluggy);
    expect(junta.chave).toBe("itau|emprestimo");
    expect(junta.fonte).toBe("pluggy");
    expect(junta.taxaMensal).toBeCloseTo(0.03994, 5);
    expect(junta.parcelaMinima).toBe(100004);
    expect(junta.confira).not.toContain("taxaMensal");
  });

  it("não junta tipos diferentes nem parcelas muito diferentes", () => {
    expect(encontrarDivida([doRegistrato], { ...daPluggy, tipo: "parcelamento" })).toBeNull();
    const comParcela = sugestao({ parcelaMinima: 61000 });
    expect(encontrarDivida([comParcela], { ...daPluggy, parcelaMinima: 70000 })).toBeNull();
    expect(encontrarDivida([comParcela], { ...daPluggy, parcelaMinima: 61500 })).toBe(comParcela);
  });

  it("sem parcela para comparar, o saldo precisa ser parecido (dois empréstimos do mesmo banco não viram um)", () => {
    const pequeno = sugestao({ chave: "p", saldo: 300000, confira: ["taxaMensal"] });
    expect(encontrarDivida([pequeno], { ...daPluggy, saldo: 1700000 })).toBeNull();
    const parecido = sugestao({ chave: "q", saldo: 1500000, confira: ["taxaMensal"] });
    expect(encontrarDivida([parecido], { ...daPluggy, saldo: 1700000 })).toBe(parecido);
    // Saldo "a conferir" não serve para comparar: casa pela instituição e pelo tipo.
    const semSaldo = sugestao({ chave: "r", saldo: 300000, confira: ["saldo"] });
    expect(encontrarDivida([semSaldo], { ...daPluggy, saldo: 1700000 })).toBe(semSaldo);
  });

  it("cheque especial e rotativo: o saldo muda muito de um mês para o outro e continua sendo a mesma dívida", () => {
    const cheque = sugestao({ chave: "itau|cheque", tipo: "cheque", fonte: "pluggy", saldo: 20000, confira: [] });
    expect(encontrarDivida([cheque], { ...cheque, saldo: 80000 })).toBe(cheque);
    const rotativo = sugestao({ chave: "itau|cartao", tipo: "cartao", fonte: "pluggy", saldo: 50000, confira: [] });
    expect(encontrarDivida([rotativo], { ...rotativo, saldo: 300000 })).toBe(rotativo);
  });

  it("com duas candidatas, fica a de saldo mais próximo", () => {
    const a = sugestao({ chave: "a", saldo: 500000 });
    const b = sugestao({ chave: "b", saldo: 1800000 });
    expect(encontrarDivida([a, b], { ...daPluggy, saldo: 1700000 })?.chave).toBe("b");
  });

  it("fonte menos confiável não muda o que a Pluggy disse", () => {
    const pluggy = fundirDivida(doRegistrato, daPluggy);
    const extrato = sugestao({ fonte: "extrato", parcelaMinima: 99000, taxaMensal: 0.08, parcelasRestantes: 3, confira: [] });
    const depois = fundirDivida(pluggy, extrato);
    expect(depois.parcelaMinima).toBe(100004);
    expect(depois.taxaMensal).toBeCloseTo(0.03994, 5);
    expect(depois.parcelasRestantes).toBe(pluggy.parcelasRestantes);
    expect(depois.fonte).toBe("pluggy");
  });

  it("fonte menos confiável preenche o que estava faltando", () => {
    const contrato = sugestao({ fonte: "contrato", taxaMensal: 0.0199, parcelaMinima: 61000, parcelasRestantes: null, confira: ["parcelasRestantes"] });
    const extrato = sugestao({ fonte: "extrato", parcelaMinima: 61000, parcelasRestantes: 17, confira: ["saldo", "taxaMensal"] });
    const junta = fundirDivida(contrato, extrato);
    expect(junta.parcelasRestantes).toBe(17);
    expect(junta.taxaMensal).toBe(0.0199);
    expect(junta.confira).not.toContain("parcelasRestantes");
    expect(junta.fonte).toBe("contrato");
  });
});
