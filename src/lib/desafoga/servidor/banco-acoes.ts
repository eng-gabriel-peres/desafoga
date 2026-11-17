/**
 * O que as ações `banco.*` fazem: conectar, atualizar, registrar compra do
 * banco, ensinar transferência, trocar o modo e simular compra na demo.
 * Quem pode chamar é conferido antes, em `rotas.ts`.
 */
import { categoriaDe, chaveDaDescricao } from "@/lib/banco/classificar";
import { clientePluggy, pluggyConfigurado, type ClientePluggy } from "@/lib/banco/pluggy";
import { sincronizar, tratarCompraNova, type ResultadoDaSincronizacao } from "@/lib/banco/sincronizar";
import type { CompraParcelada, ConexaoBancaria, ModoCompras, Movimento } from "@/lib/banco/tipos";
import { urlDoWebhook } from "@/lib/banco/webhook";
import { diaEmBrasilia } from "@/lib/banco/normalizar";
import type { Categoria, Emocao, Necessidade } from "@/lib/finance";
import * as repo from "./repositorio";
import type { InvestimentoDoBanco, SugestaoGuardada } from "./repositorio-banco";

export class RecusaDoBanco extends Error {}

export interface DadosDoBanco {
  /** false para a profissional quando a pessoa não compartilha as contas. */
  compartilhadas: boolean;
  /** A Pluggy está configurada neste ambiente. */
  configurado: boolean;
  modo: ModoCompras;
  conexoes: ConexaoBancaria[];
  movimentos: Movimento[];
  parceladas: CompraParcelada[];
  sugestoes: SugestaoGuardada[];
  investimentos: InvestimentoDoBanco[];
}

const DIAS_DE_MOVIMENTOS = 120;

export async function dadosDoBanco(pessoaId: string, agora = new Date()): Promise<DadosDoBanco> {
  const desde = diaEmBrasilia(new Date(agora.getTime() - DIAS_DE_MOVIMENTOS * 86_400_000));
  const [modo, conexoes, recentes, revisar, parceladas, sugestoes, investimentos] = await Promise.all([
    repo.modoCompras(pessoaId),
    repo.conexoes(pessoaId),
    repo.movimentos(pessoaId, { desde }),
    repo.movimentos(pessoaId, { situacao: ["revisar"] }),
    repo.parceladas(pessoaId),
    repo.sugestoes(pessoaId),
    repo.investimentos(pessoaId),
  ]);
  const vistos = new Set(recentes.map((m) => m.id));
  return {
    compartilhadas: true,
    configurado: pluggyConfigurado(),
    modo,
    conexoes,
    movimentos: [...recentes, ...revisar.filter((m) => !vistos.has(m.id))],
    parceladas,
    sugestoes,
    investimentos,
  };
}

export const BANCO_ESCONDIDO: DadosDoBanco = { compartilhadas: false, configurado: false, modo: "revisar", conexoes: [], movimentos: [], parceladas: [], sugestoes: [], investimentos: [] };

const SEM_RESPOSTA = "Não consegui falar com a Pluggy agora (sem resposta). Tente de novo em instantes.";

/** A Pluggy às vezes não responde (rede bloqueada, fora do ar): desiste em 15 s com uma mensagem clara. */
async function comPrazo<T>(promessa: Promise<T>, ms = 15_000): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promessa,
      new Promise<never>((_, rejeitar) => {
        relogio = setTimeout(() => rejeitar(new RecusaDoBanco(SEM_RESPOSTA)), ms);
      }),
    ]);
  } catch (e) {
    if (e instanceof RecusaDoBanco) throw e;
    console.error("Desafoga: Pluggy falhou,", e instanceof Error ? e.message.slice(0, 200) : "erro");
    throw new RecusaDoBanco(SEM_RESPOSTA);
  } finally {
    clearTimeout(relogio);
  }
}

export async function tokenDeConexao(
  pessoaId: string,
  demo: boolean,
  itemId?: string,
  cliente?: ClientePluggy,
  configurado = pluggyConfigurado(),
): Promise<{ token: string; incluirSandbox: boolean }> {
  if (!configurado) throw new RecusaDoBanco("Conexão com bancos indisponível neste ambiente.");
  if (itemId) {
    const minha = (await repo.conexoes(pessoaId)).some((c) => c.pluggyItemId === itemId);
    if (!minha) throw new RecusaDoBanco("Banco não encontrado.");
  } else if (demo && (await repo.conexoes(pessoaId)).some((c) => c.pluggyItemId)) {
    throw new RecusaDoBanco("Na demonstração dá para conectar um banco só.");
  }
  const token = await comPrazo((cliente ?? clientePluggy()).tokenDeConexao({ itemId, clientUserId: pessoaId, webhookUrl: urlDoWebhook() ?? undefined }));
  return { token, incluirSandbox: demo || process.env.PLUGGY_SANDBOX === "1" };
}

/** A janela da Pluggy terminou: confere que o item é desta pessoa, cria a conexão e lê o banco. */
export async function conectado(pessoaId: string, itemId: string, cliente: ClientePluggy = clientePluggy()): Promise<ResultadoDaSincronizacao> {
  const item = await comPrazo(cliente.item(itemId));
  // O token de conexão sempre leva o id da pessoa (clientUserId): item sem ele, ou de outra pessoa, é recusado.
  if (item.clientUserId !== pessoaId) throw new RecusaDoBanco("Esse banco não foi conectado por você.");
  const c = await repo.criarConexao(pessoaId, { pluggyItemId: itemId, banco: item.connector?.name ?? "Banco", logo: item.connector?.imageUrl ?? null });
  return sincronizar(c.id, { cliente });
}

export async function atualizar(pessoaId: string, conexaoId: string): Promise<ResultadoDaSincronizacao | null> {
  const c = await repo.conexaoDaPessoa(pessoaId, conexaoId);
  if (!c.pluggyItemId) return null;
  return sincronizar(c.id, { pedirAtualizacao: true });
}

export async function desconectar(pessoaId: string, conexaoId: string): Promise<void> {
  const itemId = await repo.apagarConexao(pessoaId, conexaoId);
  if (itemId && pluggyConfigurado()) {
    await clientePluggy()
      .apagarItem(itemId)
      .catch((e: unknown) => console.error("Desafoga: item não apagado na Pluggy,", e instanceof Error ? e.message.slice(0, 200) : "erro"));
  }
}

/** Troca o modo das compras; vale dali para frente e para o que ainda espera revisão. */
export async function mudarModo(pessoaId: string, modo: ModoCompras, agora = new Date()): Promise<void> {
  await repo.salvarModoCompras(pessoaId, modo);
  if (modo === "revisar") return;
  const pendentes = await repo.movimentos(pessoaId, { situacao: ["revisar"] });
  if (modo === "desligado") {
    for (const m of pendentes) await repo.mudarMovimento(pessoaId, m.id, { situacao: "historico" });
    return;
  }
  const compras = await repo.compras(pessoaId);
  const conexoes = await repo.conexoes(pessoaId);
  const cartoes = new Set(conexoes.flatMap((c) => c.contas).filter((c) => c.tipo === "cartao").map((c) => c.id));
  for (const m of pendentes) {
    // Volta a "histórico" e reprocessa como compra nova no modo automático.
    await repo.mudarMovimento(pessoaId, m.id, { situacao: "historico" });
    if (m.parceladaId) await repo.desmarcarParceladaAvisada(m.parceladaId);
    await tratarCompraNova(pessoaId, { ...m, situacao: "historico" }, { modo: "automatico", compras, ligadas: new Set(), naJanela: true, cartao: cartoes.has(m.contaId), agora });
  }
}

export async function ignorar(pessoaId: string, movimentoId: string): Promise<void> {
  await repo.mudarMovimento(pessoaId, movimentoId, { situacao: "ignorada" });
}

/** "É transferência minha": some da revisão e o app aprende para as próximas. */
export async function marcarTransferencia(pessoaId: string, movimentoId: string): Promise<void> {
  const m = await repo.movimentoDaPessoa(pessoaId, movimentoId);
  await repo.mudarMovimento(pessoaId, movimentoId, { natureza: "transferencia-propria", situacao: "ignorada", categoria: null });
  await repo.salvarRegra(pessoaId, { padrao: m.documentoContraparte ?? chaveDaDescricao(m.descricao), efeito: { natureza: "transferencia-propria" } });
}

export interface RegistroDoBanco {
  item: string;
  categoria: Categoria;
  emocao: Emocao;
  necessidade: Necessidade;
}

/** Registra a compra do banco com o que a pessoa disse. Parcelada: uma compra só, do valor total. */
export async function registrarDoBanco(pessoaId: string, movimentoId: string, r: RegistroDoBanco): Promise<void> {
  const m = await repo.movimentoDaPessoa(pessoaId, movimentoId);
  // Reserva antes de criar a compra: dois cliques seguidos não criam duas.
  if (m.compraId || !(await repo.reservarMovimento(pessoaId, movimentoId))) throw new RecusaDoBanco("Essa compra já foi registrada.");
  try {
    await registrarReservado(pessoaId, m, r);
  } catch (e) {
    // Deu errado no meio: a compra volta para a revisão.
    await repo.mudarMovimento(pessoaId, movimentoId, { situacao: "revisar" });
    throw e;
  }
}

async function registrarReservado(pessoaId: string, m: Movimento, r: RegistroDoBanco): Promise<void> {
  const movimentoId = m.id;
  const item = r.item.trim();
  if (m.categoria && r.categoria !== m.categoria) await repo.salvarRegra(pessoaId, { padrao: chaveDaDescricao(m.descricao), efeito: { categoria: r.categoria } });

  const parcelada = m.parceladaId ? (await repo.parceladas(pessoaId)).find((p) => p.id === m.parceladaId) : undefined;
  if (parcelada) {
    if (parcelada.compraId) throw new RecusaDoBanco("Essa compra parcelada já foi registrada.");
    const compra = await repo.registrarCompra(
      pessoaId,
      { item, categoria: r.categoria, valor: parcelada.valorTotal, emocao: r.emocao, necessidade: r.necessidade, via: "banco", parcelas: parcelada.totalParcelas, valorDaParcela: parcelada.valorParcela, parceladaId: parcelada.id },
      new Date(`${parcelada.compradaEm}T12:00:00-03:00`),
    );
    await repo.ligarParceladaACompra(parcelada.id, compra.id);
    await repo.renomearParcelada(pessoaId, parcelada.id, item, r.categoria);
    for (const x of await repo.movimentos(pessoaId)) {
      if (x.parceladaId === parcelada.id && !x.compraId) await repo.mudarMovimento(pessoaId, x.id, { situacao: "registrada", compraId: compra.id });
    }
    return;
  }
  const compra = await repo.registrarCompra(
    pessoaId,
    { item, categoria: r.categoria, valor: m.valor, emocao: r.emocao, necessidade: r.necessidade, via: "banco" },
    new Date(`${m.data}T12:00:00-03:00`),
  );
  await repo.mudarMovimento(pessoaId, movimentoId, { situacao: "registrada", compraId: compra.id, categoria: r.categoria });
}

const SIMULADAS = [
  { descricao: "IFOOD *SABOR DA CASA", valor: 4590, mcc: 5812 },
  { descricao: "DROGASIL 2231", valor: 3790, mcc: 5912 },
  { descricao: "PAO DE ACUCAR 118", valor: 13240, mcc: 5411 },
  { descricao: "RENNER SHOPPING", valor: 18990, mcc: 5651 },
  { descricao: "SHOPEE *LOJA OFICIAL", valor: 8990, mcc: null },
  { descricao: "CINEMARK", valor: 6400, mcc: 7832 },
] as const;

/** Demonstração: uma compra nova chega "do banco" na hora, com aviso e mensagem da Luana. */
export async function simularCompra(pessoaId: string, agora = new Date()): Promise<void> {
  const conexoes = await repo.conexoes(pessoaId);
  let conexao = conexoes.find((c) => c.pluggyItemId === null);
  if (!conexao) conexao = await repo.criarConexao(pessoaId, { pluggyItemId: null, banco: "Banco Demonstração", logo: null });
  let cartao = conexao.contas.find((c) => c.tipo === "cartao");
  if (!cartao) {
    [cartao] = await repo.salvarContas(conexao.id, [
      { pluggyAccountId: `demo-${conexao.id}-cartao`, tipo: "cartao", nome: "Cartão Demonstração", saldo: 0, limite: 300000, limiteDisponivel: 300000, fechamento: null, vencimento: null, chequeEspecialUsado: null, chequeEspecialLimite: null },
    ]);
  }
  const escolhida = SIMULADAS[Math.floor(Math.random() * SIMULADAS.length)];
  const base = { descricao: escolhida.descricao, mcc: escolhida.mcc, categoriaPluggy: null };
  const { novos } = await repo.salvarMovimentos(pessoaId, [
    {
      pluggyId: `demo-${crypto.randomUUID()}`,
      contaId: cartao.id,
      data: diaEmBrasilia(agora),
      descricao: escolhida.descricao,
      descricaoOriginal: escolhida.descricao,
      valor: escolhida.valor,
      direcao: "saida",
      categoriaPluggy: null,
      parcela: null,
      totalParcelas: null,
      valorTotalDaCompra: null,
      compradaEm: null,
      faturaPrevista: null,
      cnpj: null,
      mcc: escolhida.mcc,
      documentoContraparte: null,
      jurosBoleto: null,
      pendente: false,
      natureza: "compra",
      categoria: categoriaDe(base, await repo.regras(pessoaId)),
      situacao: "historico",
      compraId: null,
      parceladaId: null,
    },
  ]);
  const modo = await repo.modoCompras(pessoaId);
  await tratarCompraNova(pessoaId, novos[0], { modo, compras: [], ligadas: new Set(), naJanela: true, cartao: true, agora });
}
