import { describe, expect, it } from "vitest";
import { dadosDoSandbox } from "./cliente-falso";
import { candidataDoMovimento, normalizarConta, normalizarTransacao, tipoDaConta } from "./normalizar";
import type { PluggyTransacao } from "./pluggy";

const sandbox = dadosDoSandbox();
const conta = sandbox.contas.find((c) => c.type === "BANK")!;
const cartao = sandbox.contas.find((c) => c.type === "CREDIT")!;
const daConta = sandbox.transacoes[conta.id];
const doCartao = sandbox.transacoes[cartao.id];
const achar = (lista: PluggyTransacao[], descricao: string) => lista.find((t) => t.description === descricao)!;

describe("normalizarTransacao", () => {
  it("compra parcelada do cartão vira saída com os dados da parcela, mesmo com o sinal trocado do sandbox", () => {
    const netflix = doCartao.find((t) => t.description === "NETFLIX.COM" && t.creditCardMetadata?.totalInstallments)!;
    expect(normalizarTransacao(netflix, "cartao")).toMatchObject({
      direcao: "saida",
      valor: 5590,
      parcela: 2,
      totalParcelas: 6,
      valorTotalDaCompra: 33540,
      mcc: 5812,
    });
  });

  it("todas as compras do cartão do sandbox são saída", () => {
    expect(doCartao.map((t) => normalizarTransacao(t, "cartao").direcao).every((d) => d === "saida")).toBe(true);
  });

  it("débito da conta vira saída com a data de Brasília", () => {
    expect(normalizarTransacao(achar(daConta, "CONDOMINIO EDIFICIO SOLAR"), "corrente")).toMatchObject({
      direcao: "saida",
      valor: 80000,
      data: "2026-11-05",
    });
  });

  it("data só-dia à meia-noite UTC não volta um dia", () => {
    const t = { ...achar(daConta, "CONDOMINIO EDIFICIO SOLAR"), date: new Date("2026-11-05T00:00:00.000Z") };
    expect(normalizarTransacao(t, "corrente").data).toBe("2026-11-05");
    const instante = { ...t, date: new Date("2026-11-17T12:46:46.867Z") };
    expect(normalizarTransacao(instante, "corrente").data).toBe("2026-11-17");
    const noite = { ...t, date: new Date("2026-11-18T01:30:00.000Z") };
    expect(normalizarTransacao(noite, "corrente").data).toBe("2026-11-17");
  });

  it("crédito positivo na conta vira entrada", () => {
    const creditos = daConta.filter((t) => t.type === "CREDIT");
    expect(creditos.length).toBeGreaterThan(0);
    expect(creditos.every((t) => normalizarTransacao(t, "corrente").direcao === "entrada")).toBe(true);
  });

  it("documento da contraparte só com dígitos, ou null quando não é CPF/CNPJ", () => {
    const boleto = achar(daConta, "Pagamento de boleto");
    expect(normalizarTransacao(boleto, "corrente").documentoContraparte).toBeNull();
    const pix = { ...boleto, type: "DEBIT", paymentData: { ...boleto.paymentData!, receiver: { ...boleto.paymentData!.receiver!, documentNumber: { type: "CPF", value: "123.456.789-09" } } } } as PluggyTransacao;
    expect(normalizarTransacao(pix, "corrente").documentoContraparte).toBe("12345678909");
  });

  it("no cartão, pagamento e estorno são entrada", () => {
    const base = doCartao[0];
    expect(normalizarTransacao({ ...base, description: "PAGAMENTO RECEBIDO" }, "cartao").direcao).toBe("entrada");
    expect(normalizarTransacao({ ...base, description: "ESTORNO LOJA X" }, "cartao").direcao).toBe("entrada");
  });
});

describe("normalizarConta", () => {
  it("cartão com limite, fechamento e vencimento", () => {
    expect(tipoDaConta(cartao)).toBe("cartao");
    expect(normalizarConta(cartao)).toMatchObject({ tipo: "cartao", limite: 30000000, fechamento: "2026-11-17", vencimento: "2026-11-22" });
  });

  it("conta corrente com saldo em centavos", () => {
    expect(normalizarConta(conta)).toMatchObject({ tipo: "corrente", saldo: 4351643 });
  });
});

describe("candidataDoMovimento", () => {
  it("parcela vira candidata de compra parcelada com a conta como origem", () => {
    const netflix = doCartao.find((t) => t.description === "NETFLIX.COM" && t.creditCardMetadata?.totalInstallments)!;
    const m = normalizarTransacao(netflix, "cartao");
    expect(candidataDoMovimento({ ...m, contaId: cartao.id })).toMatchObject({
      origem: cartao.id,
      parcelaAtual: 2,
      totalParcelas: 6,
      valorParcela: 5590,
      mesDaParcela: m.data.slice(0, 7),
    });
  });

  it("sem parcela, não há candidata", () => {
    expect(candidataDoMovimento(normalizarTransacao(achar(daConta, "CONDOMINIO EDIFICIO SOLAR"), "corrente"))).toBeNull();
  });
});
