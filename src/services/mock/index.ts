/**
 * Implementação simulada dos serviços, sobre os dados fictícios. Nada sai do
 * navegador. Para ligar no backend, basta outra implementação de `Servicos`.
 */
import { FATURA_DE_EXEMPLO, materializarFatura, PROFISSIONAIS, RESPONSAVEL_DA_DEMO } from "@/fixtures/pausa";
import { montarContexto } from "@/lib/assistente/contexto";
import { ESTADO_INICIAL, responder, type ContextoAssistente, type Efeito } from "@/lib/assistente/conversa";
import { reais } from "@/lib/assistente/textos";
import type { Servicos } from "../contratos";
import type { Aviso, Compra, Mensagem, NovaCompra, Profissional } from "../tipos";
import { aoMudar, esperar, novoId, obterBanco, pessoa, recomecarBanco, salvar } from "./banco";

/** A partir deste valor, o responsável recebe um aviso de compra alta. */
const COMPRA_ALTA = 20000;

const responsavel = (): Profissional => PROFISSIONAIS.find((p) => p.id === RESPONSAVEL_DA_DEMO) ?? PROFISSIONAIS[0];
const copia = <T>(x: T): T => structuredClone(x);

function avisar(pessoaId: string, tipo: Aviso["tipo"], texto: string) {
  pessoa(pessoaId).avisos.unshift({ id: novoId("aviso"), pessoaId, tipo, texto, quando: new Date().toISOString() });
}

function guardarCompra(pessoaId: string, nova: NovaCompra, quando = new Date().toISOString()): Compra {
  const dados = pessoa(pessoaId);
  const compra: Compra = { ...nova, id: novoId("compra"), quando, avaliacaoProfissional: null };
  dados.compras.push(compra);
  if (compra.valor >= COMPRA_ALTA) {
    avisar(pessoaId, "gasto-alto", `${dados.persona.apelido} registrou uma compra de ${reais(compra.valor)} (${compra.item}).`);
  }
  return compra;
}

function mensagem(de: Mensagem["de"], texto: string, extra: Partial<Mensagem> = {}): Mensagem {
  return { id: novoId("msg"), de, texto, quando: new Date().toISOString(), ...extra };
}

function contexto(pessoaId: string): ContextoAssistente {
  const d = pessoa(pessoaId);
  return {
    pessoa: d.persona,
    memoria: d.memoria,
    profissionais: PROFISSIONAIS,
    responsavel: responsavel(),
    compras: d.compras,
    dividas: d.dividas,
    plano: d.plano,
    faturas: d.faturas,
    agora: new Date(),
  };
}

function aplicar(pessoaId: string, efeito: Efeito) {
  if (efeito.tipo === "registrar-compra") guardarCompra(pessoaId, efeito.compra);
  else avisar(pessoaId, efeito.aviso.tipo, efeito.aviso.texto);
}

export const servicosSimulados: Servicos = {
  pessoas: {
    listar: async () => copia(Object.values(obterBanco().pessoas).map((d) => d.persona)),
    obter: async (id) => copia(obterBanco().pessoas[id]?.persona ?? null),
    profissionais: async () => copia(PROFISSIONAIS),
    responsavel: async () => copia(responsavel()),
  },

  compras: {
    listar: async (id) => copia(pessoa(id).compras),
    async registrar(id, nova) {
      const compra = guardarCompra(id, nova);
      salvar();
      return copia(compra);
    },
  },

  dividas: {
    listar: async (id) => copia(pessoa(id).dividas),
    plano: async (id) => copia(pessoa(id).plano),
    async salvarPlano(id, mudancas) {
      const dados = pessoa(id);
      dados.plano = { ...dados.plano, ...mudancas };
      salvar();
      return copia(dados.plano);
    },
    async sugerirValor(id, valor) {
      await esperar(400);
      const dados = pessoa(id);
      dados.plano.valorSugerido = valor;
      avisar(id, "sugestao", `${responsavel().nome} sugeriu pagar ${reais(valor)} por mês nas dívidas.`);
      dados.conversa.push(
        mensagem(
          "assistente",
          `${responsavel().nome} sugeriu pagar ${reais(valor)} por mês nas dívidas. Quer ver como fica? Abra Dívidas ou me escreva: plano.`,
        ),
      );
      salvar();
    },
  },

  faturas: {
    listar: async (id) => copia(pessoa(id).faturas),
    async ler() {
      await esperar(300);
      return { ...materializarFatura(FATURA_DE_EXEMPLO, new Date()), id: novoId("fatura") };
    },
    async salvar(id, fatura, classificacoes) {
      const dados = pessoa(id);
      const lancamentos = fatura.lancamentos.map((l) => {
        const c = classificacoes[l.id];
        if (l.tipo !== "compra" || l.compraId || !c?.emocao || !c.necessidade) return l;
        const compra = guardarCompra(
          id,
          {
            item: l.descricao.charAt(0) + l.descricao.slice(1).toLowerCase(),
            categoria: l.categoria ?? "Outro",
            valor: l.valor,
            emocao: c.emocao,
            necessidade: c.necessidade,
            via: "fatura",
          },
          new Date(`${l.data}T12:00:00`).toISOString(),
        );
        return { ...l, compraId: compra.id };
      });
      dados.faturas.push({ ...fatura, lancamentos });
      salvar();
    },
  },

  memoria: {
    obter: async (id) => copia(pessoa(id).memoria),
    async salvar(id, mudancas) {
      const dados = pessoa(id);
      dados.memoria = { ...dados.memoria, ...mudancas };
      salvar();
      return copia(dados.memoria);
    },
    async anotar(id, nova) {
      const anotacao = { ...nova, id: novoId("nota"), quando: new Date().toISOString() };
      pessoa(id).memoria.anotacoes.push(anotacao);
      salvar();
      return copia(anotacao);
    },
    async apagarAnotacao(id, anotacaoId) {
      const memoria = pessoa(id).memoria;
      memoria.anotacoes = memoria.anotacoes.filter((a) => a.id !== anotacaoId);
      salvar();
    },
  },

  assistente: {
    conversa: async (id) => copia(pessoa(id).conversa),
    async enviar(id, texto) {
      const banco = obterBanco();
      const dados = pessoa(id);
      dados.conversa.forEach((m) => delete m.respostasRapidas);
      dados.conversa.push(mensagem("pessoa", texto));
      salvar();

      await esperar(900);
      const resultado = responder(banco.conversas[id] ?? ESTADO_INICIAL, texto, contexto(id));
      banco.conversas[id] = resultado.estado;
      resultado.efeitos.forEach((e) => aplicar(id, e));
      const respostas = resultado.respostas.map((r) =>
        mensagem("assistente", r.texto, r.respostasRapidas ? { respostasRapidas: r.respostasRapidas } : {}),
      );
      dados.conversa.push(...respostas);
      salvar();
      return copia(respostas);
    },
    async testar(id, texto) {
      await esperar(700);
      return responder(ESTADO_INICIAL, texto, contexto(id)).respostas.map((r) => r.texto).join("\n\n");
    },
    contexto: async (id) => montarContexto(contexto(id)),
  },

  avisos: {
    async listar(id) {
      const todas = id ? [pessoa(id)] : Object.values(obterBanco().pessoas);
      return copia(todas.flatMap((d) => d.avisos).sort((a, b) => b.quando.localeCompare(a.quando)));
    },
  },

  aoMudar,
  async recomecar() {
    recomecarBanco();
  },
};
