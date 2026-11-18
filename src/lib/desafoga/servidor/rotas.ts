/**
 * Ações da API do Desafoga (POST /api/desafoga/<acao>). Cada ação valida os
 * argumentos, confere a permissão da sessão (acesso.ts) e só então lê ou
 * grava. Os nomes seguem os contratos de `services/contratos.ts`.
 */
import { z } from "zod";
import { montarContexto } from "@/lib/assistente/contexto";
import { avisoDeCheckInTriste, mensagemDeIncentivo, mensagemDeLembrete, NOME_DA_EMOCAO, perguntaDoCheckIn, respostaDoCheckIn } from "@/lib/assistente/textos";
import { situacaoDaMeta, type Meta } from "@/lib/finance";
import type { Classificacao, Fatura } from "@/services/tipos";
import { exigirAPropriaPessoa, exigirProfissionalDe, exigirSessao, exigirVer, SemPermissao } from "./acesso";
import { responderTexto, testarResposta } from "./acoes";
import { checkInJaPerguntado } from "./agendador";
import { salvarDocumento } from "./documentos";
import * as banco from "./banco-acoes";
import { enviarPeloWhatsapp, whatsappConfigurado } from "./enviar";
import { registros } from "./registros";
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
import { cancelarPedido, confirmarCodigo, desconectar, desistirDoPedido, pedirCodigo, PedidoRecusado } from "./vinculo-whatsapp";

const id = z.string().uuid();

/** Um incentivo ou lembrete por meta a cada intervalo: evita encher o WhatsApp de alguém. */
async function respeitarIntervalo(chave: string, intervaloMs: number, mensagem: string): Promise<void> {
  const ultimo = (await registros().ler(chave)) as number | null;
  if (ultimo && Date.now() - ultimo < intervaloMs) throw new ErroDeEntrada(mensagem);
  await registros().gravar(chave, Date.now());
}

/** Manda pelo WhatsApp conectado da pessoa, se houver; falha não derruba o pedido. */
async function tentarWhatsapp(pessoaId: string, texto: string): Promise<boolean> {
  const numero = await repo.telefone(pessoaId);
  if (!numero || !whatsappConfigurado()) return false;
  return enviarPeloWhatsapp(numero, texto).then(
    () => true,
    (e: unknown) => {
      console.error("Desafoga: WhatsApp não enviado,", e instanceof Error ? e.message.slice(0, 200) : "erro");
      return false;
    },
  );
}
const centavos = z.number().int().min(0).max(1e10);
const emocao = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const necessidade = z.enum(["sim", "nao", "talvez"]);
const categoria = z.enum(["Mercado", "Roupa", "Comida pronta", "Farmácia", "Casa", "Lazer", "Presente", "Outro"]);
const texto = (max: number) => z.string().trim().min(1).max(max);
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const periodo = z.enum(["manha", "tarde", "noite"]);
const tipoDePagamento = z.enum(["conta", "divida"]);

const lancamento = z.object({
  id: z.string().max(80),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descricao: z.string().max(200),
  valor: centavos,
  tipo: z.enum(["compra", "juros", "iof", "tarifa", "assinatura", "pagamento", "parcela_emprestimo"]),
  categoria: categoria.optional(),
  compraId: z.string().max(80).nullable().optional(),
  parcela: z.number().int().min(1).max(999).optional(),
  totalParcelas: z.number().int().min(2).max(999).optional(),
});
const fatura = z.object({
  id: z.string().max(80),
  tipo: z.enum(["fatura", "extrato"]),
  origem: z.string().max(120),
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  lancamentos: z.array(lancamento).max(500),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  total: centavos.nullable().optional(),
  pagamentoMinimo: centavos.nullable().optional(),
  taxaRotativoMensal: z.number().min(0).max(1).nullable().optional(),
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

type Recurso = "texto" | "arquivo" | "audio" | "codigo" | "conta" | "envio";

function acao<A extends z.ZodTypeAny, R>(argumentos: A, executar: (args: z.infer<A>, ctx: Contexto) => Promise<R>, recurso?: Recurso) {
  return { argumentos, executar, recurso };
}

/** Fatura ou extrato enviado; o cartão conectado escolhido tem que ser desta pessoa. */
async function salvarFaturaDaPessoa(p: string, f: Fatura, c: Record<string, Classificacao>, contaId: string | null) {
  const conta = contaId ? (await repo.conexoes(p)).flatMap((x) => x.contas).find((x) => x.id === contaId && x.tipo === "cartao") : null;
  if (contaId && !conta) throw new ErroDeEntrada("Cartão não encontrado.");
  return salvarDocumento(p, f, c, conta?.id ?? null);
}

/**
 * Contas, renda, faturas, dívidas, plano e banco: quem acompanha só vê se a pessoa
 * deixou (Rotina e privacidade). Confere o acesso e diz se é para esconder.
 */
/** Saldo de investimento é dado de banco: sem as contas compartilhadas, a meta mostra só os depósitos. */
const metasSemBanco = (metas: Meta[]): Meta[] => metas.map((m) => ({ ...m, investimentos: undefined, guardadoPeloBanco: null }));

/** Quem olha o evento: a pessoa ou o profissional da sessão. */
function quemNoEvento(sessao: SessaoAtual | null): repo.Quem {
  const s = exigirSessao(sessao);
  if (s.pessoa) return { pessoaId: s.pessoa.id };
  if (s.profissional) return { profissionalId: s.profissional.id };
  throw new SemPermissao("Entre para ver os eventos.");
}

function profissionalDaSessao(sessao: SessaoAtual | null): string {
  const s = exigirSessao(sessao);
  if (!s.profissional) throw new SemPermissao("Só quem organiza o evento pode fazer isso.");
  return s.profissional.id;
}

const diaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function escondido(sessao: SessaoAtual | null, pessoaId: string): Promise<boolean> {
  const s = await exigirVer(sessao, pessoaId);
  return s.pessoa?.id !== pessoaId && !(await repo.rotina(pessoaId)).compartilharContas;
}

/** Recusa das ações do banco vira erro de entrada (mensagem para a pessoa). */
async function doBanco<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    if (e instanceof banco.RecusaDoBanco) throw new ErroDeEntrada(e.message);
    throw e;
  }
}

/** Avisos do banco que são para a própria pessoa agir (registrar compra, conferir dívida): não vão para o painel. */
const AVISOS_DA_PESSOA = ["compra-banco", "divida-encontrada", "limite-cartao", "consentimento", "seguro"];

const modoCompras = z.enum(["revisar", "automatico", "desligado"]);
const campoDaDivida = z.enum(["saldo", "taxaMensal", "parcelaMinima", "parcelasRestantes"]);
/** Limites de cada campo corrigido: os mesmos das travas (taxa até 30% ao mês, até 480 parcelas inteiras). */
const LIMITE_DO_CAMPO = {
  saldo: centavos,
  parcelaMinima: centavos,
  taxaMensal: z.number().min(0).max(0.3),
  parcelasRestantes: z.number().int().min(1).max(480),
} as const;
const correcoesDaDivida = z.object(LIMITE_DO_CAMPO).partial().strict();
const chave = z.string().min(1).max(200);

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
      const telefone = await comRecusa(() => confirmarCodigo({ pessoaId: p, rede }, codigo));
      // O dono do número fica sabendo da conexão e pode desfazer pelo próprio WhatsApp.
      // Texto fixo: aviso de segurança não leva nada digitado por usuário.
      if (whatsappConfigurado()) {
        await enviarPeloWhatsapp(
          telefone,
          "Pronto! Este WhatsApp foi conectado a uma conta do Desafoga. Se não foi você que pediu, responda: desconectar",
        ).catch((e: unknown) => console.error("Desafoga: aviso de conexão não enviado,", e instanceof Error ? e.message.slice(0, 200) : "erro"));
      }
      return telefone;
    },
    "codigo",
  ),
  "pessoas.desistirDoWhatsapp": acao(z.tuple([id]), async ([p], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await desistirDoPedido(p);
  }),
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
    if (await escondido(sessao, p)) return [];
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
    if (await escondido(sessao, p)) return { valorMensal: 0, estrategia: "mais-cara", valorSugerido: null };
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
    if (!(await repo.rotina(p)).compartilharContas) throw new SemPermissao("A pessoa não compartilhou as dívidas.");
    await repo.sugerirValor(p, valor, s.profissional);
  }),

  // ----- rotina e check-ins -----
  "rotina.obter": acao(z.tuple([id]), async ([p], { sessao }) => {
    await exigirVer(sessao, p);
    const [rotina, checkins] = await Promise.all([repo.rotina(p), repo.checkins(p)]);
    return { rotina, checkins };
  }),
  "rotina.salvar": acao(
    z.tuple([
      id,
      z.object({
        horarios: z.object({ manha: hora.optional(), tarde: hora.optional(), noite: hora.optional() }).optional(),
        ligados: z.object({ manha: z.boolean().optional(), tarde: z.boolean().optional(), noite: z.boolean().optional() }).optional(),
        avisarQuandoTriste: z.boolean().optional(),
        compartilharContas: z.boolean().optional(),
      }),
    ]),
    async ([p, m], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      return repo.salvarRotina(p, m);
    },
  ),
  // Responder pelo app: a pergunta, a resposta e o retorno da Luana ficam também no chat, como no WhatsApp.
  "rotina.responder": acao(z.tuple([id, periodo, z.number().int().min(1).max(5)]), async ([p, periodoDoDia, n], { sessao }) => {
    const s = exigirAPropriaPessoa(sessao, p);
    const humor = n as 1 | 2 | 3 | 4 | 5;
    const apelido = s.pessoa?.apelido ?? "";
    const [rotina, memoria] = await Promise.all([repo.rotina(p), repo.memoria(p, false)]);
    await repo.responderCheckIn(p, periodoDoDia, humor);
    const resposta = respostaDoCheckIn(apelido, periodoDoDia, humor, memoria.caracteristicas, memoria.objetivo);
    if (humor <= 2 && rotina.avisarQuandoTriste) await repo.avisar(p, "checkin", avisoDeCheckInTriste(apelido, periodoDoDia, humor));
    // Se o agendador já mandou a pergunta no chat, não repete.
    const perguntou = await checkInJaPerguntado(p, periodoDoDia);
    await repo.guardarMensagens(p, "app", [
      ...(perguntou ? [] : [{ de: "assistente" as const, texto: perguntaDoCheckIn(apelido, periodoDoDia) }]),
      { de: "pessoa", texto: NOME_DA_EMOCAO[humor] },
      { de: "assistente", texto: resposta },
    ]);
    return { resposta };
  }),

  // ----- contas do mês -----
  "contas.listar": acao(z.tuple([id]), async ([p], { sessao }) => {
    const s = await exigirVer(sessao, p);
    // O profissional só vê as contas e a renda se a pessoa deixou (Rotina e privacidade).
    if (s.pessoa?.id !== p && !(await repo.rotina(p)).compartilharContas) {
      return { compartilhadas: false, contas: [], pagamentos: [], renda: null };
    }
    const [contas, pagamentos, renda] = await Promise.all([repo.contasFixas(p), repo.pagamentos(p), repo.renda(p)]);
    return { compartilhadas: true, contas, pagamentos, renda };
  }),
  "contas.salvar": acao(
    z.tuple([
      id,
      z.object({
        id: id.optional(),
        nome: texto(60),
        categoria: z.enum(["moradia", "luz", "agua", "internet", "transporte", "saude", "educacao", "assinatura", "outra"]),
        valor: centavos.min(1),
        vencimento: z.number().int().min(1).max(31),
        variavel: z.boolean(),
        debitoAutomatico: z.boolean(),
        lembrete: z.boolean(),
      }),
    ]),
    async ([p, c], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      return repo.salvarConta(p, c);
    },
  ),
  "contas.remover": acao(z.tuple([id, id]), async ([p, c], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await repo.removerConta(p, c);
  }),
  "contas.pagar": acao(z.tuple([id, tipoDePagamento, id, centavos.min(1).nullable()]), async ([p, tipo, alvo, valor], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await repo.pagar(p, tipo, alvo, valor);
  }),
  "contas.desfazer": acao(z.tuple([id, tipoDePagamento, id]), async ([p, tipo, alvo], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await repo.desfazerPagamento(p, tipo, alvo);
  }),
  "contas.salvarRenda": acao(
    z.tuple([id, z.object({ valor: centavos.min(1), dia: z.number().int().min(1).max(31) }).nullable()]),
    async ([p, r], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      await repo.salvarRenda(p, r);
    },
  ),

  // ----- orçamento e metas -----
  "orcamentos.listar": acao(z.tuple([id]), async ([p], { sessao }) => {
    await exigirVer(sessao, p);
    return repo.orcamentos(p);
  }),
  "orcamentos.salvar": acao(z.tuple([id, categoria, centavos]), async ([p, c, limite], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    return repo.salvarOrcamento(p, c, limite);
  }),
  "metas.listar": acao(z.tuple([id]), async ([p], { sessao }) => {
    const s = await exigirVer(sessao, p);
    const metas = await repo.metas(p);
    if (s.pessoa?.id !== p && !(await repo.rotina(p)).compartilharContas) return metasSemBanco(metas);
    return metas;
  }),
  "metas.salvar": acao(
    z.tuple([
      id,
      z.object({
        id: id.optional(),
        nome: texto(60),
        icone: z.enum(["piggy-bank", "shield", "plane", "home", "car", "graduation-cap", "gift", "smartphone", "heart"]),
        cor: z.enum(["azul", "amarelo", "coral", "violeta", "petroleo"]),
        alvo: centavos.min(1),
        inicial: centavos,
        modo: z.enum(["prazo", "valor"]),
        frequencia: z.enum(["dia", "semana", "mes"]),
        valorPorPeriodo: centavos,
        prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        lembrete: z.boolean(),
      }),
    ]),
    async ([p, m], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      return repo.salvarMeta(p, m);
    },
  ),
  "metas.remover": acao(z.tuple([id, id]), async ([p, m], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await repo.removerMeta(p, m);
  }),
  /** Dinheiro guardado: a transferência é registrada uma vez só e já conta na meta. */
  "metas.guardar": acao(
    z.tuple([id, id, z.object({ valor: centavos.min(1), descricao: z.string().trim().max(120) })]),
    async ([p, m, dep], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      return repo.guardarNaMeta(p, m, { ...dep, via: "app" });
    },
  ),
  "metas.apagarDeposito": acao(z.tuple([id, id, id]), async ([p, m, d], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    return repo.apagarDeposito(p, m, d);
  }),
  /** O profissional manda um incentivo: chega pela Luana no app e, se der, no WhatsApp. */
  "metas.incentivar": acao(
    z.tuple([id, id]),
    async ([p, m], { sessao }) => {
      const s = await exigirProfissionalDe(sessao, p);
      const meta = await repo.metaPorId(p, m);
      await respeitarIntervalo(`incentivo:${m}`, 6 * 60 * 60_000, "Você já mandou um incentivo para essa meta há pouco. Tente de novo mais tarde.");
      const texto = mensagemDeIncentivo(s.profissional.nome, meta, situacaoDaMeta(meta, new Date()));
      await repo.mensagemDaLuana(p, texto);
      return { whatsapp: await tentarWhatsapp(p, texto) };
    },
    "envio",
  ),
  /** Lembrete de guardar agora (o envio programado nos dias de guardar ainda não existe). */
  "metas.lembrar": acao(
    z.tuple([id, id]),
    async ([p, m], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      const meta = await repo.metaPorId(p, m);
      await respeitarIntervalo(`lembrete:${m}`, 60 * 60_000, "Você já recebeu um lembrete dessa meta há pouco. Tente de novo daqui a uma hora.");
      const texto = mensagemDeLembrete(meta, situacaoDaMeta(meta, new Date()));
      if (await tentarWhatsapp(p, texto)) return { whatsapp: true };
      await repo.mensagemDaLuana(p, texto);
      return { whatsapp: false };
    },
    "envio",
  ),

  // ----- faturas -----
  "faturas.listar": acao(z.tuple([id]), async ([p], { sessao }) => {
    // Faturas são parte das contas e dívidas: só com o compartilhamento ligado.
    if (await escondido(sessao, p)) return [];
    return repo.faturas(p);
  }),
  "faturas.salvar": acao(
    z.tuple([id, fatura, z.record(z.string(), z.object({ emocao: emocao.optional(), necessidade: necessidade.optional() })), id.nullable().optional()]),
    async ([p, f, c, contaId], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      return salvarFaturaDaPessoa(p, f as Fatura, c, contaId ?? null);
    },
  ),

  "documentos.salvar": acao(
    z.tuple([id, fatura, z.record(z.string(), z.object({ emocao: emocao.optional(), necessidade: necessidade.optional() })), id.nullable()]),
    async ([p, f, c, contaId], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      return salvarFaturaDaPessoa(p, f as Fatura, c, contaId);
    },
  ),

  // ----- bancos conectados (Pluggy) -----
  "banco.listar": acao(z.tuple([id]), async ([p], { sessao }) => {
    const s = await exigirVer(sessao, p);
    if (s.pessoa?.id !== p && !(await repo.rotina(p)).compartilharContas) return banco.BANCO_ESCONDIDO;
    return banco.dadosDoBanco(p);
  }),
  "banco.tokenDeConexao": acao(z.tuple([id, z.string().max(80).optional()]), async ([p, itemId], { sessao }) => {
    const s = exigirAPropriaPessoa(sessao, p);
    return doBanco(() => banco.tokenDeConexao(p, s.demo, itemId));
  }),
  "banco.conectado": acao(z.tuple([id, z.string().min(1).max(80)]), async ([p, itemId], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    return doBanco(() => banco.conectado(p, itemId));
  }),
  "banco.atualizar": acao(z.tuple([id, id]), async ([p, conexaoId], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    return banco.atualizar(p, conexaoId);
  }),
  "banco.desconectar": acao(z.tuple([id, id]), async ([p, conexaoId], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await banco.desconectar(p, conexaoId);
  }),
  "banco.modo": acao(z.tuple([id, modoCompras]), async ([p, modo], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await banco.mudarModo(p, modo);
  }),
  "banco.ignorar": acao(z.tuple([id, id]), async ([p, m], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await banco.ignorar(p, m);
  }),
  "banco.marcarTransferencia": acao(z.tuple([id, id]), async ([p, m], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await banco.marcarTransferencia(p, m);
  }),
  "banco.registrar": acao(
    z.tuple([id, id, z.object({ item: texto(80), categoria, emocao, necessidade })]),
    async ([p, m, r], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      await doBanco(() => banco.registrarDoBanco(p, m, r));
    },
  ),
  "banco.completarEmocao": acao(z.tuple([id, id, emocao, necessidade]), async ([p, compraId, e, n], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await repo.completarEmocao(p, compraId, e, n);
  }),
  "banco.renomearParcelada": acao(z.tuple([id, id, texto(80), categoria.optional()]), async ([p, parcelada, nome, cat], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    return repo.renomearParcelada(p, parcelada, nome, cat);
  }),
  "banco.aceitarSugestao": acao(
    z.tuple([id, chave, correcoesDaDivida.optional(), z.number().int().min(1).max(31).optional()]),
    async ([p, c, correcoes, vencimento], { sessao }) => {
      exigirAPropriaPessoa(sessao, p);
      try {
        return await repo.aceitarSugestao(p, c, correcoes ?? {}, vencimento);
      } catch (e) {
        if (e instanceof repo.CamposAConferir) throw new ErroDeEntrada(e.message);
        throw e;
      }
    },
  ),
  "banco.vincularSugestao": acao(z.tuple([id, chave, id]), async ([p, c, dividaId], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    return repo.vincularSugestao(p, c, dividaId);
  }),
  "banco.aceitarRenda": acao(z.tuple([id]), async ([p], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await repo.aceitarRenda(p);
  }),
  "metas.ligarInvestimentos": acao(z.tuple([id, id, z.array(id).max(20)]), async ([p, metaId, ids], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await repo.ligarInvestimentos(p, metaId, ids);
  }),
  "banco.dispensarSugestao": acao(z.tuple([id, chave]), async ([p, c], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    await repo.dispensarSugestao(p, c);
  }),
  "banco.simularCompra": acao(z.tuple([id]), async ([p], { sessao }) => {
    const s = exigirAPropriaPessoa(sessao, p);
    if (!s.demo) throw new SemPermissao("Só na demonstração.");
    await banco.simularCompra(p);
  }),
  "dividas.desvincular": acao(z.tuple([id, id]), async ([p, d], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    return repo.desvincularDivida(p, d);
  }),
  "dividas.corrigir": acao(z.tuple([id, id, campoDaDivida, z.number()]), async ([p, d, campo, valor], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    if (!LIMITE_DO_CAMPO[campo].safeParse(valor).success) throw new ErroDeEntrada("Esse valor não parece certo. Confira e tente de novo.");
    return repo.corrigirDivida(p, d, campo, valor);
  }),

  // ----- memória (profissionais) -----
  /** O que a assistente sabe, visto pela própria pessoa: sem as anotações privadas nem as orientações internas. */
  "memoria.minha": acao(z.tuple([id]), async ([p], { sessao }) => {
    exigirAPropriaPessoa(sessao, p);
    const [publica, completa] = await Promise.all([repo.memoria(p, false), repo.memoria(p, true)]);
    return {
      caracteristicas: publica.caracteristicas,
      objetivo: publica.objetivo,
      anotacoes: publica.anotacoes,
      temPrivadas: completa.anotacoes.length > publica.anotacoes.length,
    };
  }),
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
    // Quem lê é o profissional: respeita o "compartilhar contas" da pessoa.
    const ctx = await repo.contextoDoAssistente(p, "app");
    if (!(await escondido(sessao, p))) return montarContexto(ctx);
    return montarContexto({ ...ctx, metas: metasSemBanco(ctx.metas) }, { semContas: true });
  }),

  // ----- conquistas (o profissional cria; a pessoa vê) -----
  "conquistas.listar": acao(z.tuple([id]), async ([p], { sessao }) => {
    await exigirVer(sessao, p);
    // "Dias sem compra por impulso" avança com o tempo, sem compra nova: confere ao abrir.
    await repo.conferirConquistas(p);
    return repo.conquistas(p);
  }),
  "conquistas.criar": acao(
    z.tuple([
      id,
      z.object({
        icone: z.enum(["broto", "caderno", "brilho", "estrela", "alvo", "raio", "medalha", "festa"]),
        tipo: z.enum(["sem-impulso", "registrar", "nota-boa"]),
        alvo: z.number().int().min(1).max(365),
        titulo: z.string().max(80),
        premio: z.string().max(80),
      }),
    ]),
    async ([p, nova], { sessao }) => {
      const s = await exigirProfissionalDe(sessao, p);
      const c = await repo.criarConquista(p, s.profissional.id, nova);
      // Já alcançada ao criar (ex.: dias sem impulso que já vinham contando): parabéns na hora.
      await repo.conferirConquistas(p);
      return c;
    },
    "envio",
  ),
  "conquistas.apagar": acao(z.tuple([id, id]), async ([p, c], { sessao }) => {
    await exigirProfissionalDe(sessao, p);
    await repo.apagarConquista(p, c);
  }),

  // ----- eventos (desafios em grupo e encontros presenciais) -----
  "eventos.listar": acao(z.tuple([]), async (_, { sessao }) => repo.eventosDe(quemNoEvento(sessao))),
  "eventos.ver": acao(z.tuple([id]), async ([e], { sessao }) => repo.salaDoEvento(e, quemNoEvento(sessao))),
  "eventos.criar": acao(
    z.tuple([
      z
        .object({
          tipo: z.enum(["desafio", "presencial"]),
          nome: z.string().trim().min(1).max(80),
          descricao: z.string().max(500),
          regra: z.enum(["sem-desnecessaria", "sem-categoria", "limite-dia", "nota-boa"]).nullable(),
          categoria: categoria.nullable(),
          limite: z.number().int().min(100).max(1e8).nullable(),
          inicio: diaIso.nullable(),
          fim: diaIso.nullable(),
          data: diaIso.nullable(),
          hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
          local: z.string().trim().max(160).nullable(),
          premio: z.string().trim().max(80),
          mostrarRanking: z.boolean(),
          participantes: z.array(id).max(200),
        })
        .refine(
          (e) =>
            e.tipo === "desafio"
              ? Boolean(e.regra && e.inicio && e.fim && e.inicio <= e.fim && (e.regra !== "sem-categoria" || e.categoria) && (e.regra !== "limite-dia" || e.limite))
              : Boolean(e.data && e.hora && e.local),
          "Faltam dados do evento.",
        ),
    ]),
    async ([{ participantes, ...dados }], { sessao }) => {
      const s = exigirSessao(sessao);
      if (!s.profissional) throw new SemPermissao("Só quem acompanha cria eventos.");
      // Só entra quem o profissional acompanha.
      for (const p of participantes) await exigirProfissionalDe(sessao, p);
      const limpos = dados.tipo === "desafio" ? { ...dados, data: null, hora: null, local: null } : { ...dados, regra: null, categoria: null, limite: null, inicio: null, fim: null };
      return repo.criarEvento(s.profissional.id, limpos, participantes);
    },
    "envio",
  ),
  "eventos.adicionar": acao(z.tuple([id, id]), async ([e, p], { sessao }) => {
    const s = await exigirProfissionalDe(sessao, p);
    await repo.adicionarAoEvento(e, s.profissional.id, p);
  }),
  "eventos.remover": acao(z.tuple([id, id]), async ([e, p], { sessao }) => {
    await repo.removerDoEvento(e, profissionalDaSessao(sessao), p);
  }),
  "eventos.configurar": acao(z.tuple([id, z.object({ mostrarRanking: z.boolean() }).strict()]), async ([e, m], { sessao }) => {
    await repo.configurarEvento(e, profissionalDaSessao(sessao), m);
  }),
  "eventos.apagar": acao(z.tuple([id]), async ([e], { sessao }) => {
    await repo.apagarEvento(e, profissionalDaSessao(sessao));
  }),
  "eventos.responder": acao(z.tuple([id, z.enum(["vou", "talvez", "nao"])]), async ([e, r], { sessao }) => {
    const s = exigirSessao(sessao);
    if (!s.pessoa) throw new SemPermissao("Só quem participa responde.");
    await repo.responderEncontro(e, s.pessoa.id, r);
  }),
  "eventos.aceitar": acao(z.tuple([id]), async ([e], { sessao }) => {
    const s = exigirSessao(sessao);
    if (!s.pessoa) throw new SemPermissao("Só quem foi convidado aceita.");
    await repo.aceitarConvite(e, s.pessoa.id);
  }),
  "eventos.sair": acao(z.tuple([id]), async ([e], { sessao }) => {
    const s = exigirSessao(sessao);
    if (!s.pessoa) throw new SemPermissao("Só quem participa sai do evento.");
    await repo.sairDoEvento(e, s.pessoa.id);
  }),
  "eventos.postar": acao(
    z.tuple([id, z.enum(["recado", "dica", "conquista", "desabafo", "aviso"]), z.string().trim().min(1).max(1000)]),
    async ([e, tipo, texto], { sessao }) => repo.postarNoEvento(e, quemNoEvento(sessao), tipo, texto),
    "envio",
  ),
  "eventos.apoiar": acao(z.tuple([id, id]), async ([e, post], { sessao }) => {
    await repo.apoiarPost(e, quemNoEvento(sessao), post);
  }),
  "eventos.fixar": acao(z.tuple([id, id]), async ([e, post], { sessao }) => {
    await repo.fixarPost(e, profissionalDaSessao(sessao), post);
  }),
  "eventos.apagarPost": acao(z.tuple([id, id]), async ([e, post], { sessao }) => {
    await repo.apagarPost(e, quemNoEvento(sessao), post);
  }),

  // ----- avisos -----
  "avisos.listar": acao(z.tuple([]), async (_, { sessao }) => {
    const s = exigirSessao(sessao);
    // A pessoa vê as sugestões que recebeu e os avisos do banco; o profissional, os avisos de quem acompanha.
    if (s.pessoa) return repo.avisos([s.pessoa.id], { apenas: ["sugestao", ...AVISOS_DA_PESSOA] });
    if (s.profissional) return repo.avisos((await repo.acompanhados(s.profissional.id)).map((x) => x.id), { exceto: ["sugestao", ...AVISOS_DA_PESSOA] });
    return [];
  }),
  "avisos.daPessoa": acao(z.tuple([id]), async ([p], { sessao }) => {
    await exigirProfissionalDe(sessao, p);
    return repo.avisos([p], { exceto: ["sugestao", ...AVISOS_DA_PESSOA] });
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
