/**
 * "Banco" da demonstração: os dados fictícios em memória, guardados no
 * navegador para sobreviver a um recarregamento. Quando o dia muda, volta ao
 * início, porque as datas da demonstração são relativas a hoje.
 */
import { materializar, SEMENTES, type DadosDaPessoa } from "@/fixtures/desafoga";
import { chaveDoDia } from "@/lib/finance";
import { ESTADO_INICIAL, type EstadoConversa } from "@/lib/assistente/conversa";

const CHAVE = "desafoga-demo-v1";

export interface Banco {
  dia: string;
  pessoas: Record<string, DadosDaPessoa>;
  conversas: Record<string, EstadoConversa>;
}

function novoBanco(agora = new Date()): Banco {
  const pessoas = Object.fromEntries(SEMENTES.map((s) => [s.persona.id, materializar(s, agora)]));
  const conversas = Object.fromEntries(SEMENTES.map((s) => [s.persona.id, ESTADO_INICIAL]));
  return { dia: chaveDoDia(agora), pessoas, conversas };
}

function carregar(): Banco {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo) {
      const banco = JSON.parse(salvo) as Banco;
      if (banco.dia === chaveDoDia(new Date())) return banco;
    }
  } catch {
    // Sem localStorage (aba anônima, bloqueio): segue só em memória.
  }
  return novoBanco();
}

let banco: Banco | null = null;
const ouvintes = new Set<() => void>();

export function obterBanco(): Banco {
  banco ??= carregar();
  return banco;
}

export function pessoa(id: string): DadosDaPessoa {
  const dados = obterBanco().pessoas[id];
  if (!dados) throw new Error(`Pessoa não encontrada: ${id}`);
  return dados;
}

/** Grava a mudança e avisa as telas. */
export function salvar(): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(obterBanco()));
  } catch {
    // Idem: sem armazenamento, os dados ficam só nesta aba.
  }
  ouvintes.forEach((o) => o());
}

export function recomecarBanco(): void {
  banco = novoBanco();
  salvar();
}

export function aoMudar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

let contador = 0;
export function novoId(prefixo: string): string {
  contador++;
  return `${prefixo}-${Date.now().toString(36)}-${contador}`;
}

/** Pequena espera para a demonstração parecer uma chamada de rede. */
export const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
