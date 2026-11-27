import { describe, expect, it } from "vitest";
import { materializar, PROFISSIONAIS, SEMENTES } from "@/fixtures/desafoga";
import { compararExtra } from "@/lib/finance";
import { formatarReais } from "@/lib/dinheiro";
import { montarContexto } from "./contexto";
import { ESTADO_INICIAL, iniciarRegistro, responder, type ContextoAssistente, type EstadoConversa } from "./conversa";
import { adivinharCategoria, entender, indicaSofrimentoIntenso, lerEmocao, lerNecessidade, nomeDaCompra } from "./entender";
import { NOME_DA_EMOCAO } from "./textos";

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
  orcamentos: ana.orcamentos,
  metas: ana.metas,
  contas: ana.contas,
  pagamentos: ana.pagamentos,
  renda: ana.renda,
  agora: AGORA,
  canal: "whatsapp",
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

  it("lê cada carinha da conversa pelo rótulo do botão", () => {
    expect(NOME_DA_EMOCAO).toEqual({ 1: "Muito triste", 2: "Triste", 3: "Normal", 4: "Feliz", 5: "Muito feliz" });
    for (const [valor, rotulo] of Object.entries(NOME_DA_EMOCAO)) {
      expect(lerEmocao(rotulo)).toBe(Number(valor));
      expect(lerEmocao(rotulo.toLowerCase())).toBe(Number(valor));
    }
  });

  it("não confunde palavra inteira com pedaço de outra", () => {
    // "normal" termina em "mal" e "também" termina em "bem".
    expect(lerEmocao("normal")).toBe(3);
    expect(lerEmocao("tudo normal")).toBe(3);
    expect(lerEmocao("também")).toBeNull();
    // E as palavras soltas continuam valendo.
    expect(lerEmocao("estava mal")).toBe(2);
    expect(lerEmocao("estava bem")).toBe(4);
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
    expect(resultados[0].respostas[0].respostasRapidas).toHaveLength(6);
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

  it("registra várias compras contadas de uma vez com a mesma emoção", () => {
    const inicio = iniciarRegistro([
      { item: "Almoço", valor: 3500, categoria: "Comida pronta" },
      { item: "Uber", valor: 1850 },
    ]);
    expect(inicio.respostas[0].texto).toContain("Anotei 2 compras");
    const emocao = responder(inicio.estado, "4", ctx);
    expect(emocao.respostas[0].texto).toBe("Essas compras eram necessárias?");
    const fim = responder(emocao.estado, "sim", ctx);
    expect(fim.efeitos).toHaveLength(2);
    expect(fim.efeitos[0]).toMatchObject({ compra: { item: "Almoço", categoria: "Comida pronta", emocao: 4, via: "whatsapp" } });
    expect(fim.respostas[0].texto).toContain("• Uber, R$ 18,50");
  });

  it("aceita \"não lembro\" como a pessoa estava: registra sem emoção, sem mexer na nota do dia", () => {
    const inicio = iniciarRegistro([{ item: "Shopee", valor: 8990, categoria: "Outro" }]);
    expect(inicio.respostas[0].respostasRapidas?.map((r) => r.rotulo)).toContain("Não lembro");
    for (const resposta of ["não lembro", "Não lembro", "esqueci", "nem lembro"]) {
      const emocao = responder(inicio.estado, resposta, ctx);
      expect(emocao.estado).toMatchObject({ etapa: "necessidade", emocao: null });
    }
    const fim = responder(responder(inicio.estado, "não lembro", ctx).estado, "sim", ctx);
    expect(fim.efeitos[0]).toMatchObject({ compra: { item: "Shopee", emocao: null, naoLembra: true, necessidade: "sim" } });
    expect(fim.respostas[0].texto).toContain("Você estava: não lembra");
    expect(fim.respostas[0].texto).not.toContain("Sua nota de hoje agora é NaN");
  });

  it("quem acompanha o dinheiro: depois de \"era necessária?\", a Luana pergunta como pagou", () => {
    const comCartao: ContextoAssistente = { ...ctx, acompanhaODinheiro: true, cartoes: [{ id: "nu", nome: "Nubank" }, { id: "it", nome: "Itaú" }] };
    const inicio = iniciarRegistro([{ item: "Tênis", valor: 19990, categoria: "Roupa" }]);
    const nec = responder(responder(inicio.estado, "2", comCartao).estado, "não", comCartao);
    expect(nec.respostas[0].texto).toBe("Como você pagou?");
    expect(nec.respostas[0].respostasRapidas?.map((r) => r.rotulo)).toEqual(["Débito ou Pix", "Dinheiro", "Nubank", "Itaú"]);
    const noCartao = responder(nec.estado, "nubank", comCartao);
    expect(noCartao.efeitos[0]).toMatchObject({ compra: { item: "Tênis", meio: "cartao", cartaoId: "nu" } });
    expect(responder(nec.estado, "pix", comCartao).efeitos[0]).toMatchObject({ compra: { meio: "conta", cartaoId: null } });
    expect(responder(nec.estado, "em dinheiro", comCartao).efeitos[0]).toMatchObject({ compra: { meio: "dinheiro" } });
    // "Cartão" com mais de um cartão: pergunta qual.
    expect(responder(nec.estado, "cartão", comCartao).estado).toMatchObject({ etapa: "pagamento" });
    // Sem acompanhar o dinheiro, registra direto (como antes).
    const semAcompanhar = responder(responder(inicio.estado, "2", ctx).estado, "não", ctx);
    expect(semAcompanhar.efeitos).toHaveLength(1);
  });

  it("pergunta o valor quando faltar e insiste se não entender", () => {
    const { resultados } = conversar("comprei um tênis", "não sei", "199,90");
    expect(resultados[0].respostas[0].texto).toBe("Quanto custou tênis?");
    expect(resultados[1].respostas[0].texto).toContain("Não entendi o valor");
    expect(resultados[2].estado).toMatchObject({ etapa: "emocao", compras: [{ item: "Tênis", valor: 19990 }] });
  });

  it("responde a simulação com os números calculados pelo código", () => {
    const { ultima } = conversar("e se eu pagar 200 a mais?");
    const c = compararExtra(ana.dividas, 20000, "mais-cara");
    expect(c.economiaJuros).not.toBeNull();
    expect(ultima.respostas[0].texto).toContain(formatarReais(c.economiaJuros!));
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

  it("não manda o texto das notas privadas, só a orientação de tom", () => {
    expect(texto).not.toContain("conflito no trabalho");
    expect(texto).toContain("anotações privadas recentes");
  });
});

describe("metas: a transferência já conta na meta", () => {
  it("entende guardei, juntei e transferência para a meta", () => {
    expect(entender("Vou transferir 1k da minha conta para o cofrinho")).toEqual({ tipo: "guardar", valor: 100000 });
    expect(entender("transferi 1000 pro cofinho")).toEqual({ tipo: "guardar", valor: 100000 });
    expect(entender("guardei 50")).toEqual({ tipo: "guardar", valor: 5000 });
    expect(entender("juntei 30,50")).toEqual({ tipo: "guardar", valor: 3050 });
    expect(entender("coloquei 300 na viagem", ["Viagem para a praia"])).toEqual({ tipo: "guardar", valor: 30000 });
    // Transferir para alguém não é guardar.
    expect(entender("transferi 200 pro joão").tipo).not.toBe("guardar");
    expect(entender("comprei pão 12").tipo).toBe("compra");
    expect(entender("minhas metas").tipo).toBe("metas");
  });

  it("com mais de uma meta ativa, pergunta qual (a concluída fica de fora)", () => {
    const r1 = responder(ESTADO_INICIAL, "guardei 50", ctx);
    expect(r1.estado).toEqual({ etapa: "meta", valor: 5000, descricao: "guardei 50" });
    expect(r1.respostas[0].texto).toBe("Boa! Em qual meta você guardou R$ 50?");
    expect(r1.respostas[0].respostasRapidas?.map((r) => r.rotulo)).toEqual(["Reserva de emergência", "Viagem para a praia"]);
    const r2 = responder(r1.estado, "Viagem para a praia", ctx);
    expect(r2.efeitos).toEqual([{ tipo: "guardar-na-meta", metaId: "ana-praia", valor: 5000, descricao: "guardei 50" }]);
    // Tinha R$ 180; agora R$ 230 de R$ 1.500.
    expect(r2.respostas[0].texto).toBe("Anotado ✅ R$ 50 em Viagem para a praia. Agora você tem 15% e faltam R$ 1.270.");
    expect(r2.estado).toEqual(ESTADO_INICIAL);
  });

  it("um movimento só: a transferência citando a meta já conta nela", () => {
    const r = responder(ESTADO_INICIAL, "Vou transferir 1k da minha conta para a reserva", ctx);
    expect(r.efeitos).toEqual([
      { tipo: "guardar-na-meta", metaId: "ana-reserva", valor: 100000, descricao: "Vou transferir 1k da minha conta para a reserva" },
    ]);
    expect(r.respostas[0].texto).toContain("Meta completa: Reserva de emergência");
  });

  it("com uma meta ativa só, vai direto nela", () => {
    const uma = { ...ctx, metas: ctx.metas.filter((m) => m.id !== "ana-praia") };
    expect(responder(ESTADO_INICIAL, "guardei 52", uma).efeitos[0]).toMatchObject({ metaId: "ana-reserva", valor: 5200 });
  });

  it("sem meta ativa, explica como criar", () => {
    const r = responder(ESTADO_INICIAL, "guardei 100", { ...ctx, metas: ctx.metas.filter((m) => m.id === "ana-mae") });
    expect(r.efeitos).toEqual([]);
    expect(r.respostas[0].texto).toBe("Você ainda não tem uma meta ativa. Crie uma na aba Metas e eu acompanho com você.");
  });

  it("nome de meta com símbolos não vira expressão regular", () => {
    const estranha = { ...ctx.metas[0], id: "x", nome: "(a+)+$ [viagem" };
    expect(entender("transferi 100 pro (a+)+$ [viagem", [estranha.nome])).toEqual({ tipo: "guardar", valor: 10000 });
    expect(() => responder(ESTADO_INICIAL, "guardei 10 (a+)+$", { ...ctx, metas: [estranha] })).not.toThrow();
  });

  it("conta como está a meta", () => {
    expect(responder(ESTADO_INICIAL, "minhas metas", ctx).respostas[0].texto).toMatch(/^Sua meta Reserva de emergência está com 27%/);
  });
});

describe("orçamento depois da compra", () => {
  it("diz quanto resta na categoria e o limite por dia", () => {
    let estado = iniciarRegistro([{ item: "Feira", valor: 5000, categoria: "Mercado" }]).estado;
    estado = responder(estado, "3", ctx).estado;
    const r = responder(estado, "Sim", ctx);
    expect(r.respostas[0].texto).toMatch(/Você já utilizou \d+% do seu orçamento de mercado\. Restam R\$ [\d.,]+ até o final do mês\./);
  });

  it("vai para a IA no contexto, com os números do código", () => {
    expect(montarContexto(ctx)).toContain("Ana já usou 53% do orçamento de mercado");
    expect(montarContexto(ctx)).toContain("Presente da mãe: meta R$ 200,00, guardado R$ 200,00 (100%), concluída");
  });
});

describe("contas do mês pela Luana", () => {
  it("entende o pagamento de uma conta", () => {
    expect(entender("paguei luz 87,50")).toEqual({ tipo: "pagar", nome: "Luz", valor: 8750 });
    expect(entender("paguei")).toEqual({ tipo: "pagar", nome: "", valor: null });
  });

  it("paguei luz 87,50 marca a conta de luz com o valor do mês", () => {
    const r = responder(ESTADO_INICIAL, "paguei luz 87,50", ctx);
    expect(r.efeitos).toEqual([{ tipo: "pagar", alvo: "conta", id: "ana-luz", valor: 8750 }]);
    expect(r.respostas[0].texto).toContain("Conta de luz paga, R$ 87,50.");
    expect(r.respostas[0].texto).toContain("Falta pagar");
  });

  it("paguei sozinho marca a próxima que vence e lembra de mandar o valor exato", () => {
    const r = responder(ESTADO_INICIAL, "paguei", ctx);
    expect(r.efeitos).toEqual([{ tipo: "pagar", alvo: "conta", id: "ana-luz", valor: null }]);
    expect(r.respostas[0].texto).toContain("paguei luz 87,50");
  });

  it("paga a parcela de uma dívida pelo nome", () => {
    const r = responder(ESTADO_INICIAL, "paguei o empréstimo", ctx);
    expect(r.efeitos[0]).toMatchObject({ tipo: "pagar", alvo: "divida" });
    expect(r.respostas[0].texto).toContain("Mais um passo no plano!");
  });

  it("sem conta com esse nome, é uma compra", () => {
    const r = responder(ESTADO_INICIAL, "paguei 30 no uber", ctx);
    expect(r.estado).toMatchObject({ etapa: "emocao", compras: [{ item: "Uber", valor: 3000 }] });
    expect(r.efeitos).toEqual([]);
  });

  it("a IA recebe as contas do mês calculadas pelo código", () => {
    const texto = montarContexto(ctx);
    expect(texto).toContain("CONTAS DO MÊS");
    expect(texto).toContain("Renda informada: R$ 2.800,00 por mês.");
  });
});

