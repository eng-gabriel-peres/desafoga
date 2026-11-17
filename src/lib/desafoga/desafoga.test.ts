import { describe, expect, it } from "vitest";
import { materializar, PROFISSIONAIS, SEMENTES } from "@/fixtures/desafoga";
import { ESTADO_INICIAL, type EstadoConversa } from "@/lib/assistente/conversa";
import type { DocumentoLido, MensagemLida } from "@/lib/luana/ler";
import type { Aviso, Compra, Mensagem } from "@/services/tipos";
import { conversar, paraWhatsapp, type Canal, type DadosDaConversa, type IaDaConversa } from "./conversar";
import { paraFatura, respostaDaFatura } from "./fatura-lida";
import { normalizarTelefone, telefoneLegivel } from "./telefone";

const AGORA = new Date(2026, 10, 16, 15, 0);

const leitura = (m: Partial<MensagemLida>): MensagemLida => ({
  intencao: "outro",
  lancamentos: [],
  rendaMensal: null,
  saldoEmConta: null,
  reserva: null,
  despesasMensais: [],
  compra: null,
  compromissosCitados: [],
  transcricao: null,
  ...m,
});

function iaFalsa(lida: MensagemLida, texto = "Resposta da IA"): IaDaConversa & { sistemas: string[] } {
  const sistemas: string[] = [];
  return {
    sistemas,
    lerMensagem: async () => lida,
    redigir: async (sistema) => {
      sistemas.push(sistema);
      return texto;
    },
  };
}

/** A conversa da Ana com os dados em memória (o servidor usa o banco). */
function anaEmMemoria() {
  const d = materializar(SEMENTES[0], AGORA);
  const estados: Record<Canal, EstadoConversa> = { app: ESTADO_INICIAL, whatsapp: ESTADO_INICIAL };
  const mensagens: Record<Canal, Mensagem[]> = { app: [...d.conversa], whatsapp: [] };
  const compras: Compra[] = [...d.compras];
  const avisos: Aviso[] = [...d.avisos];
  const metas = d.metas.map((m) => ({ ...m, depositos: [...m.depositos] }));
  const pagamentos = [...d.pagamentos];
  const dados: DadosDaConversa = {
    contexto: async (_p, canal, agora) => ({
      pessoa: d.persona,
      memoria: d.memoria,
      profissionais: PROFISSIONAIS,
      responsavel: PROFISSIONAIS[0],
      compras,
      dividas: d.dividas,
      plano: d.plano,
      faturas: d.faturas,
      orcamentos: d.orcamentos,
      metas,
      contas: d.contas,
      pagamentos,
      renda: d.renda,
      agora,
      canal,
    }),
    estado: async (_p, canal) => estados[canal],
    conversaRecente: async (_p, canal) => mensagens[canal].map((m) => `${m.de === "pessoa" ? "Pessoa" : "Luana"}: ${m.texto}`).join("\n"),
    async concluir(_p, canal, resultado, agora) {
      for (const e of resultado.efeitos) {
        if (e.tipo === "registrar-compra") compras.push({ ...e.compra, id: `nova-${compras.length}`, quando: agora.toISOString(), avaliacaoProfissional: null });
        else if (e.tipo === "pagar") {
          const c = d.contas.find((x) => x.id === e.id);
          pagamentos.push({ tipo: e.alvo, alvoId: e.id, mes: agora.toISOString().slice(0, 7), valor: e.valor ?? c?.valor ?? 0, quando: agora.toISOString() });
        } else if (e.tipo === "guardar-na-meta") {
          metas.find((m) => m.id === e.metaId)?.depositos.push({ id: `v${Date.now()}`, valor: e.valor, descricao: e.descricao, quando: agora.toISOString(), via: canal });
        }
        else avisos.unshift({ id: `aviso-${avisos.length}`, pessoaId: "ana", tipo: e.aviso.tipo, texto: e.aviso.texto, quando: agora.toISOString() });
      }
      estados[canal] = resultado.estado;
      const novas = resultado.respostas.map((r, i): Mensagem => ({ id: `m${i}`, de: "assistente", texto: r.texto, quando: agora.toISOString(), respostasRapidas: r.respostasRapidas }));
      mensagens[canal].push(...novas);
      return novas;
    },
  };
  return { dados, compras, avisos, estados, mensagens, metas };
}

describe("telefone do cadastro", () => {
  it("guarda só dígitos, com 55 e nono dígito", () => {
    expect(normalizarTelefone("(11) 99999-8888")).toBe("5511999998888");
    expect(normalizarTelefone("+55 11 9999-8888")).toBe("5511999998888");
    expect(normalizarTelefone("5511999998888")).toBe("5511999998888");
    expect(normalizarTelefone("123")).toBeNull();
    expect(telefoneLegivel("5511999998888")).toBe("(11) 99999-8888");
  });
});

describe("conversa da Luana com IA", () => {
  it("usa a IA para ler vários gastos e pergunta a emoção uma vez", async () => {
    const ana = anaEmMemoria();
    const ia = iaFalsa(
      leitura({
        intencao: "registrar_gasto",
        lancamentos: [
          { data: null, descricao: "almoço", valor: "35", natureza: "compra", categoria: "alimentacao", parcela: null },
          { data: null, descricao: "uber", valor: "18,50", natureza: "compra", categoria: "transporte", parcela: null },
        ],
      }),
    );
    const antes = ana.compras.length;
    const [pergunta] = await conversar(ana.dados, "ana", "whatsapp", "almoço 35 e uber 18,50", { ia, agora: AGORA });
    expect(pergunta.texto).toContain("Anotei 2 compras");
    await conversar(ana.dados, "ana", "whatsapp", "2", { ia, agora: AGORA });
    const [fim] = await conversar(ana.dados, "ana", "whatsapp", "não", { ia, agora: AGORA });
    expect(fim.texto).toContain("• Almoço, R$ 35,00");
    expect(ana.compras.slice(antes).map((c) => [c.item, c.categoria, c.emocao, c.necessidade, c.via])).toEqual([
      ["Almoço", "Comida pronta", 2, "nao", "whatsapp"],
      ["Uber", "Outro", 2, "nao", "whatsapp"],
    ]);
  });

  it("conversa livre vai para a IA com a memória e os números do sistema, sem as notas privadas", async () => {
    const ana = anaEmMemoria();
    const ia = iaFalsa(leitura({ intencao: "outro" }), "Tô aqui com você.");
    const [r] = await conversar(ana.dados, "ana", "app", "tô me sentindo pra baixo", { ia, agora: AGORA });
    expect(r.texto).toBe("Tô aqui com você.");
    expect(ia.sistemas[0]).toContain("Compra quando está triste");
    expect(ia.sistemas[0]).toContain("NÚMEROS DO SISTEMA");
    expect(ia.sistemas[0]).not.toContain("conflito no trabalho");
  });

  it("simulação e sofrimento não passam pela IA", async () => {
    const ana = anaEmMemoria();
    const ia = iaFalsa(leitura({}));
    const [sim] = await conversar(ana.dados, "ana", "app", "e se eu pagar 200 a mais?", { ia, agora: AGORA });
    expect(sim.texto).toContain("Simulação educativa");
    const [crise] = await conversar(ana.dados, "ana", "whatsapp", "não quero mais viver", { ia, agora: AGORA });
    expect(crise.texto).toContain("188");
    expect(ana.avisos[0].tipo).toBe("sofrimento");
    expect(ia.sistemas).toHaveLength(0);
  });

  it("sem IA, ou com a IA fora do ar, as regras respondem", async () => {
    const ana = anaEmMemoria();
    const quebrada: IaDaConversa = {
      lerMensagem: async () => {
        throw new Error("fora do ar");
      },
      redigir: async () => "",
    };
    const [r] = await conversar(ana.dados, "ana", "app", "comprei pão 12", { ia: quebrada, agora: AGORA });
    expect(r.respostasRapidas).toHaveLength(5);
  });

  it("as conversas do app e do WhatsApp são separadas", async () => {
    const ana = anaEmMemoria();
    await conversar(ana.dados, "ana", "whatsapp", "comprei pão 12", { agora: AGORA });
    const [noApp] = await conversar(ana.dados, "ana", "app", "2", { agora: AGORA });
    expect(noApp.texto).not.toContain("Essa compra era necessária");
    expect(ana.estados.whatsapp.etapa).toBe("emocao");
  });

  it("no WhatsApp as respostas rápidas viram opções numeradas", () => {
    expect(paraWhatsapp({ texto: "Como estava?", respostasRapidas: [{ rotulo: "Triste", emocao: 2 }] })).toBe("Como estava?\n\n2 - Triste");
  });
});

describe("fatura lida pela IA", () => {
  const doc: DocumentoLido = {
    legivel: true,
    tipo: "fatura_cartao",
    emissor: "Banco Exemplo",
    vencimento: null,
    total: null,
    pagamentoMinimo: null,
    taxaRotativoMensal: null,
    saldoEmConta: null,
    dataBase: null,
    contratos: [],
    lancamentos: [
      { data: "2026-11-12", descricao: "LOJA ONLINE MODA", valor: "320,00", natureza: "compra", categoria: "compras", parcela: null },
      { data: "2026-11-10", descricao: "PERFUMARIA", valor: "189,90", natureza: "compra", categoria: "compras", parcela: null },
      { data: "2026-11-09", descricao: "STREAMING", valor: "39,90", natureza: "compra", categoria: "assinaturas", parcela: null },
      { data: null, descricao: "ENCARGOS ROTATIVO", valor: "187,44", natureza: "juros", categoria: "outros", parcela: null },
      { data: null, descricao: "IOF", valor: "9,12", natureza: "iof", categoria: "outros", parcela: null },
      { data: null, descricao: "SALDO ANTERIOR", valor: "1.000,00", natureza: "saldo_anterior", categoria: "outros", parcela: null },
    ],
  };

  it("converte valores, separa assinaturas e liga compras já registradas", () => {
    const compras = materializar(SEMENTES[0], AGORA).compras;
    const f = paraFatura(doc, compras, AGORA, "f1");
    expect(f.tipo).toBe("fatura");
    expect(f.lancamentos.map((l) => l.tipo)).toEqual(["compra", "compra", "assinatura", "juros", "iof"]);
    expect(f.lancamentos[0].compraId).toBe("ana-c4");
    expect(f.lancamentos[1].compraId).toBeNull();
    expect(respostaDaFatura(f, "whatsapp")).toContain("*R$ 196,56*");
  });
});
