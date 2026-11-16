import { describe, expect, it } from "vitest";
import {
  compararExtra,
  dividaMaisCara,
  jurosDoMes,
  jurosMensaisTotais,
  projecaoSoMinimo,
  simularQuitacao,
  somaDosMinimos,
} from "./dividas";
import type { Divida } from "./tipos";

const divida = (o: Partial<Divida> & Pick<Divida, "id">): Divida => ({
  tipo: "outra",
  nome: o.id,
  detalhe: "",
  saldo: 100000,
  taxaMensal: 0.1,
  parcelaMinima: 10000,
  vencimento: 10,
  ...o,
});

const cartao = divida({ id: "cartao", saldo: 185000, taxaMensal: 0.142, parcelaMinima: 32000 });
const cheque = divida({ id: "cheque", saldo: 62000, taxaMensal: 0.079, parcelaMinima: 8000 });
const emprestimo = divida({ id: "emprestimo", saldo: 300000, taxaMensal: 0.041, parcelaMinima: 28000 });
const celular = divida({ id: "celular", saldo: 120000, taxaMensal: 0.032, parcelaMinima: 22000 });
const daAna = [cartao, cheque, emprestimo, celular];

describe("juros do mês", () => {
  it("multiplica saldo pela taxa e arredonda para o centavo", () => {
    expect(jurosDoMes(cartao)).toBe(26270);
    expect(jurosDoMes(divida({ id: "x", saldo: 333, taxaMensal: 0.1 }))).toBe(33);
  });

  it("soma os juros de todas as dívidas", () => {
    expect(jurosMensaisTotais(daAna)).toBe(26270 + 4898 + 12300 + 3840);
  });

  it("soma os mínimos e acha a mais cara", () => {
    expect(somaDosMinimos(daAna)).toBe(90000);
    expect(dividaMaisCara(daAna)?.id).toBe("cartao");
    expect(dividaMaisCara([])).toBeNull();
  });
});

describe("simulação de quitação", () => {
  it("quita uma dívida simples mês a mês, com juros antes do pagamento", () => {
    const d = divida({ id: "a", saldo: 100000, taxaMensal: 0.1, parcelaMinima: 60000 });
    const r = simularQuitacao([d], 60000, "mais-cara");
    // mês 1: 100000 + 10000 - 60000 = 50000; mês 2: 50000 + 5000 - 55000 = 0
    expect(r.quitavel).toBe(true);
    expect(r.meses).toBe(2);
    expect(r.jurosTotal).toBe(15000);
    expect(r.totalPago).toBe(115000);
    expect(r.linhaDoTempo).toEqual([100000, 50000, 0]);
    expect(r.quitadaNoMes).toEqual({ a: 2 });
  });

  it("paga os mínimos e manda o restante para a mais cara", () => {
    const r = simularQuitacao(daAna, 110000, "mais-cara");
    expect(r.pagamentoPrimeiroMes.cartao).toBe(32000 + 20000);
    expect(r.pagamentoPrimeiroMes.cheque).toBe(8000);
    expect(r.ordemDeQuitacao[0]).toBe("cartao");
  });

  it("na estratégia menor primeiro, o extra vai para o menor saldo", () => {
    const r = simularQuitacao(daAna, 110000, "menor");
    expect(r.pagamentoPrimeiroMes.cheque).toBe(8000 + 20000);
    expect(r.pagamentoPrimeiroMes.cartao).toBe(32000);
    expect(r.ordemDeQuitacao[0]).toBe("cheque");
  });

  it("mais cara primeiro paga menos juros que menor primeiro", () => {
    const avalanche = simularQuitacao(daAna, 110000, "mais-cara");
    const bola = simularQuitacao(daAna, 110000, "menor");
    expect(avalanche.jurosTotal).toBeLessThanOrEqual(bola.jurosTotal);
  });

  it("o saldo total nunca sobe quando o valor cobre os juros", () => {
    const r = simularQuitacao(daAna, 90000, "mais-cara");
    for (let i = 1; i < r.linhaDoTempo.length; i++) {
      expect(r.linhaDoTempo[i]).toBeLessThanOrEqual(r.linhaDoTempo[i - 1]);
    }
    expect(r.linhaDoTempo.at(-1)).toBe(0);
  });

  it("avisa quando o valor não quita dentro do limite", () => {
    const d = divida({ id: "a", saldo: 100000, taxaMensal: 0.1, parcelaMinima: 5000 });
    const r = simularQuitacao([d], 5000, "mais-cara", 24);
    expect(r.quitavel).toBe(false);
    expect(r.meses).toBe(24);
  });

  it("não paga mais do que o saldo no último mês", () => {
    const d = divida({ id: "a", saldo: 1000, taxaMensal: 0, parcelaMinima: 500 });
    const r = simularQuitacao([d], 5000, "mais-cara");
    expect(r.totalPago).toBe(1000);
    expect(r.meses).toBe(1);
  });

  it("sem dívidas, já está livre", () => {
    const r = simularQuitacao([], 10000, "mais-cara");
    expect(r).toMatchObject({ quitavel: true, meses: 0, jurosTotal: 0 });
  });
});

describe("projeção de 12 meses só no mínimo", () => {
  it("acumula os juros pagando só a parcela mínima", () => {
    const d = divida({ id: "a", saldo: 100000, taxaMensal: 0.1, parcelaMinima: 20000 });
    const r = projecaoSoMinimo([d], 2);
    // mês 1: juros 10000, saldo 90000; mês 2: juros 9000, saldo 79000
    expect(r).toEqual({ jurosTotal: 19000, saldoFinal: 79000 });
  });

  it("usa 12 meses por padrão", () => {
    const r = projecaoSoMinimo(daAna);
    expect(r.jurosTotal).toBeGreaterThan(jurosMensaisTotais(daAna) * 6);
    expect(r.saldoFinal).toBeLessThan(daAna.reduce((s, d) => s + d.saldo, 0));
  });
});

describe("comparação com valor extra", () => {
  it("mostra a economia de juros e os meses a menos", () => {
    const c = compararExtra(daAna, 20000);
    expect(c.comExtra.meses).toBeLessThan(c.soMinimo.meses);
    expect(c.economiaJuros).toBe(c.soMinimo.jurosTotal - c.comExtra.jurosTotal);
    expect(c.economiaJuros).toBeGreaterThan(0);
    expect(c.mesesAMenos).toBe(c.soMinimo.meses - c.comExtra.meses);
  });

  it("extra zero não economiza nada", () => {
    const c = compararExtra(daAna, 0);
    expect(c.economiaJuros).toBe(0);
    expect(c.mesesAMenos).toBe(0);
  });
});
