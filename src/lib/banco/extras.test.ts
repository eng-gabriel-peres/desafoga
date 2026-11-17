import { describe, expect, it } from "vitest";
import { assinaturasDetectadas, jurosDeBoletoDoMes, melhorDiaDeCompra, rendaDetectada, tarifasDoMes, usoDoLimite } from "./extras";
import type { ContaBancaria, Movimento } from "./tipos";

const conta = (extra: Partial<ContaBancaria> = {}): ContaBancaria => ({
  id: "c",
  conexaoId: "x",
  pluggyAccountId: "p",
  tipo: "cartao",
  nome: "Cartão",
  saldo: 255000,
  limite: 300000,
  limiteDisponivel: 45000,
  fechamento: "2026-12-03",
  vencimento: "2026-12-10",
  chequeEspecialUsado: null,
  chequeEspecialLimite: null,
  ...extra,
});

let n = 0;
const mov = (data: string, descricao: string, valor: number, extra: Partial<Movimento> = {}): Movimento => ({
  id: `m${n++}`,
  pluggyId: `p${n}`,
  contaId: "c",
  data,
  descricao,
  descricaoOriginal: descricao,
  valor,
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
  natureza: "compra",
  categoria: "Lazer",
  situacao: "historico",
  compraId: null,
  parceladaId: null,
  ...extra,
});

describe("cartão", () => {
  it("melhor dia de compra é o dia seguinte ao fechamento", () => {
    expect(melhorDiaDeCompra(conta())).toBe(4);
    expect(melhorDiaDeCompra(conta({ fechamento: "2026-12-31" }))).toBe(1);
    expect(melhorDiaDeCompra(conta({ fechamento: null }))).toBeNull();
    expect(melhorDiaDeCompra(conta({ tipo: "corrente" }))).toBeNull();
  });

  it("uso do limite pelo disponível", () => {
    expect(usoDoLimite(conta())).toEqual({ usado: 255000, limite: 300000, fracao: 0.85 });
    expect(usoDoLimite(conta({ limite: null }))).toBeNull();
  });
});

describe("renda detectada", () => {
  it("salário em dois ou mais meses, valor parecido", () => {
    const movs = [
      mov("2026-09-05", "SALARIO LOJAS", 280000, { direcao: "entrada", natureza: "renda" }),
      mov("2026-10-05", "SALARIO LOJAS", 280000, { direcao: "entrada", natureza: "renda" }),
      mov("2026-11-06", "SALARIO LOJAS", 285000, { direcao: "entrada", natureza: "renda" }),
    ];
    expect(rendaDetectada(movs)).toEqual({ valor: 285000, dia: 5 });
  });

  it("entrada recorrente da mesma pessoa vale como renda", () => {
    const movs = [
      mov("2026-10-10", "PIX RECEBIDO EMPRESA X", 150000, { direcao: "entrada", natureza: "outra-entrada", documentoContraparte: "12345678000199" }),
      mov("2026-11-10", "PIX RECEBIDO EMPRESA X", 150000, { direcao: "entrada", natureza: "outra-entrada", documentoContraparte: "12345678000199" }),
    ];
    expect(rendaDetectada(movs)).toEqual({ valor: 150000, dia: 10 });
  });

  it("uma vez só, ou valores muito diferentes, não é renda", () => {
    expect(rendaDetectada([mov("2026-11-05", "SALARIO", 280000, { direcao: "entrada", natureza: "renda" })])).toBeNull();
    expect(
      rendaDetectada([
        mov("2026-10-10", "PIX RECEBIDO JOAO", 5000, { direcao: "entrada", natureza: "outra-entrada" }),
        mov("2026-11-10", "PIX RECEBIDO JOAO", 90000, { direcao: "entrada", natureza: "outra-entrada" }),
      ]),
    ).toBeNull();
  });
});

describe("assinaturas", () => {
  it("mesma loja, valor parecido, meses seguidos", () => {
    const movs = [mov("2026-09-01", "NETFLIX.COM", 5590), mov("2026-10-01", "NETFLIX.COM", 5590), mov("2026-11-01", "NETFLIX.COM", 5590), mov("2026-11-03", "IFOOD", 4500)];
    expect(assinaturasDetectadas(movs)).toEqual([{ nome: "Netflix.com", valor: 5590, meses: 3, ultimaData: "2026-11-01" }]);
  });

  it("parcela não é assinatura; compra que muda muito de valor também não", () => {
    const parcela = [mov("2026-10-02", "MERCADOLIVRE*CELULAR", 48000, { parcela: 1, totalParcelas: 10 }), mov("2026-11-02", "MERCADOLIVRE*CELULAR", 48000, { parcela: 2, totalParcelas: 10 })];
    const mercado = [mov("2026-10-02", "CARREFOUR", 20000), mov("2026-11-02", "CARREFOUR", 45000)];
    expect(assinaturasDetectadas([...parcela, ...mercado])).toEqual([]);
  });
});

describe("tarifas e juros de boleto", () => {
  it("somam no mês", () => {
    const movs = [
      mov("2026-11-16", "TARIFA PACOTE", 3990, { natureza: "tarifa" }),
      mov("2026-10-16", "TARIFA PACOTE", 3990, { natureza: "tarifa" }),
      mov("2026-11-08", "BOLETO ENEL", 15240, { natureza: "outra-saida", jurosBoleto: 1240 }),
    ];
    expect(tarifasDoMes(movs, "2026-11")).toEqual({ total: 3990, itens: [{ nome: "Tarifa pacote", valor: 3990 }] });
    expect(jurosDeBoletoDoMes(movs, "2026-11")).toBe(1240);
  });
});
