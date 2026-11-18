import { describe, expect, it } from "vitest";
import type { CheckIn, ContaFixa, Meta, Pagamento, Rotina } from "@/lib/finance";
import { autorizadoNoAgendador, enviosDoMomento, type DadosDoAgendador } from "./agendador";

/** 18/11/2026 em Brasília, na hora pedida. */
const em = (hora: string) => new Date(`2026-11-18T${hora}:00-03:00`);

const rotina: Rotina = {
  horarios: { manha: "08:00", tarde: "12:00", noite: "20:00" },
  ligados: { manha: true, tarde: true, noite: false },
  avisarQuandoTriste: true,
  compartilharContas: true,
};

const conta = (extra: Partial<ContaFixa> = {}): ContaFixa =>
  ({ id: "luz", nome: "Conta de luz", categoria: "luz", valor: 9500, vencimento: 19, variavel: true, debitoAutomatico: false, lembrete: true, ...extra }) as ContaFixa;

const meta = (extra: Partial<Meta> = {}): Meta =>
  ({
    id: "m1",
    nome: "Viagem",
    icone: "plane",
    cor: "azul",
    alvo: 150000,
    inicial: 0,
    modo: "valor",
    frequencia: "semana",
    valorPorPeriodo: 5000,
    prazo: null,
    criadaEm: "2026-11-04",
    lembrete: true,
    depositos: [],
    ...extra,
  }) as Meta;

const dados = (extra: Partial<DadosDoAgendador> = {}): DadosDoAgendador => ({
  pessoaId: "p",
  apelido: "Ana",
  rotina,
  checkins: [],
  contas: [],
  pagamentos: [],
  metas: [],
  ...extra,
});

const tipos = (agora: Date, d = dados()) => enviosDoMomento(d, agora).map((e) => e.chave);

describe("check-ins", () => {
  it("manda no horário (até 1 hora depois, o agendador do GitHub atrasa), só nos períodos ligados", () => {
    expect(tipos(em("07:59"))).toEqual([]);
    expect(tipos(em("08:10"))).toEqual(["checkin:p:2026-11-18:manha"]);
    expect(tipos(em("08:50"))).toEqual(["checkin:p:2026-11-18:manha"]);
    expect(tipos(em("09:00"))).toEqual([]);
    expect(tipos(em("20:05"))).toEqual([]);
  });

  it("não pergunta o que a pessoa já respondeu", () => {
    const respondido: CheckIn = { dia: "2026-11-18", periodo: "tarde", humor: 3, quando: "2026-11-18T11:50:00-03:00" };
    expect(tipos(em("12:05"), dados({ checkins: [respondido] }))).toEqual([]);
  });

  it("o texto é a pergunta do check-in", () => {
    expect(enviosDoMomento(dados(), em("08:10"))[0].texto).toMatch(/Bom dia, Ana/);
  });
});

describe("contas", () => {
  it("lembra um dia antes, a partir das 9h, se o lembrete está ligado e ainda não foi paga", () => {
    const d = dados({ contas: [conta()] });
    expect(tipos(em("08:50"), d).filter((c) => c.startsWith("conta"))).toEqual([]);
    expect(tipos(em("09:05"), d)).toContain("conta:p:luz:2026-11");
    expect(enviosDoMomento(d, em("09:05")).find((e) => e.chave.startsWith("conta"))!.texto).toMatch(/Conta de luz.*amanhã/);
    expect(tipos(em("09:05"), dados({ contas: [conta({ lembrete: false })] }))).not.toContain("conta:p:luz:2026-11");
    const paga: Pagamento = { tipo: "conta", alvoId: "luz", mes: "2026-11", valor: 9500, quando: "2026-11-15T10:00:00-03:00" };
    expect(tipos(em("09:05"), dados({ contas: [conta()], pagamentos: [paga] }))).not.toContain("conta:p:luz:2026-11");
  });

  it("não manda de madrugada nem tarde da noite", () => {
    expect(tipos(em("21:30"), dados({ contas: [conta()] }))).toEqual([]);
  });

  it("débito automático não precisa de lembrete", () => {
    expect(tipos(em("09:05"), dados({ contas: [conta({ debitoAutomatico: true })] }))).toEqual([]);
  });
});

describe("metas", () => {
  it("semanal: no mesmo dia da semana em que foi criada, a partir das 10h", () => {
    // 04/11 e 18/11 são quartas-feiras.
    expect(tipos(em("10:05"), dados({ metas: [meta()] }))).toContain("meta:p:m1:2026-11-18");
    expect(tipos(em("09:55"), dados({ metas: [meta()] }))).not.toContain("meta:p:m1:2026-11-18");
    expect(tipos(em("10:05"), dados({ metas: [meta({ criadaEm: "2026-11-05" })] }))).toEqual([]);
  });

  it("mensal no mesmo dia do mês; diária todo dia; sem lembrete ou concluída, nada", () => {
    expect(tipos(em("10:05"), dados({ metas: [meta({ frequencia: "mes", criadaEm: "2026-10-18" })] }))).toContain("meta:p:m1:2026-11-18");
    expect(tipos(em("10:05"), dados({ metas: [meta({ frequencia: "dia" })] }))).toContain("meta:p:m1:2026-11-18");
    expect(tipos(em("10:05"), dados({ metas: [meta({ lembrete: false })] }))).toEqual([]);
    // Já guardou hoje: não precisa lembrar.
    const hoje = { id: "h", valor: 5000, descricao: "", quando: "2026-11-18T07:00:00-03:00", via: "app" as const };
    expect(tipos(em("10:05"), dados({ metas: [meta({ depositos: [hoje] })] }))).toEqual([]);
    // No dia em que foi criada, ainda não.
    expect(tipos(em("10:05"), dados({ metas: [meta({ frequencia: "dia", criadaEm: "2026-11-18" })] }))).toEqual([]);
    expect(tipos(em("10:05"), dados({ metas: [meta({ inicial: 150000, depositos: [{ id: "d", valor: 150000, descricao: "", quando: "2026-11-04T10:00:00-03:00", via: "app" }] })] }))).toEqual([]);
  });
});

describe("quem pode chamar o agendador", () => {
  it("só com o segredo certo no cabeçalho; sem segredo configurado, ninguém", () => {
    expect(autorizadoNoAgendador("Bearer abc123", "abc123")).toBe(true);
    expect(autorizadoNoAgendador("Bearer abc124", "abc123")).toBe(false);
    expect(autorizadoNoAgendador("abc123", "abc123")).toBe(false);
    expect(autorizadoNoAgendador(null, "abc123")).toBe(false);
    expect(autorizadoNoAgendador("Bearer ", "")).toBe(false);
    expect(autorizadoNoAgendador("Bearer undefined", undefined)).toBe(false);
  });
});
