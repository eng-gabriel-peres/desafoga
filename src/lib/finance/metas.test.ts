import { describe, expect, it } from "vitest";
import { opcoesParaPrazo, previsaoDeTermino, situacaoDaMeta } from "./metas";
import type { Meta } from "./tipos";

const agora = new Date(2026, 10, 16, 10);

function meta(m: Partial<Omit<Meta, "depositos">> & { depositos?: number[] }): Meta {
  const { depositos = [], ...resto } = m;
  return {
    id: "m",
    nome: "Reserva",
    icone: "shield",
    cor: "azul",
    alvo: 100000,
    inicial: 0,
    modo: "valor",
    frequencia: "semana",
    valorPorPeriodo: 5200,
    prazo: null,
    criadaEm: "2026-10-12",
    lembrete: true,
    ...resto,
    depositos: depositos.map((valor, i) => ({ id: String(i), valor, descricao: "", quando: agora.toISOString(), via: "app" })),
  };
}

describe("metas de economia", () => {
  it("tenho uma data: quanto guardar por dia, semana ou mês", () => {
    // R$ 1.000 até 16/02/2027: 92 dias, 13 semanas, 3 meses.
    expect(opcoesParaPrazo(100000, "2027-02-16", "2026-11-16")).toEqual({
      dias: 92,
      semanas: 13,
      meses: 3,
      dia: 1087,
      semana: 7693,
      mes: 33334,
    });
  });

  it("sei quanto guardar: quando a meta termina", () => {
    expect(previsaoDeTermino(30000, 5000, "semana", "2026-11-16")).toEqual({ periodos: 6, data: "2026-12-28" });
    expect(previsaoDeTermino(30000, 12000, "mes", "2026-11-16")).toEqual({ periodos: 3, data: "2027-02-16" });
    expect(previsaoDeTermino(30000, 0, "dia", "2026-11-16")).toBeNull();
  });

  it("em dia, adiantada ou atrasada em relação ao plano", () => {
    // Criada há 5 semanas, R$ 52 por semana: esperado R$ 260.
    expect(situacaoDaMeta(meta({ depositos: [5000, 5200, 5200, 5200, 6400] }), agora).ritmo).toBe("em-dia");
    expect(situacaoDaMeta(meta({ depositos: [30000] }), agora).ritmo).toBe("adiantada");
    const atrasada = situacaoDaMeta(meta({ depositos: [10000] }), agora);
    expect(atrasada).toMatchObject({ ritmo: "atrasada", atrasado: 16000, falta: 90000 });
  });

  it("avisa quando a previsão passa do prazo", () => {
    const s = situacaoDaMeta(meta({ depositos: [10000], prazo: "2026-12-01" }), agora);
    expect(s.depoisDoPrazo).toBe(true);
  });

  it("concluída quando chega no alvo", () => {
    expect(situacaoDaMeta(meta({ depositos: [60000, 40000] }), agora)).toMatchObject({ concluida: true, fracao: 1, falta: 0 });
  });
});
