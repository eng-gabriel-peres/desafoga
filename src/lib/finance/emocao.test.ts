import { describe, expect, it } from "vitest";
import { chaveDoDia, ultimosDias } from "./datas";
import {
  emocaoDaNota,
  notaDoDia,
  notaMedia,
  resumoDaSemana,
  rotuloDaNota,
  situacaoDoPaciente,
} from "./emocao";
import { comprasPorHorario, divisaoPorNecessidade, padroesDeCompra } from "./padroes";
import type { Compra, Emocao, Necessidade } from "./tipos";

const HOJE = new Date(2026, 10, 16, 15, 0); // 16/11/2026, 15h

let n = 0;
function compra(diasAtras: number, hora: number, emocao: Emocao, necessidade: Necessidade, valor = 1000, avaliada = false): Compra {
  const d = new Date(HOJE);
  d.setDate(d.getDate() - diasAtras);
  d.setHours(hora, 0, 0, 0);
  return {
    id: `c${n++}`,
    item: "x",
    categoria: "Outro",
    valor,
    emocao,
    necessidade,
    quando: d.toISOString(),
    via: "app",
    avaliacaoProfissional: avaliada ? necessidade : null,
  };
}

describe("datas", () => {
  it("gera a chave do dia no fuso local", () => {
    expect(chaveDoDia(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("lista os últimos dias do mais antigo para hoje", () => {
    expect(ultimosDias(HOJE, 3)).toEqual(["2026-11-14", "2026-11-15", "2026-11-16"]);
  });
});

describe("nota do dia", () => {
  it("é a média das emoções das compras do dia", () => {
    const l = [compra(0, 9, 2, "sim"), compra(0, 10, 3, "sim"), compra(1, 9, 5, "sim")];
    expect(notaDoDia(l, HOJE)).toBe(2.5);
  });

  it("é null quando não há compras no dia", () => {
    expect(notaDoDia([compra(1, 9, 5, "sim")], HOJE)).toBeNull();
    expect(notaMedia([])).toBeNull();
  });

  it("vira carinha arredondando e limitando de 1 a 5", () => {
    expect(emocaoDaNota(2.5)).toBe(3);
    expect(emocaoDaNota(2.49)).toBe(2);
    expect(emocaoDaNota(0.2)).toBe(1);
    expect(emocaoDaNota(9)).toBe(5);
  });

  it("tem um rótulo em linguagem simples", () => {
    expect(rotuloDaNota(null)).toBe("Sem compras");
    expect(rotuloDaNota(1.3)).toBe("Dia muito triste");
    expect(rotuloDaNota(2)).toBe("Dia triste");
    expect(rotuloDaNota(3)).toBe("Dia normal");
    expect(rotuloDaNota(4)).toBe("Dia feliz");
    expect(rotuloDaNota(4.5)).toBe("Dia muito feliz");
  });
});

describe("resumo da semana", () => {
  const compras = [
    compra(0, 9, 2, "nao", 5000),
    compra(0, 10, 4, "sim", 2000, true),
    compra(3, 9, 3, "talvez", 1000),
    compra(9, 9, 1, "nao", 99999), // fora da semana
  ];
  const r = resumoDaSemana(compras, HOJE);

  it("tem 7 dias, do mais antigo para hoje", () => {
    expect(r.dias).toHaveLength(7);
    expect(r.dias[6].chave).toBe("2026-11-16");
    expect(r.dias[6]).toMatchObject({ nota: 3, gasto: 7000 });
    expect(r.dias[5]).toMatchObject({ nota: null, gasto: 0 });
  });

  it("a nota da semana é a média das notas dos dias com compra", () => {
    expect(r.nota).toBe(3);
  });

  it("conta gasto, não necessárias e compras sem avaliação do profissional", () => {
    expect(r.gasto).toBe(8000);
    expect(r.total).toBe(3);
    expect(r.naoNecessarias).toBe(1);
    expect(r.paraAvaliar).toBe(2);
  });
});

describe("situação do paciente", () => {
  it("precisa de atenção com nota baixa ou metade das compras não necessárias", () => {
    expect(situacaoDoPaciente({ nota: 2.4, total: 4, naoNecessarias: 0 })).toBe("atencao");
    expect(situacaoDoPaciente({ nota: 4, total: 4, naoNecessarias: 2 })).toBe("atencao");
  });

  it("acompanhar com nota média ou 30% não necessárias", () => {
    expect(situacaoDoPaciente({ nota: 3, total: 10, naoNecessarias: 0 })).toBe("acompanhar");
    expect(situacaoDoPaciente({ nota: 4, total: 10, naoNecessarias: 3 })).toBe("acompanhar");
  });

  it("estável no resto, e novo sem compras", () => {
    expect(situacaoDoPaciente({ nota: 4, total: 10, naoNecessarias: 1 })).toBe("estavel");
    expect(situacaoDoPaciente({ nota: null, total: 0, naoNecessarias: 0 })).toBe("novo");
  });
});

describe("padrões de compra", () => {
  const compras = [
    compra(1, 22, 1, "nao", 30000),
    compra(1, 23, 2, "nao", 10000),
    compra(2, 10, 2, "sim", 2000),
    compra(2, 11, 4, "sim", 4000),
    compra(3, 12, 5, "nao", 6000),
  ];
  const p = padroesDeCompra(compras, HOJE);

  it("conta de cada 10 compras tristes e felizes quantas não eram necessárias", () => {
    expect(p.tristes).toEqual({ total: 3, deCada10: 7 });
    expect(p.felizes).toEqual({ total: 2, deCada10: 5 });
  });

  it("compara o gasto médio dos dias de nota baixa com os dias bons", () => {
    // dia 1: nota 1,5, gasto 40000; dia 2: nota 3, gasto 6000; dia 3: nota 5, gasto 6000
    expect(p.gastoMedioDiasBaixos).toBe(40000);
    expect(p.gastoMedioDiasBons).toBe(6000);
  });

  it("conta as compras depois das 21h", () => {
    expect(p.noite).toEqual({ total: 2, naoNecessarias: 2 });
  });

  it("divide o gasto por necessidade", () => {
    expect(divisaoPorNecessidade(compras)).toEqual({ sim: 6000, nao: 46000, talvez: 0 });
  });
});

describe("compras sem emoção (registradas sozinhas pelo banco)", () => {
  const sem = (c: Compra): Compra => ({ ...c, emocao: null, necessidade: null });

  it("ficam fora da nota média", () => {
    expect(notaMedia([compra(0, 10, 2, "sim"), sem(compra(0, 11, 5, "sim")), compra(0, 12, 4, "sim")])).toBe(3);
    expect(notaMedia([sem(compra(0, 10, 2, "sim"))])).toBeNull();
  });

  it("ficam fora dos padrões e da divisão por necessidade", () => {
    const lista = [compra(1, 22, 1, "nao", 1000), sem(compra(1, 23, 1, "nao", 5000))];
    expect(padroesDeCompra(lista, HOJE).tristes).toEqual(padroesDeCompra([lista[0]], HOJE).tristes);
    expect(divisaoPorNecessidade(lista).nao).toBe(1000);
  });
});

describe("compras por horário", () => {
  it("separa manhã, tarde, noite e madrugada, com a carinha média e as não necessárias", () => {
    const l = [compra(0, 8, 4, "sim"), compra(1, 13, 3, "sim"), compra(2, 23, 1, "nao"), compra(3, 2, 2, "nao"), compra(3, 22, 2, "talvez")];
    const h = comprasPorHorario(l);
    expect(h.map((x) => x.nome)).toEqual(["Manhã", "Tarde", "Noite", "Madrugada"]);
    expect(h[0]).toMatchObject({ faixa: "6h às 12h", total: 1, naoNecessarias: 0, nota: 4 });
    expect(h[2]).toMatchObject({ total: 0, nota: null });
    expect(h[3]).toMatchObject({ faixa: "22h às 6h", total: 3, naoNecessarias: 2 });
    expect(h[3].nota).toBeCloseTo(5 / 3);
  });
});
