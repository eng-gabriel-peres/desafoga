/**
 * Ações da API do Desafoga (POST /api/desafoga/<acao>). Cada ação valida os
 * argumentos, confere a permissão da sessão (acesso.ts) e só então lê ou
 * grava. Os nomes seguem os contratos de `services/contratos.ts`.
 */
import { z } from "zod";
import { montarContexto } from "@/lib/assistente/contexto";
import type { Fatura } from "@/services/tipos";
import { exigirAPropriaPessoa, exigirProfissionalDe, exigirSessao, exigirVer, SemPermissao } from "./acesso";
import { responderTexto, testarResposta } from "./acoes";
import { enviarPeloWhatsapp, whatsappConfigurado } from "./enviar";
import * as repo from "./repositorio";
import {
  aceitarConvite,
  apagarConta,
  criarConta,
  encerrarSessao,
  entrarNaDemo,
  recomecarDemo,
  type NovaSessao,
  type PerfilDaDemo,
  type SessaoAtual,
} from "./sessao";
import { cancelarPedido, conectarPorLink, confirmarCodigo, desconectar, pedirCodigo, PedidoRecusado } from "./vinculo-whatsapp";

const id = z.string().uuid();
const centavos = z.number().int().min(0).max(1e10);
const emocao = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const necessidade = z.enum(["sim", "nao", "talvez"]);
const categoria = z.enum(["Mercado", "Roupa", "Comida pronta", "Farmácia", "Casa", "Lazer", "Presente", "Outro"]);
const texto = (max: number) => z.string().trim().min(1).max(max);

const lancamento = z.object({
  id: z.string().max(80),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descricao: z.string().max(200),
  valor: centavos,
  tipo: z.enum(["compra", "juros", "iof", "tarifa", "assinatura", "pagamento"]),
  categoria: categoria.optional(),
  compraId: z.string().max(80).nullable().optional(),
});
const fatura = z.object({
  id: z.string().max(80),
  tipo: z.enum(["fatura", "extrato"]),
  origem: z.string().max(120),
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  lancamentos: z.array(lancamento).max(500),
});

export class ErroDeEntrada extends Error {}

/** O que a rota sabe de quem chamou. */
export interface Contexto {
  /** Hash do endereço de rede, que o cliente não escolhe. */
  rede: string | null;
  sessao: SessaoAtual | null;
  /** Troca o cookie da sessão (entrar, criar conta, sair). */
  definirSessao: (nova: NovaSessao | null) => void;
}

type Recurso = "texto" | "arquivo" | "audio" | "codigo" | "conta";

function acao<A extends z.ZodTypeAny, R>(argumentos: A, executar: (args: z.infer<A>, ctx: Contexto) => Promise<R>, recurso?: Recurso) {
  return { argumentos, executar, recurso };
}

/** Converte a recusa do vínculo do WhatsApp em erro de entrada (mensagem para a pessoa). */
async function comRecusa<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    if (e instanceof PedidoRecusado) throw new ErroDeEntrada(e.message);
    throw e;
  }
}

const ACOES = {
  // ----- sessão -----
  "sessao.eu": acao(z.tuple([]), async (_, { sessao }) => {
    if (!sessao) return null;
    return { ...sessao, acompanhantes: sessao.pessoa ? await repo.acompanhantes(sessao.pessoa.id) : [] };
  }),
  // Criar demo e conta grava dezenas de linhas: entra no limite por rede e no global.
  "sessao.entrarNaDemo": acao(
    z.tuple([z.enum(["ana", "carlos", "lucia", "rafael", "paula", "marcos"])]),
    async ([perfil], ctx) => {
      ctx.definirSessao(await entrarNaDemo(perfil as PerfilDaDemo, ctx.sessao));
    },
    "conta",
  ),
  "sessao.criarConta": acao(
    z.tuple([
      z.discriminatedUnion("tipo", [
        z.object({ tipo: z.literal("pessoa"), nome: texto(80), apelido: texto(40), idade: z.number().int().min(14).max(120).nullable() }),
        z.object({ tipo: z.literal("profissional"), nome: texto(80), papel: texto(60) }),
      ]),
    ]),
    async ([conta], ctx) => {
      ctx.definirSessao(await criarConta(conta, ctx.sessao));
    },
    "conta",
  ),
  "sessao.sair": acao(z.tuple([]), async (_, ctx) => {
    if (ctx.sessao) await encerrarSessao(ctx.sessao.id);
    ctx.definirSessao(null);
  }),
  "sessao.aceitarConvite": acao(
    z.tuple([z.string().trim().min(4).max(12)]),
    async ([convite], { sessao }) => {
      const s = exigirSessao(sessao);
      if (!s.pessoa) throw new SemPermissao("Só a pessoa acompanhada aceita um convite.");
      const p = await aceitarConvite(s.pessoa.id, s.espacoId, convite);
      if (!p) throw new ErroDeEntrada("Código de convite não encontrado. Confira com quem te acompanha.");
      return p;
    },
    "codigo",
  ),
  "sessao.apagarConta": acao(z.tuple([]), async (_, ctx) => {
    await apagarConta(exigirSessao(ctx.sessao));
    ctx.definirSessao(null);
  }),
  recomecar: acao(
    z.tuple([]),
    async (_, ctx) => {
      const s = exigirSessao(ctx.sessao);
      if (!s.demo) throw new SemPermissao("Só a demonstração pode ser recomeçada.");
      ctx.definirSessao(await recomecarDemo(s));
    },
    // Recomeçar cria um espaço novo: mesmo limite de criar conta e demo.
    "conta",
  ),

  // ----- pessoas -----
  "pessoas.listar": acao(z.tuple([]), async (_, { sessao }) => {
    const s = exigirSessao(sessao);
    if (s.profissional) return repo.acompanhados(s.profissional.id);
    return s.pessoa ? [s.pessoa] : [];
  }),
  "pessoas.obter": acao(z.tuple([id]), async ([p], { sessao }) => {
    await exigirVer(sessao, p);
    return repo.persona(p);
  }),
  "pessoas.profissionais": acao(z.tuple([id]), async ([p], { sessao }) => {
    await exigirVer(sessao, p);
    return repo.acompanhantes(p);
  }),
  "pessoas.whatsapp": acao(z.tuple([id]), async ([p], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    return repo.telefone(p);
  }),
  "pessoas.conectarWhatsapp": acao(
    z.tuple([id, texto(30)]),
    async ([p, tel], { sessao, rede }) => {
      exigirAPropriaPessoa(sessao, p);
      // Desenvolvimento sem WhatsApp configurado: não há como mandar nem receber, o código aparece na tela.
      const semWhatsapp = !whatsappConfigurado() && process.env.NODE_ENV !== "production";
      const pedido = await comRecusa(() => pedirCodigo({ pessoaId: p, rede }, tel, { exigirContato: !semWhatsapp }));
      if (!pedido) throw new ErroDeEntrada("Número inválido. Use DDD e número, por exemplo (11) 99999-8888.");
      if (semWhatsapp) return { telefone: pedido.telefone, codigoDeTeste: pedido.codigo };
      try {
        await enviarPeloWhatsapp(
          pedido.telefone,
          `Seu código do Desafoga é ${pedido.codigo}. Digite no app para conectar este WhatsApp. Se não foi você, ignore esta mensagem.`,
        );
      } catch (e) {
        await cancelarPedido(p, pedido);
        console.error("Desafoga: código não enviado,", e instanceof Error ? e.message.slice(0, 200) : "erro");
        throw new ErroDeEntrada(
          "Não consegui mandar o código para esse WhatsApp. Confira o número e mande antes um “oi” para a Luana por ele (no sandbox da Twilio, a mensagem de entrada “join”).",
        );
      }
      return { telefone: pedido.telefone, codigoDeTeste: null };
    },
    "texto",
  ),
  "pessoas.confirmarWhatsapp": acao(
    z.tuple([id, z.string().regex(/^\s*\d{6}\s*$/)]),
    async ([p, codigo], { sessao, rede }) => {
      exigirAPropriaPessoa(sessao, p);
      return comRecusa(() => confirmarCodigo({ pessoaId: p, rede }, codigo));
    },
    "codigo",
  ),
  "pessoas.conectarWhatsappPorLink": acao(
    z.tuple([id, z.string().min(10).max(600)]),
    async ([p, codigo], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      return comRecusa(() => conectarPorLink(p, codigo));
    },
    "codigo",
  ),
  "pessoas.desconectarWhatsapp": acao(z.tuple([id]), async ([p], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await desconectar(p);
  }),

  // ----- compras e dívidas -----
  "compras.listar": acao(z.tuple([id]), async ([p], { sessao }) => {
    await exigirVer(sessao, p);
    return repo.compras(p);
  }),
  "compras.registrar": acao(
    z.tuple([id, z.object({ item: texto(80), categoria, valor: centavos.min(1), emocao, necessidade, via: z.enum(["app", "whatsapp", "fatura"]) })]),
    async ([p, nova], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      return repo.registrarCompra(p, nova);
    },
  ),
  "dividas.listar": acao(z.tuple([id]), async ([p], { sessao }) => {
    await exigirVer(sessao, p);
    return repo.dividas(p);
  }),
  "dividas.salvar": acao(
    z.tuple([
      id,
      z.object({
        id: id.optional(),
        tipo: z.enum(["cartao", "cheque", "emprestimo", "parcelamento", "outra"]),
        nome: texto(80),
        detalhe: z.string().max(120),
        saldo: centavos.min(1),
        /** Fração ao mês: 0,142 = 14,2%. Até 50% ao mês. */
        taxaMensal: z.number().min(0).max(0.5),
        parcelaMinima: centavos,
        vencimento: z.number().int().min(1).max(31),
      }),
    ]),
    async ([p, d], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      return repo.salvarDivida(p, d);
    },
  ),
  "dividas.remover": acao(z.tuple([id, id]), async ([p, d], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await repo.removerDivida(p, d);
  }),
  "dividas.plano": acao(z.tuple([id]), async ([p], { sessao }) => {
    await exigirVer(sessao, p);
    return repo.plano(p);
  }),
  "dividas.salvarPlano": acao(
    z.tuple([id, z.object({ valorMensal: centavos.optional(), estrategia: z.enum(["mais-cara", "menor"]).optional() })]),
    async ([p, m], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      return repo.salvarPlano(p, m);
    },
  ),
  "dividas.sugerirValor": acao(z.tuple([id, centavos.min(1)]), async ([p, valor], { sessao }) => {
    const s = await exigirProfissionalDe(sessao, p);
    await repo.sugerirValor(p, valor, s.profissional);
  }),

  // ----- faturas -----
  "faturas.listar": acao(z.tuple([id]), async ([p], { sessao }) => {
    await exigirVer(sessao, p);
    return repo.faturas(p);
  }),
  "faturas.salvar": acao(
    z.tuple([id, fatura, z.record(z.string(), z.object({ emocao: emocao.optional(), necessidade: necessidade.optional() }))]),
    async ([p, f, c], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      await repo.salvarFatura(p, f as Fatura, c);
    },
  ),

  // ----- memória (profissionais) -----
  "memoria.obter": acao(z.tuple([id]), async ([p], { sessao }) => {
    await exigirProfissionalDe(sessao, p);
    return repo.memoria(p, true);
  }),
  "memoria.salvar": acao(
    z.tuple([
      id,
      z.object({
        caracteristicas: z.array(texto(80)).max(40).optional(),
        tom: z.enum(["acolhedor", "direto", "motivador"]).optional(),
        objetivo: z.string().max(300).optional(),
        evitar: z.string().max(600).optional(),
      }),
    ]),
    async ([p, m], { sessao }) => {
      await exigirProfissionalDe(sessao, p);
      await repo.salvarMemoria(p, m);
      return repo.memoria(p, true);
    },
  ),
  "memoria.anotar": acao(z.tuple([id, z.object({ texto: texto(2000), privada: z.boolean() })]), async ([p, n], { sessao }) => {
    // O autor é sempre quem está na sessão: o navegador não escolhe em nome de quem anota.
    const s = await exigirProfissionalDe(sessao, p);
    return repo.anotar(p, { autorId: s.profissional.id, texto: n.texto, privada: n.privada });
  }),
  "memoria.apagarAnotacao": acao(z.tuple([id, id]), async ([p, n], { sessao }) => {
    // Só quem escreveu apaga a própria anotação.
    const s = await exigirProfissionalDe(sessao, p);
    if (!(await repo.apagarAnotacao(p, n, s.profissional.id))) throw new SemPermissao("Só quem escreveu a anotação pode apagá-la.");
  }),

  // ----- assistente -----
  "assistente.conversa": acao(z.tuple([id]), async ([p], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    return repo.conversa(p, "app");
  }),
  "assistente.enviar": acao(
    z.tuple([id, texto(1000)]),
    async ([p, t], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      return responderTexto(p, "app", t);
    },
    "texto",
  ),
  "assistente.testar": acao(
    z.tuple([id, texto(1000)]),
    async ([p, t], { sessao }) => {
      await exigirProfissionalDe(sessao, p);
      return testarResposta(p, t);
    },
    "texto",
  ),
  "assistente.contexto": acao(z.tuple([id]), async ([p], { sessao }) => {
    await exigirProfissionalDe(sessao, p);
    return montarContexto(await repo.contextoDoAssistente(p, "app"));
  }),

  // ----- avisos -----
  "avisos.listar": acao(z.tuple([]), async (_, { sessao }) => {
    const s = exigirSessao(sessao);
    // A pessoa vê as sugestões que recebeu; o profissional, os avisos de quem acompanha.
    if (s.pessoa) return repo.avisos([s.pessoa.id], { apenas: ["sugestao"] });
    if (s.profissional) return repo.avisos((await repo.acompanhados(s.profissional.id)).map((x) => x.id), { exceto: ["sugestao"] });
    return [];
  }),
  "avisos.daPessoa": acao(z.tuple([id]), async ([p], { sessao }) => {
    await exigirProfissionalDe(sessao, p);
    return repo.avisos([p], { exceto: ["sugestao"] });
  }),
};

export type NomeDaAcao = keyof typeof ACOES;

export function acaoExiste(nome: string): nome is NomeDaAcao {
  return Object.hasOwn(ACOES, nome);
}

export function recursoDa(nome: NomeDaAcao): Recurso | undefined {
  return ACOES[nome].recurso;
}

/** Valida os argumentos e executa a ação. */
export async function executar(nome: NomeDaAcao, args: unknown, contexto: Contexto): Promise<unknown> {
  const a = ACOES[nome];
  const lidos = a.argumentos.safeParse(Array.isArray(args) ? args : []);
  if (!lidos.success) throw new ErroDeEntrada("Argumentos inválidos.");
  return (a.executar as (args: unknown, c: Contexto) => Promise<unknown>)(lidos.data, contexto);
}
