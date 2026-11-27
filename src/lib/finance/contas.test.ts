import { describe, expect, it } from "vitest";
import { compromissosDoMes, contasPorCategoria, diaDoVencimento, gruposDeVencimento, totaisDoMes } from "./contas";
import type { ContaFixa, Divida, Pagamento } from "./tipos";

const agora = new Date(2026, 10, 16, 10); // 16 de novembro
const conta = (c: Partial<ContaFixa> & Pick<ContaFixa, "id" | "vencimento" | "valor">): ContaFixa => ({
  nome: c.id,
  categoria: "outra",
  variavel: false,
  debitoAutomatico: false,
  lembrete: true,
  ...c,
});
const pago = (alvoId: string, valor: number, tipo: Pagamento["tipo"] = "conta"): Pagamento => ({
  tipo,
  alvoId,
  mes: "2026-11",
  valor,
  quando: agora.toISOString(),
});
const SEM_PLANO = { valorMensal: 0, estrategia: "mais-cara" as const };

describe("contas do mês", () => {
  it("vencimento no dia 31 cai no último dia do mês", () => {
    expect(diaDoVencimento(31, new Date(2026, 1, 10))).toBe(28);
    expect(diaDoVencimento(31, agora)).toBe(30);
  });

  it("marca paga, vencida, em breve e débito automático", () => {
    const c = compromissosDoMes(
      [
        conta({ id: "aluguel", vencimento: 10, valor: 20000 }),
        conta({ id: "luz", vencimento: 12, valor: 9500, variavel: true }),
        conta({ id: "internet", vencimento: 15, valor: 9990, debitoAutomatico: true }),
        conta({ id: "agua", vencimento: 18, valor: 4800, variavel: true }),
        conta({ id: "celular", vencimento: 25, valor: 4990 }),
      ],
      [],
      SEM_PLANO,
      [pago("aluguel", 20000), pago("luz", 8750, "conta"), { ...pago("celular", 4990), mes: "2026-10" }],
      agora,
    );
    const por = Object.fromEntries(c.map((x) => [x.id, x]));
    expect(por.aluguel).toMatchObject({ pago: true, vencida: false });
    expect(por.luz).toMatchObject({ pago: true, valor: 8750, estimado: false });
    expect(por.internet).toMatchObject({ pago: true, automatico: true });
    expect(por.agua).toMatchObject({ pago: false, emBreve: true, estimado: true });
    // O pagamento de outubro não conta em novembro.
    expect(por.celular).toMatchObject({ pago: false, vencida: false, emBreve: false });
  });

  it("assinatura no cartão vem paga pela fatura, sem vencer nem pedir pagamento, e ainda soma no mês", () => {
    const c = compromissosDoMes([conta({ id: "claude", vencimento: 25, valor: 11478, debitoAutomatico: true, cartao: "doc:picpay" })], [], SEM_PLANO, [], agora);
    expect(c[0]).toMatchObject({ pago: true, automatico: true, noCartao: true, vencida: false, emBreve: false });
    expect(totaisDoMes(c, null)).toMatchObject({ contas: 11478, falta: 0 });
  });

  it("conta vencida quando passou do dia sem pagar", () => {
    const [c] = compromissosDoMes([conta({ id: "bus", vencimento: 5, valor: 18000 })], [], SEM_PLANO, [], agora);
    expect(c).toMatchObject({ vencida: true, pago: false });
  });

  it("inclui a parcela do plano de cada dívida e soma os totais com a renda", () => {
    const divida: Divida = { id: "cartao", tipo: "cartao", nome: "Cartão", detalhe: "", saldo: 185000, taxaMensal: 0.142, parcelaMinima: 32000, vencimento: 20 };
    const c = compromissosDoMes([conta({ id: "aluguel", vencimento: 10, valor: 20000 })], [divida], { valorMensal: 52000, estrategia: "mais-cara" }, [pago("aluguel", 20000)], agora);
    expect(c.find((x) => x.tipo === "divida")).toMatchObject({ id: "cartao", valor: 52000, pago: false, dia: 20 });
    expect(totaisDoMes(c, { valor: 250000, dia: 5 })).toMatchObject({ contas: 20000, parcelas: 52000, total: 72000, pago: 20000, falta: 52000, sobra: 178000 });
    expect(totaisDoMes(c, null).sobra).toBeNull();
  });

  it("agrupa os vencimentos e soma por categoria", () => {
    const contas = [
      conta({ id: "a", vencimento: 5, valor: 100 }),
      conta({ id: "b", vencimento: 18, valor: 200, categoria: "luz" }),
      conta({ id: "c", vencimento: 28, valor: 300, categoria: "luz" }),
    ];
    const grupos = gruposDeVencimento(compromissosDoMes(contas, [], SEM_PLANO, [], agora), agora);
    expect(grupos.map((g) => [g.titulo, g.itens.map((i) => i.id)])).toEqual([
      ["Vencidas", ["a"]],
      ["Próximos 7 dias", ["b"]],
      ["Mais para o fim do mês", ["c"]],
    ]);
    expect(contasPorCategoria(contas)).toEqual([
      { categoria: "luz", valor: 500 },
      { categoria: "outra", valor: 100 },
    ]);
  });
});
