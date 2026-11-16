/**
 * Ligação do WhatsApp à conta da pessoa.
 *
 * Dois caminhos, os dois provando que o número é de quem pede:
 * - código: a Luana manda 6 dígitos para o número e a pessoa digita no app;
 * - link assinado: a Luana manda um link para quem escreveu sem estar
 *   conectado, e a pessoa confirma no app.
 *
 * Contra spam e tentativa e erro: só manda código para quem falou com a Luana
 * nas últimas 24 horas, reserva vagas de limite de forma atômica (soma antes
 * de conferir) e conta por pessoa, por rede e por número.
 */
import { randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { devolverHoje, somarHoje } from "@/lib/limite";
import { normalizarTelefone } from "../telefone";
import { lerCodigoDeConexao } from "./link-de-conexao";
import { prisma } from "./prisma";
import { registros } from "./registros";

/** Onde fica o número confirmado de cada pessoa. No servidor, `pessoas.telefone`. */
export interface TelefonesDasPessoas {
  /** Liga o número à pessoa; se outra pessoa tinha esse número, ela o perde (o dono provou que é dele). */
  ligar(pessoaId: string, telefone: string): Promise<void>;
  desligar(pessoaId: string): Promise<void>;
  dono(telefone: string): Promise<string | null>;
}

const telefonesNoBanco: TelefonesDasPessoas = {
  async ligar(pessoaId, telefone) {
    await prisma().$transaction([
      prisma().pessoa.updateMany({ where: { telefone, NOT: { id: pessoaId } }, data: { telefone: null } }),
      prisma().pessoa.update({ where: { id: pessoaId }, data: { telefone } }),
    ]);
  },
  async desligar(pessoaId) {
    await prisma().pessoa.update({ where: { id: pessoaId }, data: { telefone: null } });
  },
  async dono(telefone) {
    return (await prisma().pessoa.findUnique({ where: { telefone }, select: { id: true } }))?.id ?? null;
  },
};

export function telefonesEmMemoria(): TelefonesDasPessoas {
  const porPessoa = new Map<string, string>();
  return {
    async ligar(pessoaId, telefone) {
      for (const [p, t] of porPessoa) if (t === telefone) porPessoa.delete(p);
      porPessoa.set(pessoaId, telefone);
    },
    desligar: async (pessoaId) => void porPessoa.delete(pessoaId),
    dono: async (telefone) => [...porPessoa].find(([, t]) => t === telefone)?.[0] ?? null,
  };
}

let telefones: TelefonesDasPessoas = telefonesNoBanco;
/** Nos testes sem banco, os números ficam em memória. */
export function usarTelefones(t: TelefonesDasPessoas): void {
  telefones = t;
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
 * Limites do dia. Por quem pede (a pessoa e, à parte, a rede, que o cliente
 * não escolhe), rígidos. Por número, um teto contra quem tenta de várias
 * contas e redes; com 30 palpites em 1 milhão, a chance de acertar é de
 * 0,003% por dia.
 */
const LIMITES = {
  codigos: { porQuemPede: 5, porNumero: 20 },
  tentativas: { porQuemPede: 10, porNumero: 30 },
};
/** Intervalo mínimo entre dois códigos pedidos pela mesma pessoa para o mesmo número. */
const INTERVALO_ENTRE_ENVIOS_MS = 60_000;
/** Só mandamos código para quem falou com a Luana nesse período (é também a janela do WhatsApp). */
const JANELA_DE_CONTATO_MS = 24 * 60 * 60_000;

export class PedidoRecusado extends Error {}

export interface Quem {
  pessoaId: string;
  /** Hash do endereço de rede de quem pede, quando conhecido. */
  rede?: string | null;
}

function chavesDoLimite(tipo: keyof typeof LIMITES, quem: Quem, telefone: string) {
  const porQuemPede = [`${tipo}:p:${quem.pessoaId}:${telefone}`, ...(quem.rede ? [`${tipo}:r:${quem.rede}:${telefone}`] : [])];
  return { porQuemPede, porNumero: `${tipo}:n:${telefone}`, todas: [...porQuemPede, `${tipo}:n:${telefone}`] };
}

/** Reserva uma vaga no limite de forma atômica (soma antes de conferir). Se passou, devolve e recusa. */
async function reservar(tipo: keyof typeof LIMITES, quem: Quem, telefone: string): Promise<string[]> {
  const c = chavesDoLimite(tipo, quem, telefone);
  const totais = await somarHoje(c.todas);
  const estourou =
    c.porQuemPede.some((k) => (totais.get(k) ?? 0) > LIMITES[tipo].porQuemPede) || (totais.get(c.porNumero) ?? 0) > LIMITES[tipo].porNumero;
  if (estourou) {
    await devolverHoje(c.todas);
    throw new PedidoRecusado(
      tipo === "codigos" ? "Esse número já recebeu códigos demais hoje. Tente de novo amanhã." : "Muitas tentativas para esse número hoje. Tente de novo amanhã.",
    );
  }
  return c.todas;
}

/** Anota que o número escreveu para a Luana: a partir daí podemos mandar o código para ele. */
export async function registrarContato(numero: string, agora = Date.now()): Promise<void> {
  const telefone = normalizarTelefone(numero);
  if (telefone) await registros().gravar(`contato:${telefone}`, agora);
}

export interface PedidoDeCodigo {
  telefone: string;
  codigo: string;
  /** Vaga reservada no limite de envios; devolvida se o envio falhar. */
  reserva: string[];
}

/** Primeiro passo: gera o código de 6 dígitos para mandar ao número. */
export async function pedirCodigo(
  quem: Quem,
  texto: string,
  { agora = Date.now(), exigirContato = true }: { agora?: number; exigirContato?: boolean } = {},
): Promise<PedidoDeCodigo | null> {
  const telefone = normalizarTelefone(texto);
  if (!telefone) return null;
  if (exigirContato) {
    const contato = (await registros().ler(`contato:${telefone}`)) as number | null;
    if (!contato || agora - contato > JANELA_DE_CONTATO_MS) {
      throw new PedidoRecusado("Mande antes um “oi” para a Luana no WhatsApp desse número. Depois peça o código de novo.");
    }
  }
  const ultimoEnvio = (await registros().ler(`envio:${quem.pessoaId}:${telefone}`)) as number | null;
  if (ultimoEnvio && agora - ultimoEnvio < INTERVALO_ENTRE_ENVIOS_MS) {
    throw new PedidoRecusado("Acabamos de mandar um código para esse número. Espere um minuto para pedir outro.");
  }
  const reserva = await reservar("codigos", quem, telefone);
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const pedido: Pedido = { id: randomUUID(), telefone, codigo, expira: agora + VALIDADE_DO_CODIGO_MS };
  await registros().gravar(`pedido:${quem.pessoaId}`, pedido);
  await registros().gravar(`envio:${quem.pessoaId}:${telefone}`, agora);
  return { telefone, codigo, reserva };
}

/** Desfaz o pedido quando o código não pôde ser enviado: a vaga volta para o limite. */
export async function cancelarPedido(pessoaId: string, pedido: PedidoDeCodigo): Promise<void> {
  await registros().apagar(`pedido:${pessoaId}`);
  await registros().apagar(`envio:${pessoaId}:${pedido.telefone}`);
  await devolverHoje(pedido.reserva);
}

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Segundo passo: a pessoa digitou o código. Cada tentativa reserva uma vaga antes de comparar. */
export async function confirmarCodigo(quem: Quem, codigo: string, { agora = Date.now() }: { agora?: number } = {}): Promise<string> {
  const chave = `pedido:${quem.pessoaId}`;
  const pedido = (await registros().ler(chave)) as Pedido | null;
  if (!pedido || pedido.expira < agora) throw new PedidoRecusado("O código venceu. Peça um novo.");

  try {
    await reservar("tentativas", quem, pedido.telefone);
  } catch (e) {
    await registros().apagar(chave);
    throw e;
  }
  const doPedido = (await somarHoje([`tentativas:pedido:${pedido.id}`])).get(`tentativas:pedido:${pedido.id}`) ?? 0;
  if (doPedido > TENTATIVAS_POR_CODIGO) {
    await registros().apagar(chave);
    throw new PedidoRecusado("Código errado muitas vezes. Peça um novo.");
  }
  if (!iguais(pedido.codigo, codigo.trim())) throw new PedidoRecusado("Código não confere. Confira a mensagem no WhatsApp.");

  await telefones.ligar(quem.pessoaId, pedido.telefone);
  await registros().apagar(chave);
  return pedido.telefone;
}

/** Conecta pelo link assinado. O uso é marcado de vez (insert sem sobrescrever): o link vale uma vez. */
export async function conectarPorLink(pessoaId: string, codigo: string): Promise<string> {
  const lido = lerCodigoDeConexao(codigo);
  if (!lido) throw new PedidoRecusado("Esse link venceu ou não é válido. Mande uma mensagem para a Luana no WhatsApp para receber outro.");
  if (!(await registros().criarSeNaoExiste(`link-usado:${lido.uso}`, Date.now()))) {
    throw new PedidoRecusado("Esse link já foi usado. Mande uma mensagem para a Luana no WhatsApp para receber outro.");
  }
  await telefones.ligar(pessoaId, lido.telefone);
  return lido.telefone;
}

export async function desconectar(pessoaId: string): Promise<void> {
  await telefones.desligar(pessoaId);
}

/** De quem é este número de WhatsApp, se alguém conectou. */
export async function donoDoTelefone(numero: string): Promise<string | null> {
  const telefone = normalizarTelefone(numero);
  return telefone ? telefones.dono(telefone) : null;
}
