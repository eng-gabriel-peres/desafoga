import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Pool } from "pg";
import type { Conta } from "./resumo";

/**
 * Guarda os gastos de cada pessoa.
 * - Com DATABASE_URL: Postgres (Neon), uma linha por pessoa na tabela `contas`.
 * - Sem DATABASE_URL: arquivo .data/luana.json, só para desenvolver sem banco.
 */
export interface Repositorio {
  buscar(usuario: string): Promise<Conta>;
  salvar(usuario: string, conta: Conta): Promise<void>;
  apagar(usuario: string): Promise<void>;
}

function contaVazia(): Conta {
  return { lancamentos: [], rendaMensal: null, saldoEmConta: null, fatura: null };
}

export function repositorioPostgres(url: string): Repositorio & { fechar(): Promise<void> } {
  const pool = new Pool({ connectionString: url, max: 3 });
  let tabela: Promise<unknown> | null = null;
  const pronto = () =>
    (tabela ??= pool
      .query(
        `create table if not exists contas (
           usuario text primary key,
           dados jsonb not null,
           atualizado_em timestamptz not null default now()
         )`,
      )
      .catch((erro) => {
        tabela = null;
        throw erro;
      }));

  return {
    async buscar(usuario) {
      await pronto();
      const r = await pool.query<{ dados: Conta }>("select dados from contas where usuario = $1", [usuario]);
      return r.rows[0]?.dados ?? contaVazia();
    },
    async salvar(usuario, conta) {
      await pronto();
      await pool.query(
        `insert into contas (usuario, dados) values ($1, $2::jsonb)
         on conflict (usuario) do update set dados = excluded.dados, atualizado_em = now()`,
        [usuario, JSON.stringify(conta)],
      );
    },
    async apagar(usuario) {
      await pronto();
      await pool.query("delete from contas where usuario = $1", [usuario]);
    },
    fechar: () => pool.end(),
  };
}

export function repositorioEmArquivo(arquivo: string | null): Repositorio {
  let contas: Record<string, Conta> | null = null;
  const todas = () => {
    if (contas) return contas;
    contas = {};
    if (arquivo && existsSync(arquivo)) {
      try {
        contas = JSON.parse(readFileSync(arquivo, "utf8")) as Record<string, Conta>;
      } catch {
        // Arquivo corrompido: começa vazio em vez de derrubar a conversa.
      }
    }
    return contas;
  };
  const gravar = () => {
    if (!arquivo) return;
    mkdirSync(".data", { recursive: true });
    writeFileSync(arquivo, JSON.stringify(todas()));
  };

  return {
    async buscar(usuario) {
      return todas()[usuario] ?? contaVazia();
    },
    async salvar(usuario, conta) {
      todas()[usuario] = conta;
      gravar();
    },
    async apagar(usuario) {
      delete todas()[usuario];
      gravar();
    },
  };
}

let atual: Repositorio | null = null;

function repositorio(): Repositorio {
  if (atual) return atual;
  const url = process.env.DATABASE_URL;
  if (url) return (atual = repositorioPostgres(url));
  const emDisco = !process.env.VERCEL && process.env.NODE_ENV !== "test";
  return (atual = repositorioEmArquivo(emDisco ? ".data/luana.json" : null));
}

export const buscarConta = (usuario: string) => repositorio().buscar(usuario);
export const salvarConta = (usuario: string, conta: Conta) => repositorio().salvar(usuario, conta);
export const apagarConta = (usuario: string) => repositorio().apagar(usuario);
