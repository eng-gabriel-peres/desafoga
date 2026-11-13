import { describe, expect, it } from "vitest";
import { analisarCompra, blocoDeCompra } from "./compra";
import { PERGUNTA, proximaPergunta, pular, registrarResposta } from "./entrevista";
import type { Lancamento } from "./lancamentos";
import { acompanhar, informar } from "./plano";
import { type Conta, resumir } from "./resumo";
import { blocoDoPlano, blocoDoPlanoPara } from "./textos";

const HOJE = "2026-11-12";

const gasto = (valor: number, categoria: Lancamento["categoria"], extra: Partial<Lancamento> = {}): Lancamento => ({
  data: HOJE,
  descricao: "x",
  valor,
  natureza: "compra",
  categoria,
  parcela: null,
  ...extra,
});

const conta = (extra: Partial<Conta> = {}): Conta => ({
  lancamentos: [],
  rendaMensal: null,
  saldoEmConta: null,
  fatura: null,
  ...extra,
});

const PLANO = informar(undefined, [
  { descricao: "Aluguel", valor: "1.500", categoria: "moradia_e_contas" },
  { descricao: "Luz", valor: "200", categoria: "moradia_e_contas" },
  { descricao: "Mercado", valor: "800", categoria: "mercado" },
  { descricao: "Cartão", valor: "2 mil", categoria: "cartao" },
]).plano;

describe("informar", () => {
  it("guarda as despesas em centavos", () => {
    expect(PLANO.itens.map((i) => i.valor)).toEqual([150000, 20000, 80000, 200000]);
  });

  it("troca o valor de uma despesa já informada, sem diferenciar acento e maiúscula", () => {
    const r = informar(PLANO, [{ descricao: "cartao", valor: "2500", categoria: "cartao" }]);
    expect(r.plano.itens).toHaveLength(4);
    expect(r.plano.itens.find((i) => i.grupo === "cartao")?.valor).toBe(250000);
  });

  it("tira a despesa informada com valor zero e ignora o que não tem valor", () => {
    const r = informar(PLANO, [
      { descricao: "luz", valor: "0", categoria: "moradia_e_contas" },
      { descricao: "academia", valor: "não sei", categoria: "assinaturas" },
    ]);
    expect(r.removidos).toEqual(["Luz"]);
    expect(r.anotados).toEqual([]);
    expect(r.plano.itens.map((i) => i.descricao)).toEqual(["Aluguel", "Mercado", "Cartão"]);
  });
});

describe("acompanhar", () => {
  it("não existe sem despesas informadas", () => {
    expect(acompanhar(undefined, [])).toBeNull();
    expect(acompanhar({ itens: [] }, [gasto(1000, "mercado")])).toBeNull();
  });

  it("sem nada anotado, o que deve sair é o previsto", () => {
    expect(acompanhar(PLANO, [])).toMatchObject({ previsto: 450000, esperado: 450000, foraDoPlano: 0 });
  });

  it("abate o gasto anotado do previsto da categoria, sem somar de novo", () => {
    const a = acompanhar(PLANO, [gasto(62000, "mercado")]);
    expect(a?.linhas.find((l) => l.grupo === "mercado")).toMatchObject({ previsto: 80000, realizado: 62000, esperado: 80000 });
    expect(a?.esperado).toBe(450000);
  });

  it("quando o anotado passa do previsto, vale o anotado", () => {
    const a = acompanhar(PLANO, [gasto(95000, "mercado")]);
    expect(a?.esperado).toBe(450000 + 15000);
  });

  it("o cartão recebe os gastos de categorias sem previsão própria", () => {
    const a = acompanhar(PLANO, [gasto(3500, "alimentacao"), gasto(12000, "lazer"), gasto(5000, "mercado")]);
    expect(a?.linhas.find((l) => l.grupo === "cartao")).toMatchObject({ realizado: 15500, esperado: 200000 });
    expect(a?.foraDoPlano).toBe(0);
    expect(a?.esperado).toBe(450000);
  });

  it("a fatura enviada depois substitui a estimativa do cartão em vez de somar", () => {
    const a = acompanhar(PLANO, [gasto(230000, "compras"), gasto(4000, "juros" as never, { natureza: "juros" })]);
    expect(a?.linhas.find((l) => l.grupo === "cartao")?.esperado).toBe(230000);
    expect(a?.encargos).toBe(4000);
    expect(a?.esperado).toBe(170000 + 80000 + 230000 + 4000);
  });

  it("sem item de cartão, o gasto sem previsão soma por fora", () => {
    const semCartao = { itens: PLANO.itens.filter((i) => i.grupo !== "cartao") };
    expect(acompanhar(semCartao, [gasto(9000, "lazer")])).toMatchObject({ foraDoPlano: 9000, esperado: 250000 + 9000 });
  });
});

describe("resumo com plano", () => {
  it("a sobra do mês considera o previsto e deixa o guardado de fora", () => {
    const r = resumir(conta({ rendaMensal: 600000, plano: PLANO, reserva: 1000000, lancamentos: [gasto(62000, "mercado")] }), HOJE);
    expect(r.poupanca).toMatchObject({ sobraDoMes: 150000, comPrevisao: true });
    expect(r.reserva).toBe(1000000);
    const texto = blocoDoPlano(r) ?? "";
    expect(texto).toContain("Mercado: previsto R$ 800,00, já foram R$ 620,00, restam R$ 180,00");
    expect(texto).toContain("Casa e contas fixas (aluguel, luz): R$ 1.700,00");
    expect(texto).toContain("*Sobra prevista: R$ 1.500,00*");
    expect(texto).toContain("Guardado à parte: R$ 10.000,00");
  });

  it("depois de um gasto, mostra só a linha do previsto que mexeu", () => {
    const novos = [gasto(3500, "alimentacao")];
    const r = resumir(conta({ plano: PLANO, lancamentos: novos }), HOJE);
    const texto = blocoDoPlanoPara(r, novos) ?? "";
    expect(texto).toContain("Cartão: previsto R$ 2.000,00, já foram R$ 35,00");
    expect(texto).not.toContain("Mercado");
  });

  it("sem plano, nada muda", () => {
    const r = resumir(conta({ rendaMensal: 400000, lancamentos: [gasto(100000, "mercado")] }), HOJE);
    expect(r.plano).toBeNull();
    expect(r.poupanca).toMatchObject({ sobraDoMes: 300000, comPrevisao: false });
    expect(blocoDoPlano(r)).toBeNull();
  });
});

describe("posso comprar com plano e reserva", () => {
  const pedido = { item: "celular", valorTotal: 300000, parcela: null, numeroDeParcelas: null, compromissosCitados: 0 };

  it("usa o previsto como contas do mês e não mexe na reserva", () => {
    const c = conta({ rendaMensal: 600000, plano: PLANO, reserva: 1000000 });
    const a = analisarCompra(pedido, c, resumir(c, HOJE));
    expect(a).toMatchObject({ saidas: 450000, origemDasSaidas: "previstas", sobra: 150000, veredito: "junte_antes", mesesParaJuntar: 2 });
    const texto = blocoDeCompra(a);
    expect(texto).toContain("o que você previu, mais o que já anotei");
    expect(texto).toContain("a reserva cairia para R$ 7.000,00");
  });

  it("avisa que a reserva ficou de fora quando ela não cobre a compra", () => {
    const c = conta({ rendaMensal: 600000, plano: PLANO, reserva: 100000 });
    expect(blocoDeCompra(analisarCompra(pedido, c, resumir(c, HOJE)))).toContain("ficaram fora desta conta");
  });
});

describe("entrevista", () => {
  it("pergunta uma coisa por vez, pula o que já foi contado e termina", () => {
    const c = conta({ rendaMensal: 600000, entrevista: { perguntadas: [], pendente: null } });
    expect(proximaPergunta(c)).toBe(PERGUNTA.fixas);
    expect(c.entrevista?.pendente).toBe("fixas");
    c.plano = PLANO;
    registrarResposta(c, { renda: false, despesas: PLANO.itens, reserva: false });
    expect(proximaPergunta(c)).toBe(PERGUNTA.reserva);
    pular(c);
    expect(proximaPergunta(c)).toBeNull();
    expect(c.entrevista).toMatchObject({ pendente: null, concluida: true });
  });

  it("não repete a pergunta que a pessoa pulou", () => {
    const c = conta({ entrevista: { perguntadas: [], pendente: null } });
    expect(proximaPergunta(c)).toBe(PERGUNTA.renda);
    pular(c);
    expect(proximaPergunta(c)).toBe(PERGUNTA.fixas);
  });

  it("volta à pergunta quando a resposta se perdeu e a mensagem seguinte falou de outra coisa", () => {
    const c = conta({ entrevista: { perguntadas: [], pendente: null } });
    expect(proximaPergunta(c)).toBe(PERGUNTA.renda);
    // A resposta da renda não chegou; a pessoa já mandou as contas fixas.
    const fixas = PLANO.itens.filter((i) => i.grupo === "moradia_e_contas");
    c.plano = { itens: fixas };
    registrarResposta(c, { renda: false, despesas: fixas, reserva: false });
    expect(proximaPergunta(c)).toBe(PERGUNTA.renda);
    c.rendaMensal = 500000;
    registrarResposta(c, { renda: true, despesas: [], reserva: false });
    expect(proximaPergunta(c)).toBe(PERGUNTA.variaveis);
  });

  it("não começa sozinha", () => {
    expect(proximaPergunta(conta())).toBeNull();
  });
});
