import { describe, expect, it } from "vitest";
import { categoriaDe, chaveDaDescricao, naturezaDe, PARCELA_DE_EMPRESTIMO, type RegraDoBanco } from "./classificar";
import type { MovimentoNovo } from "./tipos";

const mov = (descricao: string, extra: Partial<MovimentoNovo> = {}): MovimentoNovo => ({
  pluggyId: "x",
  contaId: "c",
  data: "2026-11-10",
  descricao,
  descricaoOriginal: descricao,
  valor: 1000,
  direcao: "saida",
  categoriaPluggy: null,
  parcela: null,
  totalParcelas: null,
  valorTotalDaCompra: null,
  compradaEm: null,
  faturaPrevista: null,
  cnpj: null,
  mcc: null,
  documentoContraparte: null,
  jurosBoleto: null,
  pendente: false,
  ...extra,
});
const ctx = (regras: RegraDoBanco[] = [], cpfDoTitular: string | null = "12345678909") => ({ regras, cpfDoTitular });
const natureza = (descricao: string, extra: Partial<MovimentoNovo> = {}, tipo: "corrente" | "cartao" = "corrente") =>
  naturezaDe(mov(descricao, extra), { ...ctx(), tipoDaConta: tipo });

describe("categoriaDe", () => {
  it.each([
    ["IFOOD *RESTAURANTE", "Comida pronta"],
    ["DROGASIL 123", "Farmácia"],
    ["CARREFOUR", "Mercado"],
    ["ASSAI ATACADISTA", "Mercado"],
    ["RENNER", "Roupa"],
    ["NETFLIX.COM", "Lazer"],
    ["SPOTIFY AB", "Lazer"],
    ["SMART FIT ACADEMIA", "Lazer"],
  ])("%s → %s", (descricao, categoria) => {
    expect(categoriaDe(mov(descricao), [])).toBe(categoria);
  });

  it("usa o MCC quando a loja é desconhecida", () => {
    expect(categoriaDe(mov("LOJA XPTO", { mcc: 5912 }), [])).toBe("Farmácia");
  });

  it("usa a categoria da Pluggy quando vier", () => {
    expect(categoriaDe(mov("LOJA XPTO", { categoriaPluggy: "Groceries" }), [])).toBe("Mercado");
  });

  it("desconhecido vira Outro", () => {
    expect(categoriaDe(mov("LOJA XPTO"), [])).toBe("Outro");
  });

  it("regra da pessoa vence o dicionário", () => {
    const regras: RegraDoBanco[] = [{ padrao: chaveDaDescricao("CARREFOUR"), efeito: { categoria: "Casa" } }];
    expect(categoriaDe(mov("CARREFOUR"), regras)).toBe("Casa");
  });
});

describe("naturezaDe", () => {
  it.each([
    ["ELETROBRAS LIGHT SA", "outra-saida"],
    ["PGTO FATURA NUBANK", "pagamento-fatura"],
    ["PAGAMENTO DE FATURA CARTAO", "pagamento-fatura"],
    ["PARC EMPREST 05/24", "parcela-emprestimo"],
    ["CONSIGNADO INSS", "parcela-emprestimo"],
    ["IOF COMPRA EXTERIOR", "iof"],
    ["JUROS ROTATIVO", "juros"],
    ["TARIFA PACOTE SERVICOS", "tarifa"],
    ["IFOOD *RESTAURANTE", "compra"],
  ] as const)("%s → %s", (descricao, esperado) => {
    expect(natureza(descricao)).toBe(esperado);
  });

  it("estorno no cartão", () => {
    expect(natureza("ESTORNO SHOPEE", { direcao: "entrada" }, "cartao")).toBe("estorno");
  });

  it("pagamento recebido no cartão é pagamento de fatura", () => {
    expect(natureza("PAGAMENTO RECEBIDO", { direcao: "entrada" }, "cartao")).toBe("pagamento-fatura");
  });

  it("salário que entra é renda", () => {
    expect(natureza("SALARIO EMPRESA X", { direcao: "entrada" })).toBe("renda");
  });

  it("outra entrada qualquer", () => {
    expect(natureza("PIX RECEBIDO MARIA", { direcao: "entrada" })).toBe("outra-entrada");
  });

  it("transferência para o próprio CPF", () => {
    expect(natureza("PIX ENVIADO", { documentoContraparte: "12345678909" })).toBe("transferencia-propria");
  });

  it("mesma titularidade pela descrição", () => {
    expect(natureza("TRANSF MESMA TITULARIDADE")).toBe("transferencia-propria");
  });

  it("parcela de empréstimo só na conta, não no cartão", () => {
    expect(natureza("FINANCIAMENTO LOJA", {}, "cartao")).toBe("compra");
  });

  it("regra de transferência da pessoa vence", () => {
    const regras: RegraDoBanco[] = [{ padrao: chaveDaDescricao("PIX JOAO"), efeito: { natureza: "transferencia-propria" } }];
    expect(naturezaDe(mov("PIX JOAO"), { ...ctx(regras), tipoDaConta: "corrente" })).toBe("transferencia-propria");
  });

  it("categoria da Pluggy de mesma titularidade", () => {
    expect(natureza("TED 123", { categoriaPluggy: "Same person transfer" })).toBe("transferencia-propria");
  });
});

describe("chaveDaDescricao", () => {
  it("ignora espaços, pontuação e o número da parcela", () => {
    expect(chaveDaDescricao("MERCADOLIVRE*CELULAR 03/10")).toBe(chaveDaDescricao("MERCADO LIVRE CELULAR PARC 04/10"));
    expect(chaveDaDescricao("Pão de Açúcar")).toBe("PAODEACUCAR");
  });

  it("PARCELA_DE_EMPRESTIMO reconhece os nomes comuns", () => {
    expect(PARCELA_DE_EMPRESTIMO.test("CDC PARCELA 3")).toBe(true);
    expect(PARCELA_DE_EMPRESTIMO.test("CREDITO PESSOAL")).toBe(true);
    expect(PARCELA_DE_EMPRESTIMO.test("IFOOD")).toBe(false);
  });
});
