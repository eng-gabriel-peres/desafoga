/**
 * Versão local dos serviços: tudo no navegador, sem IA e sem WhatsApp.
 * A Luana responde pelas regras locais. Usada quando
 * NEXT_PUBLIC_DESAFOGA_DADOS=local.
 */
import { FATURA_DE_EXEMPLO, materializarFatura, PROFISSIONAIS } from "@/fixtures/desafoga";
import { montarContexto } from "@/lib/assistente/contexto";
import { conversar } from "@/lib/desafoga/conversar";
import { respostaDaFatura } from "@/lib/desafoga/fatura-lida";
import { normalizarTelefone } from "@/lib/desafoga/telefone";
import type { Servicos } from "../contratos";
import * as n from "../nucleo";
import { aoMudar, esperar, obterBanco, recomecarBanco, salvar } from "./banco";

const copia = <T>(x: T): T => structuredClone(x);
const b = obterBanco;

/** Aplica uma mudança e avisa as telas. */
function mudar<T>(f: () => T): Promise<T> {
  const r = f();
  salvar();
  return Promise.resolve(copia(r));
}

const extratoDeExemplo = () => ({ ...materializarFatura(FATURA_DE_EXEMPLO, new Date()), id: n.novoId("fatura") });

export const servicosLocais: Servicos = {
  pessoas: {
    listar: async () => copia(Object.values(b().pessoas).map((d) => d.persona)),
    obter: async (id) => copia(b().pessoas[id]?.persona ?? null),
    profissionais: async () => copia(PROFISSIONAIS),
    responsavel: async () => copia(n.responsavel()),
    whatsapp: async (id) => b().telefones[id] ?? null,
    async conectarWhatsapp(id, telefone) {
      const numero = normalizarTelefone(telefone);
      if (!numero) throw new Error("Número inválido. Use DDD e número, por exemplo (11) 99999-8888.");
      return mudar(() => (b().telefones[id] = numero));
    },
    desconectarWhatsapp: (id) => mudar(() => void (b().telefones[id] = null)),
  },

  compras: {
    listar: async (id) => copia(n.pessoa(b(), id).compras),
    registrar: (id, nova) => mudar(() => n.registrarCompra(b(), id, nova)),
  },

  dividas: {
    listar: async (id) => copia(n.pessoa(b(), id).dividas),
    plano: async (id) => copia(n.pessoa(b(), id).plano),
    salvarPlano: (id, m) => mudar(() => n.salvarPlano(b(), id, m)),
    async sugerirValor(id, valor) {
      await esperar(400);
      await mudar(() => n.sugerirValor(b(), id, valor));
    },
  },

  faturas: {
    listar: async (id) => copia(n.pessoa(b(), id).faturas),
    async ler() {
      await esperar(300);
      return { fatura: extratoDeExemplo(), deExemplo: true };
    },
    salvar: (id, fatura, c) => mudar(() => n.salvarFatura(b(), id, fatura, c)),
  },

  memoria: {
    obter: async (id) => copia(n.pessoa(b(), id).memoria),
    salvar: (id, m) => mudar(() => n.salvarMemoria(b(), id, m)),
    anotar: (id, nova) => mudar(() => n.anotar(b(), id, nova)),
    apagarAnotacao: (id, notaId) => mudar(() => n.apagarAnotacao(b(), id, notaId)),
  },

  assistente: {
    conversa: async (id) => copia(n.pessoa(b(), id).conversa),
    async enviar(id, texto) {
      n.guardarMensagemDoApp(b(), id, texto);
      salvar();
      await esperar(900);
      const respostas = await conversar(b(), id, "app", texto);
      salvar();
      return copia(respostas);
    },
    async enviarArquivo(id, arquivo) {
      n.pessoa(b(), id).conversa.push(n.mensagem("pessoa", `Arquivo: ${arquivo.name}`));
      salvar();
      await esperar(1200);
      const fatura = extratoDeExemplo();
      n.salvarFatura(b(), id, fatura);
      const dela = n.mensagem(
        "assistente",
        `${respostaDaFatura(fatura, "app")}\n(Demonstração sem IA: li um extrato de exemplo no lugar do arquivo.)`,
      );
      n.pessoa(b(), id).conversa.push(dela);
      salvar();
      return [copia(dela)];
    },
    async enviarAudio(id) {
      await esperar(600);
      const dela = n.mensagem("assistente", "Nesta demonstração estou sem a IA que transcreve áudio. Pode escrever a mensagem?");
      n.pessoa(b(), id).conversa.push(dela);
      salvar();
      return { transcricao: "", respostas: [copia(dela)] };
    },
    async testar(id, texto) {
      await esperar(700);
      const rascunho = copia(b());
      rascunho.estados[id] = { ...rascunho.estados[id], app: { etapa: "livre" } };
      return (await conversar(rascunho, id, "app", texto)).map((r) => r.texto).join("\n\n");
    },
    contexto: async (id) => montarContexto(n.contextoDoAssistente(b(), id, "app")),
  },

  avisos: {
    listar: async (id) => copia(n.avisosDe(b(), id)),
  },

  aoMudar,
  async recomecar() {
    recomecarBanco();
  },
};
