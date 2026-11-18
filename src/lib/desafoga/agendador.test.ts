import { describe, expect, it } from "vitest";
import { AVISOS_PADRAO, type CheckIn, type Compra, type ContaFixa, type Divida, type Meta, type Pagamento, type Rotina } from "@/lib/finance";
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
  config: AVISOS_PADRAO,
  compras: [],
  dividas: [],
  plano: { valorMensal: 0, estrategia: "mais-cara" },
  ...extra,
});

let n = 0;
/** Compra em Brasília no dia e hora dados. */
const compra = (diaHora: string, extra: Partial<Compra> = {}): Compra =>
  ({ id: `c${n++}`, item: "x", categoria: "Mercado", valor: 1000, emocao: 4, necessidade: "sim", quando: new Date(`${diaHora}:00-03:00`).toISOString(), via: "app", avaliacaoProfissional: null, ...extra }) as Compra;

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

describe("lembrete diário", () => {
  const ligado = { ...AVISOS_PADRAO, lembreteDiario: true, horaDoLembrete: "21:00" };
  it("no horário escolhido (até 1 hora depois), com as compras de hoje; desligado, nada", () => {
    const d = dados({ config: ligado, compras: [compra("2026-11-18T10:00", { valor: 2500, emocao: 2 }), compra("2026-11-17T10:00")] });
    expect(tipos(em("20:55"), d)).toEqual([]);
    const [e] = enviosDoMomento(d, em("21:10"));
    expect(e.chave).toBe("diario:p:2026-11-18");
    expect(e.texto).toMatch(/Lembrete das 21:00\nHoje você registrou 1 compra, total de R\$ 25,00/);
    expect(tipos(em("21:10"), dados({ compras: d.compras }))).toEqual([]);
  });
});

describe("resumo da semana", () => {
  // 22/11/2026 é domingo.
  const domingo = (hora: string) => new Date(`2026-11-22T${hora}:00-03:00`);
  const semana = [compra("2026-11-20T10:00", { valor: 5000, emocao: 2, necessidade: "nao" }), compra("2026-11-18T10:00", { valor: 3000, emocao: 4 }), compra("2026-11-10T10:00")];

  it("domingo a partir das 19h: para a pessoa no chat e um aviso para quem acompanha", () => {
    expect(enviosDoMomento(dados({ compras: semana }), domingo("18:30"))).toEqual([]);
    const [e] = enviosDoMomento(dados({ compras: semana }), domingo("19:05"));
    expect(e.chave).toBe("semana:p:2026-11-22");
    expect(e.texto).toMatch(/Seu resumo da semana\n2 compras, total de R\$ 80,00\.\nNota média: 3,0/);
    expect(e.texto).toMatch(/Não necessárias: 1/);
    expect(e.paraQuemAcompanha).toBe("Resumo da semana de Ana: 2 compras, R$ 80,00, nota média 3,0, 1 não necessária.");
  });

  it("em outro dia, ou desligado, nada", () => {
    expect(tipos(em("19:30"), dados({ compras: semana }))).toEqual([]);
    expect(enviosDoMomento(dados({ compras: semana, config: { ...AVISOS_PADRAO, resumoDaSemana: false } }), domingo("19:05"))).toEqual([]);
  });
});

describe("parcela da dívida pelo plano", () => {
  const divida = { id: "d1", tipo: "cartao", nome: "Cartão Nubank", detalhe: "", saldo: 300000, taxaMensal: 0.1, parcelaMinima: 30000, vencimento: 19 } as Divida;
  it("um dia antes do vencimento, com o valor do plano; já paga, nada", () => {
    const d = dados({ dividas: [divida], plano: { valorMensal: 50000, estrategia: "mais-cara" } });
    const e = enviosDoMomento(d, em("09:30")).find((x) => x.chave.startsWith("parcela"))!;
    expect(e.chave).toBe("parcela:p:d1:2026-11");
    expect(e.texto).toMatch(/Amanhã vence Cartão Nubank\.\nPelo seu plano, pague R\$ 500,00/);
    const paga: Pagamento = { tipo: "divida", alvoId: "d1", mes: "2026-11", valor: 50000, quando: "2026-11-17T10:00:00-03:00" };
    expect(tipos(em("09:30"), { ...d, pagamentos: [paga] })).toEqual([]);
  });
});
