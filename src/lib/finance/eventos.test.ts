import { describe, expect, it } from "vitest";
import { andamentoNoDesafio, classificar, diaDentroDaRegra, diasEntreChaves, situacaoDoEvento, type CompraNoDia, type RegrasDoDesafio } from "./eventos";

const c = (dia: string, extra: Partial<CompraNoDia> = {}): CompraNoDia => ({ dia, categoria: "Mercado", valor: 1000, emocao: 4, necessidade: "sim", ...extra });

describe("regra do dia", () => {
  it("sem compra não necessária", () => {
    const r: RegrasDoDesafio = { regra: "sem-desnecessaria", categoria: null, limite: null };
    expect(diaDentroDaRegra(r, [])).toBe(true);
    expect(diaDentroDaRegra(r, [c("d"), c("d", { necessidade: "talvez" })])).toBe(true);
    expect(diaDentroDaRegra(r, [c("d", { necessidade: "nao" })])).toBe(false);
  });
  it("sem uma categoria", () => {
    const r: RegrasDoDesafio = { regra: "sem-categoria", categoria: "Comida pronta", limite: null };
    expect(diaDentroDaRegra(r, [c("d")])).toBe(true);
    expect(diaDentroDaRegra(r, [c("d", { categoria: "Comida pronta" })])).toBe(false);
  });
  it("limite por dia (centavos)", () => {
    const r: RegrasDoDesafio = { regra: "limite-dia", categoria: null, limite: 5000 };
    expect(diaDentroDaRegra(r, [c("d", { valor: 3000 }), c("d", { valor: 2000 })])).toBe(true);
    expect(diaDentroDaRegra(r, [c("d", { valor: 3000 }), c("d", { valor: 2001 })])).toBe(false);
  });
  it("comprar só estando bem: sem compras ou nota 3 ou mais", () => {
    const r: RegrasDoDesafio = { regra: "nota-boa", categoria: null, limite: null };
    expect(diaDentroDaRegra(r, [])).toBe(true);
    expect(diaDentroDaRegra(r, [c("d", { emocao: 2 }), c("d", { emocao: 4 })])).toBe(true);
    expect(diaDentroDaRegra(r, [c("d", { emocao: 2 }), c("d", { emocao: 3 })])).toBe(false);
  });
});

describe("andamento de cada pessoa", () => {
  const desafio = { inicio: "2026-11-14", fim: "2026-11-20", regra: "sem-desnecessaria" as const, categoria: null, limite: null };

  it("conta do dia em que entrou até hoje; pontos com bônus de sequência", () => {
    const compras = [c("2026-11-16", { necessidade: "nao" }), c("2026-11-13", { necessidade: "nao" })];
    const a = andamentoNoDesafio(desafio, "2026-11-14", compras, "2026-11-18");
    expect(a.dias.map((d) => d.estado)).toEqual(["ok", "ok", "fora", "ok", "ok", "futuro", "futuro"]);
    expect(a).toMatchObject({ ok: 4, contados: 5, sequencia: 2 });
    // 4 dias × 10 + bônus: dia 15 (2º seguido) e dia 18 (2º seguido) = +10.
    expect(a.pontos).toBe(50);
  });

  it("dias antes de entrar não contam", () => {
    const a = andamentoNoDesafio(desafio, "2026-11-17", [], "2026-11-18");
    expect(a.dias.slice(0, 4).map((d) => d.estado)).toEqual(["antes", "antes", "antes", "ok"]);
    expect(a).toMatchObject({ ok: 2, contados: 2, pontos: 25 });
  });

  it("antes de começar, nada conta", () => {
    expect(andamentoNoDesafio(desafio, "2026-11-14", [], "2026-11-10")).toMatchObject({ ok: 0, contados: 0, pontos: 0 });
  });
});

describe("ranking", () => {
  it("ordena por pontos, depois dias, sequência e nome; empate divide a posição", () => {
    const linhas = [
      { nome: "Rafael", pontos: 30, ok: 3, sequencia: 1 },
      { nome: "Ana", pontos: 50, ok: 4, sequencia: 2 },
      { nome: "Carlos", pontos: 30, ok: 3, sequencia: 1 },
    ];
    expect(classificar(linhas).map((l) => [l.nome, l.posicao])).toEqual([
      ["Ana", 1],
      ["Carlos", 2],
      ["Rafael", 2],
    ]);
  });
});

describe("situação do evento", () => {
  it("desafio: começa em, dia X de Y, encerrado", () => {
    const d = { tipo: "desafio" as const, inicio: "2026-11-14", fim: "2026-11-20", data: null };
    expect(situacaoDoEvento(d, "2026-11-13")).toEqual({ fase: "breve", texto: "Começa amanhã" });
    expect(situacaoDoEvento(d, "2026-11-10")).toEqual({ fase: "breve", texto: "Começa em 4 dias" });
    expect(situacaoDoEvento(d, "2026-11-18")).toEqual({ fase: "agora", texto: "Dia 5 de 7" });
    expect(situacaoDoEvento(d, "2026-11-21")).toEqual({ fase: "fim", texto: "Encerrado" });
  });
  it("presencial: é hoje", () => {
    const p = { tipo: "presencial" as const, inicio: null, fim: null, data: "2026-11-18" };
    expect(situacaoDoEvento(p, "2026-11-18")).toEqual({ fase: "agora", texto: "É hoje" });
  });
  it("dias entre chaves", () => {
    expect(diasEntreChaves("2026-11-28", "2026-12-02")).toEqual(["2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });
});
