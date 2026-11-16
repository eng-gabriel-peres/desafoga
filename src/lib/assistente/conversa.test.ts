import { describe, expect, it } from "vitest";
import { materializar, PROFISSIONAIS, SEMENTES } from "@/fixtures/desafoga";
import { compararExtra } from "@/lib/finance";
import { formatarReais } from "@/lib/dinheiro";
import { montarContexto } from "./contexto";
import { ESTADO_INICIAL, responder, type ContextoAssistente, type EstadoConversa } from "./conversa";
import { adivinharCategoria, entender, indicaSofrimentoIntenso, lerEmocao, lerNecessidade, nomeDaCompra } from "./entender";

const AGORA = new Date(2026, 10, 16, 15, 0);
const ana = materializar(SEMENTES[0], AGORA);
const ctx: ContextoAssistente = {
  pessoa: ana.persona,
  memoria: ana.memoria,
  profissionais: PROFISSIONAIS,
  responsavel: PROFISSIONAIS[0],
  compras: ana.compras,
  dividas: ana.dividas,
  plano: ana.plano,
  faturas: ana.faturas,
  agora: AGORA,
};

describe("entender a mensagem", () => {
  it("reconhece compra com valor", () => {
    expect(entender("comprei pão 12")).toEqual({ tipo: "compra", item: "Pão", valor: 1200 });
    expect(entender("gastei 140 em maquiagem")).toEqual({ tipo: "compra", item: "Maquiagem", valor: 14000 });
    expect(entender("lanche 32,50")).toEqual({ tipo: "compra", item: "Lanche", valor: 3250 });
  });

  it("reconhece compra sem valor", () => {
    expect(entender("comprei um tênis")).toEqual({ tipo: "compra", item: "Tênis", valor: null });
  });

  it("reconhece simulação, plano, juros e resumo", () => {
    expect(entender("e se eu pagar 200 a mais?")).toEqual({ tipo: "extra", valor: 20000 });
    expect(entender("Plano")).toEqual({ tipo: "plano" });
    expect(entender("quanto eu pago de juros?")).toEqual({ tipo: "juros" });
    expect(entender("resumo")).toEqual({ tipo: "resumo" });
  });

  it("o resto é conversa livre", () => {
    expect(entender("tô triste hoje, foi um dia difícil no trabalho")).toEqual({ tipo: "livre" });
    expect(entender("tô com vontade de comprar uma roupa")).toEqual({ tipo: "vontade-de-comprar" });
  });

  it("detecta sofrimento intenso sem confundir com desabafo comum", () => {
    expect(indicaSofrimentoIntenso("às vezes penso em me matar")).toBe(true);
    expect(indicaSofrimentoIntenso("Não quero mais viver assim")).toBe(true);
    expect(indicaSofrimentoIntenso("não aguento mais essa fatura")).toBe(false);
  });

  it("lê emoção, necessidade, nome e categoria", () => {
    expect(lerEmocao("2")).toBe(2);
    expect(lerEmocao("Muito feliz")).toBe(5);
    expect(lerEmocao("sei lá")).toBeNull();
    expect(lerNecessidade("Não sei")).toBe("talvez");
    expect(lerNecessidade("não")).toBe("nao");
    expect(lerNecessidade("Sim")).toBe("sim");
    expect(nomeDaCompra("comprei um tênis de corrida 399")).toBe("Tênis de corrida");
    expect(nomeDaCompra("gastei 140 em maquiagem")).toBe("Maquiagem");
    expect(nomeDaCompra("comprei 50")).toBe("Compra");
    expect(adivinharCategoria("Pão")).toBe("Mercado");
    expect(adivinharCategoria("Fone")).toBe("Outro");
  });
});

describe("conversa da Luana", () => {
  function conversar(...mensagens: string[]) {
    let estado: EstadoConversa = ESTADO_INICIAL;
    const resultados = mensagens.map((m) => {
      const r = responder(estado, m, ctx);
      estado = r.estado;
      return r;
    });
    return { estado, resultados, ultima: resultados.at(-1)! };
  }

  it("registra a compra perguntando emoção e necessidade", () => {
    const { resultados, ultima, estado } = conversar("comprei pão 12", "3", "Sim");
    expect(resultados[0].respostas[0].respostasRapidas).toHaveLength(5);
    expect(resultados[1].respostas[0].texto).toBe("Essa compra era necessária?");
    expect(ultima.efeitos).toEqual([
      {
        tipo: "registrar-compra",
        compra: { item: "Pão", categoria: "Mercado", valor: 1200, emocao: 3, necessidade: "sim", via: "whatsapp" },
      },
    ]);
    expect(ultima.respostas[0].texto).toContain("Anotado: Pão, R$ 12,00.");
    expect(ultima.respostas[0].texto).toContain("Sua nota de hoje agora é");
    expect(estado).toEqual(ESTADO_INICIAL);
  });

  it("pergunta o valor quando faltar e insiste se não entender", () => {
    const { resultados } = conversar("comprei um tênis", "não sei", "199,90");
    expect(resultados[0].respostas[0].texto).toBe("Quanto custou tênis?");
    expect(resultados[1].respostas[0].texto).toContain("Não entendi o valor");
    expect(resultados[2].estado).toMatchObject({ etapa: "emocao", valor: 19990 });
  });

  it("responde a simulação com os números calculados pelo código", () => {
    const { ultima } = conversar("e se eu pagar 200 a mais?");
    const c = compararExtra(ana.dividas, 20000, "mais-cara");
    expect(ultima.respostas[0].texto).toContain(formatarReais(c.economiaJuros));
    expect(ultima.respostas[0].texto).toContain(`${c.comExtra.meses} meses`);
    expect(ultima.respostas[0].texto).toContain("Simulação educativa");
  });

  it("mostra o plano sem o total de juros para quem se assusta com números grandes", () => {
    const { ultima } = conversar("plano");
    expect(ultima.respostas[0].texto).toContain("Seu plano: pagar R$ 1.100,00 por mês");
    expect(ultima.respostas[0].texto).not.toContain("de juros até lá");
  });

  it("acolhe a mensagem livre usando a memória", () => {
    const { ultima } = conversar("tô triste hoje");
    expect(ultima.respostas[0].texto).toContain("Sinto muito");
    expect(ultima.respostas[0].texto).toContain("me chama antes");
  });

  it("em sofrimento intenso, indica CVV e SAMU, avisa o responsável e interrompe o registro", () => {
    const { ultima, estado } = conversar("comprei pão 12", "não quero mais viver");
    expect(ultima.respostas[0].texto).toContain("188");
    expect(ultima.respostas[0].texto).toContain("192");
    expect(ultima.respostas[0].texto).toContain("Paula Reis");
    expect(ultima.efeitos[0]).toMatchObject({ tipo: "avisar-responsavel", aviso: { tipo: "sofrimento" } });
    expect(estado).toEqual(ESTADO_INICIAL);
  });
});

describe("contexto da assistente", () => {
  const texto = montarContexto(ctx);

  it("junta memória, tom e números do sistema", () => {
    expect(texto).toContain("Tom: Acolhedor");
    expect(texto).toContain("Compra quando está triste");
    expect(texto).toContain("Sair do rotativo do cartão até fevereiro");
    expect(texto).toContain("Marcos Andrade (Economista)");
    expect(texto).toContain("NÚMEROS DO SISTEMA");
    expect(texto).toContain("Cartão de crédito (R$ 1.850,00, 14,2% ao mês");
  });

  it("separa as notas privadas com a instrução de nunca mencionar", () => {
    expect(texto).toContain("NOTAS PRIVADAS");
    expect(texto).toContain("conflito no trabalho");
  });
});
