import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Conta } from "./resumo";

/**
 * Guarda os gastos de cada pessoa. Provisório até o banco (Neon) entrar:
 * - em desenvolvimento, grava em .data/luana.json para sobreviver a reinícios;
 * - na Vercel fica só em memória e se perde entre instâncias.
 */
const ARQUIVO = ".data/luana.json";
const EM_DISCO = !process.env.VERCEL && process.env.NODE_ENV !== "test";

let contas: Map<string, Conta> | null = null;

function carregar(): Map<string, Conta> {
  if (contas) return contas;
  contas = new Map();
  if (EM_DISCO && existsSync(ARQUIVO)) {
    try {
      contas = new Map(Object.entries(JSON.parse(readFileSync(ARQUIVO, "utf8")) as Record<string, Conta>));
    } catch {
      // Arquivo corrompido: começa vazio em vez de derrubar a conversa.
    }
  }
  return contas;
}

export function buscarConta(usuario: string): Conta {
  const todas = carregar();
  let conta = todas.get(usuario);
  if (!conta) {
    conta = { lancamentos: [], rendaMensal: null, saldoEmConta: null, fatura: null };
    todas.set(usuario, conta);
  }
  return conta;
}

export function salvar(): void {
  if (!EM_DISCO || !contas) return;
  mkdirSync(".data", { recursive: true });
  writeFileSync(ARQUIVO, JSON.stringify(Object.fromEntries(contas)));
}

export function apagarConta(usuario: string): void {
  carregar().delete(usuario);
  salvar();
}
