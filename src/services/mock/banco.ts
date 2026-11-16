/**
 * Banco da versão local da demonstração: os dados fictícios guardados no
 * navegador. Serve para rodar o app sem servidor (NEXT_PUBLIC_DESAFOGA_DADOS=local).
 */
import { novoBanco, type Banco } from "../nucleo";

const CHAVE = "desafoga-demo-v2";
let banco: Banco | null = null;
const ouvintes = new Set<() => void>();

function carregar(): Banco {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo) {
      const lido = JSON.parse(salvo) as Banco;
      if (lido.versao === 2) return lido;
    }
  } catch {
    // Sem localStorage: segue só em memória.
  }
  return novoBanco();
}

export function obterBanco(): Banco {
  banco ??= carregar();
  return banco;
}

/** Grava a mudança e avisa as telas. */
export function salvar(): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(obterBanco()));
  } catch {
    // Sem armazenamento: os dados ficam só nesta aba.
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

export const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
