/**
 * Onde o servidor guarda os dados do Desafoga.
 * - Com DATABASE_URL: Postgres (Neon), tabela `desafoga` (chave, dados jsonb), criada sozinha.
 * - Sem DATABASE_URL: arquivo .data/desafoga.json, só para desenvolver.
 *
 * Cada navegador da demonstração tem a sua cópia dos dados fictícios
 * (`demo:<visitante>`), para um jurado não mexer nos dados do outro. O número
 * de WhatsApp cadastrado aponta para a pessoa (`telefone:<número>`).
 */
import { randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Pool } from "pg";
import { lerHoje, somarHoje } from "@/lib/limite";
import { novoBanco, type Banco } from "@/services/nucleo";
import { normalizarTelefone } from "../telefone";

interface Armazem {
  ler(chave: string): Promise<unknown | null>;
  gravar(chave: string, dados: unknown): Promise<void>;
  apagar(chave: string): Promise<void>;
}

function armazemPostgres(url: string): Armazem {
  const pool = new Pool({ connectionString: url, max: 3 });
  let tabela: Promise<unknown> | null = null;
  const pronto = () =>
    (tabela ??= pool
      .query(
        `create table if not exists desafoga (
           chave text primary key,
           dados jsonb not null,
           atualizado_em timestamptz not null default now()
         )`,
      )
      .catch((erro) => {
        tabela = null;
        throw erro;
      }));
  return {
    async ler(chave) {
      await pronto();
      const r = await pool.query<{ dados: unknown }>("select dados from desafoga where chave = $1", [chave]);
      return r.rows[0]?.dados ?? null;
    },
    async gravar(chave, dados) {
      await pronto();
      await pool.query(
        `insert into desafoga (chave, dados) values ($1, $2::jsonb)
         on conflict (chave) do update set dados = excluded.dados, atualizado_em = now()`,
        [chave, JSON.stringify(dados)],
      );
    },
    async apagar(chave) {
      await pronto();
      await pool.query("delete from desafoga where chave = $1", [chave]);
    },
  };
}

function armazemEmArquivo(arquivo: string | null): Armazem {
  let tudo: Record<string, unknown> | null = null;
  const todos = () => {
    if (tudo) return tudo;
    tudo = {};
    if (arquivo && existsSync(arquivo)) {
      try {
        tudo = JSON.parse(readFileSync(arquivo, "utf8")) as Record<string, unknown>;
      } catch {
        // Arquivo corrompido: começa vazio.
      }
    }
    return tudo;
  };
  const gravarArquivo = () => {
    if (!arquivo) return;
    mkdirSync(".data", { recursive: true });
    writeFileSync(arquivo, JSON.stringify(todos()));
  };
  return {
    ler: async (chave) => structuredClone(todos()[chave] ?? null),
    async gravar(chave, dados) {
      todos()[chave] = structuredClone(dados);
      gravarArquivo();
    },
    async apagar(chave) {
      delete todos()[chave];
      gravarArquivo();
    },
  };
}

let atual: Armazem | null = null;
function armazem(): Armazem {
  if (atual) return atual;
  const url = process.env.DATABASE_URL;
  if (url) return (atual = armazemPostgres(url));
  const emDisco = !process.env.VERCEL && process.env.NODE_ENV !== "test";
  return (atual = armazemEmArquivo(emDisco ? ".data/desafoga.json" : null));
}

/** Uma operação por vez em cada banco, para duas mensagens seguidas não se atropelarem. */
const filas = new Map<string, Promise<unknown>>();

/**
 * Carrega o banco do visitante (criando os dados fictícios na primeira vez),
 * aplica a operação e salva. Devolve o resultado da operação.
 */
export function comBanco<T>(visitante: string, operar: (banco: Banco) => T | Promise<T>, salvar = true): Promise<T> {
  const chave = `demo:${visitante}`;
  const anterior = filas.get(chave) ?? Promise.resolve();
  const proxima = anterior
    .catch(() => undefined)
    .then(async () => {
      const lido = (await armazem().ler(chave)) as Banco | null;
      const banco = lido?.versao === 2 ? lido : novoBanco();
      if (!lido || lido.versao !== 2) await armazem().gravar(chave, banco);
      const resultado = await operar(banco);
      if (salvar) await armazem().gravar(chave, banco);
      return resultado;
    });
  filas.set(chave, proxima);
  void proxima.finally(() => {
    if (filas.get(chave) === proxima) filas.delete(chave);
  });
  return proxima;
}

/** Volta os dados fictícios do visitante ao começo, mantendo os números de WhatsApp cadastrados. */
export function recomecarBanco(visitante: string): Promise<void> {
  return comBanco(visitante, (banco) => {
    const telefones = banco.telefones;
    Object.assign(banco, novoBanco(), { telefones });
  });
}

interface Vinculo {
  visitante: string;
  pessoaId: string;
}

interface Pedido {
  /** Identifica o pedido no contador de tentativas. */
  id: string;
  telefone: string;
  codigo: string;
  expira: number;
}

/** Tempo para digitar o código recebido no WhatsApp. */
const VALIDADE_DO_CODIGO_MS = 15 * 60_000;
/** Tentativas por código: 6 dígitos não dão para adivinhar em 5. */
const TENTATIVAS_POR_CODIGO = 5;
/**
 * Limites do dia em dois níveis. Por navegador e número, rígidos: valem para
 * quem está tentando. Por número, um teto alto contra quem tenta de vários
 * navegadores; alto o bastante para outra pessoa não conseguir travar o dono.
 */
const TENTATIVAS_POR_NAVEGADOR_E_NUMERO = 10;
const TENTATIVAS_POR_NUMERO = 50;
const CODIGOS_POR_NAVEGADOR_E_NUMERO = 5;
const CODIGOS_POR_NUMERO = 20;
/** Intervalo mínimo entre dois códigos pedidos pelo mesmo navegador para o mesmo número. */
const INTERVALO_ENTRE_ENVIOS_MS = 60_000;
/** Só mandamos código para quem falou com a Luana no WhatsApp nesse período (é também a janela do WhatsApp). */
const JANELA_DE_CONTATO_MS = 24 * 60 * 60_000;

export class PedidoRecusado extends Error {}

/** Anota que o número escreveu para a Luana: a partir daí podemos responder a ele. */
export async function registrarContato(numero: string, agora = Date.now()): Promise<void> {
  const telefone = normalizarTelefone(numero);
  if (telefone) await armazem().gravar(`contato:${telefone}`, agora);
}

/**
 * Primeiro passo do cadastro do WhatsApp: gera um código de 6 dígitos para
 * mandar ao número. A ligação só vale quando a pessoa digita esse código no
 * app (`confirmarTelefone`): ninguém liga à própria conta o número de outra
 * pessoa sem ter o celular dela na mão.
 *
 * Contra spam, o número precisa ter escrito para a Luana nas últimas 24 horas
 * (`exigirContato`), e recebe no máximo alguns códigos por dia.
 */
export async function pedirTelefone(
  visitante: string,
  pessoaId: string,
  texto: string,
  { agora = Date.now(), exigirContato = true }: { agora?: number; exigirContato?: boolean } = {},
): Promise<{ telefone: string; codigo: string } | null> {
  const telefone = normalizarTelefone(texto);
  if (!telefone) return null;
  if (exigirContato) {
    const contato = (await armazem().ler(`contato:${telefone}`)) as number | null;
    if (!contato || agora - contato > JANELA_DE_CONTATO_MS) {
      throw new PedidoRecusado("Mande antes um “oi” para a Luana no WhatsApp desse número. Depois peça o código de novo.");
    }
  }
  const ultimoEnvio = (await armazem().ler(`envio:${visitante}:${telefone}`)) as number | null;
  if (ultimoEnvio && agora - ultimoEnvio < INTERVALO_ENTRE_ENVIOS_MS) {
    throw new PedidoRecusado("Acabamos de mandar um código para esse número. Espere um minuto para pedir outro.");
  }
  const enviados = await lerHoje([`codigo-enviado:${visitante}:${telefone}`, `codigo-enviado:${telefone}`]);
  if (
    (enviados.get(`codigo-enviado:${visitante}:${telefone}`) ?? 0) >= CODIGOS_POR_NAVEGADOR_E_NUMERO ||
    (enviados.get(`codigo-enviado:${telefone}`) ?? 0) >= CODIGOS_POR_NUMERO
  ) {
    throw new PedidoRecusado("Esse número já recebeu códigos demais hoje. Tente de novo amanhã.");
  }
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const pedido: Pedido = { id: randomUUID(), telefone, codigo, expira: agora + VALIDADE_DO_CODIGO_MS };
  await armazem().gravar(`pedido:${visitante}:${pessoaId}`, pedido);
  return { telefone, codigo };
}

/** Conta o código como enviado; só depois de o WhatsApp aceitar a mensagem. */
export async function registrarEnvio(visitante: string, telefone: string, agora = Date.now()): Promise<void> {
  await armazem().gravar(`envio:${visitante}:${telefone}`, agora);
  await somarHoje([`codigo-enviado:${visitante}:${telefone}`, `codigo-enviado:${telefone}`]);
}

/** Desfaz o pedido quando o código não pôde ser enviado (e ele não conta no limite). */
export async function cancelarPedido(visitante: string, pessoaId: string): Promise<void> {
  await armazem().apagar(`pedido:${visitante}:${pessoaId}`);
}

/**
 * Segundo passo: a pessoa digitou no app o código que recebeu. Cada tentativa
 * é contada antes da comparação, de forma atômica no banco: tentativas em
 * paralelo não escapam do limite. Liga o número à pessoa e devolve o número.
 */
export async function confirmarTelefone(visitante: string, pessoaId: string, codigo: string, agora = Date.now()): Promise<string> {
  const chave = `pedido:${visitante}:${pessoaId}`;
  const pedido = (await armazem().ler(chave)) as Pedido | null;
  if (!pedido || pedido.expira < agora) throw new PedidoRecusado("O código venceu. Peça um novo.");

  const doPedido = `codigo-tentativa:${pedido.id}`;
  const doPar = `codigo-tentativa:${visitante}:${pedido.telefone}`;
  const doNumero = `codigo-tentativa-numero:${pedido.telefone}`;
  const totais = await somarHoje([doPedido, doPar, doNumero]);
  if ((totais.get(doPar) ?? 0) > TENTATIVAS_POR_NAVEGADOR_E_NUMERO || (totais.get(doNumero) ?? 0) > TENTATIVAS_POR_NUMERO) {
    await armazem().apagar(chave);
    throw new PedidoRecusado("Muitas tentativas para esse número hoje. Tente de novo amanhã.");
  }
  if ((totais.get(doPedido) ?? 0) > TENTATIVAS_POR_CODIGO) {
    await armazem().apagar(chave);
    throw new PedidoRecusado("Código errado muitas vezes. Peça um novo.");
  }
  if (!iguais(pedido.codigo, codigo.trim())) throw new PedidoRecusado("Código não confere. Confira a mensagem no WhatsApp.");

  const { telefone } = pedido;
  await comBanco(visitante, async (banco) => {
    const anterior = banco.telefones[pessoaId];
    if (anterior && anterior !== telefone) await apagarSeFor(anterior, visitante, pessoaId);
    banco.telefones[pessoaId] = telefone;
  });
  await armazem().gravar(`telefone:${telefone}`, { visitante, pessoaId } satisfies Vinculo);
  await armazem().apagar(chave);
  return telefone;
}

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function desvincularTelefone(visitante: string, pessoaId: string): Promise<void> {
  await comBanco(visitante, async (banco) => {
    const anterior = banco.telefones[pessoaId];
    if (anterior) await apagarSeFor(anterior, visitante, pessoaId);
    banco.telefones[pessoaId] = null;
  });
}

/** Apaga a ligação do número só se ela ainda aponta para esta pessoa deste navegador. */
async function apagarSeFor(telefone: string, visitante: string, pessoaId: string): Promise<void> {
  const v = (await armazem().ler(`telefone:${telefone}`)) as Vinculo | null;
  if (v?.visitante === visitante && v.pessoaId === pessoaId) await armazem().apagar(`telefone:${telefone}`);
}

/** De quem é este número de WhatsApp, se alguém cadastrou. */
export async function donoDoTelefone(numero: string): Promise<Vinculo | null> {
  const telefone = normalizarTelefone(numero);
  if (!telefone) return null;
  const v = (await armazem().ler(`telefone:${telefone}`)) as Vinculo | null;
  return v?.visitante && v.pessoaId ? v : null;
}
