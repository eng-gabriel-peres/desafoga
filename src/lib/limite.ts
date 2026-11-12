import { createHash } from "node:crypto";
import { Pool } from "pg";
import { hojeEmBrasilia } from "@/lib/luana/lancamentos";

/**
 * Limite de uso por dia. Protege a cota do modelo de IA e o banco numa demo
 * pública: conta por visitante, por endereço de rede e no total do site.
 */

export type Recurso = "texto" | "arquivo" | "audio";

/** Pedidos por dia de um mesmo visitante. */
export const LIMITE_POR_VISITANTE: Record<Recurso, number> = { texto: 200, arquivo: 40, audio: 40 };
/** Um endereço de rede pode ter várias pessoas (casa, empresa): folga maior. */
export const FOLGA_POR_REDE = 3;
/** Teto diário do site inteiro, somando tudo. Ajustável por LIMITE_GLOBAL_DIARIO. */
export const LIMITE_GLOBAL_PADRAO = 4000;

export interface Veredito {
  permitido: boolean;
  /** Mensagem pronta para a conversa quando o pedido é recusado. */
  mensagem?: string;
}

/** Soma 1 em cada chave no dia e devolve o total de cada uma depois da soma. */
export type Contador = ((chaves: string[], dia: string) => Promise<Map<string, number>>) & {
  /** Lê, sem somar, as chaves pedidas e todas as que começam com o prefixo. */
  ler?: (dia: string, chaves: string[], prefixo: string) => Promise<Map<string, number>>;
};

const NOME: Record<Recurso, string> = { texto: "mensagens", arquivo: "arquivos", audio: "áudios" };

export function criarLimitador(contar: Contador, limiteGlobal = LIMITE_GLOBAL_PADRAO) {
  return async function consumir(recurso: Recurso, visitante: string, rede: string | null): Promise<Veredito> {
    const chaveDoVisitante = `v:${recurso}:${visitante}`;
    const chaveDaRede = rede ? `r:${recurso}:${rede}` : null;
    const chaves = [chaveDoVisitante, "global", ...(chaveDaRede ? [chaveDaRede] : [])];

    let totais: Map<string, number>;
    try {
      totais = await contar(chaves, hojeEmBrasilia());
    } catch (erro) {
      // Sem contagem não dá para limitar; melhor atender do que travar a conversa.
      console.error("Limite de uso indisponível:", erro);
      return { permitido: true };
    }

    const limite = LIMITE_POR_VISITANTE[recurso];
    if ((totais.get(chaveDoVisitante) ?? 0) > limite) {
      return {
        permitido: false,
        mensagem: `Você chegou ao limite de hoje (${limite} ${NOME[recurso]}). Amanhã eu volto a ${recurso === "texto" ? "responder" : "ler"} normalmente; o que já anotei continua guardado.`,
      };
    }
    if (chaveDaRede && (totais.get(chaveDaRede) ?? 0) > limite * FOLGA_POR_REDE) {
      return {
        permitido: false,
        mensagem: "Recebi pedidos demais da sua rede hoje e precisei pausar. Tente de novo amanhã.",
      };
    }
    if ((totais.get("global") ?? 0) > limiteGlobal) {
      return {
        permitido: false,
        mensagem: "Atingi o limite de atendimentos de hoje. Volto amanhã; o que já anotei continua guardado.",
      };
    }
    return { permitido: true };
  };
}

/** Contador em memória: usado sem banco (desenvolvimento) e nos testes. */
export function contadorEmMemoria(): Contador {
  const totais = new Map<string, number>();
  const contar: Contador = async (chaves, dia) => {
    const saida = new Map<string, number>();
    for (const chave of chaves) {
      const total = (totais.get(`${dia}|${chave}`) ?? 0) + 1;
      totais.set(`${dia}|${chave}`, total);
      saida.set(chave, total);
    }
    return saida;
  };
  contar.ler = async (dia, chaves, prefixo) => {
    const saida = new Map<string, number>();
    for (const [completa, total] of totais) {
      const [doDia, chave] = [completa.slice(0, dia.length), completa.slice(dia.length + 1)];
      if (doDia === dia && (chaves.includes(chave) || chave.startsWith(prefixo))) saida.set(chave, total);
    }
    return saida;
  };
  return contar;
}

/** Contador no Postgres: vale entre instâncias, que na Vercel não compartilham memória. */
export function contadorPostgres(url: string): Contador {
  const pool = new Pool({ connectionString: url, max: 2 });
  let tabela: Promise<unknown> | null = null;
  const pronto = () =>
    (tabela ??= pool
      .query(
        `create table if not exists uso (
           chave text not null,
           dia date not null,
           total integer not null,
           primary key (chave, dia)
         )`,
      )
      // A contagem só interessa no dia; o que passou de uma semana sai.
      .then(() => pool.query("delete from uso where dia < current_date - 7"))
      .catch((erro) => {
        tabela = null;
        throw erro;
      }));

  const contar: Contador = async (chaves, dia) => {
    await pronto();
    const r = await pool.query<{ chave: string; total: number }>(
      `insert into uso (chave, dia, total)
       select chave, $2::date, 1 from unnest($1::text[]) as chave
       on conflict (chave, dia) do update set total = uso.total + 1
       returning chave, total`,
      [chaves, dia],
    );
    return new Map(r.rows.map((linha) => [linha.chave, linha.total]));
  };
  contar.ler = async (dia, chaves, prefixo) => {
    await pronto();
    const r = await pool.query<{ chave: string; total: number }>(
      "select chave, total from uso where dia = $1::date and (chave = any($2::text[]) or left(chave, length($3)) = $3)",
      [dia, chaves, prefixo],
    );
    return new Map(r.rows.map((linha) => [linha.chave, linha.total]));
  };
  return contar;
}

let contador: Contador | null = null;
let atual: ReturnType<typeof criarLimitador> | null = null;

function contadorAtual(): Contador {
  const url = process.env.DATABASE_URL;
  return (contador ??= url ? contadorPostgres(url) : contadorEmMemoria());
}

function limiteGlobal(): number {
  const global = Number(process.env.LIMITE_GLOBAL_DIARIO);
  return Number.isFinite(global) && global > 0 ? global : LIMITE_GLOBAL_PADRAO;
}

/** Conta um pedido e diz se ele pode ser atendido. */
export function consumir(recurso: Recurso, visitante: string, rede: string | null): Promise<Veredito> {
  atual ??= criarLimitador(contadorAtual(), limiteGlobal());
  return atual(recurso, visitante, rede);
}

export type ResultadoDaIA = "ok" | "sem_cota" | "falha";

/** Anota como terminou uma chamada ao modelo de IA. Nunca atrapalha a chamada. */
export function registrarIA(modelo: string, resultado: ResultadoDaIA): void {
  void contadorAtual()([`ia:${resultado}:${modelo}`], hojeEmBrasilia()).catch(() => {});
}

export interface UsoDeHoje {
  voce: Record<Recurso, { usados: number; limite: number }>;
  site: { usados: number; limite: number };
  /** Chamadas ao modelo de IA hoje, por modelo. */
  ia: { modelo: string; ok: number; semCota: number; falha: number }[];
}

/** Uso do dia para o painel: o do visitante, o do site e o da cota da IA. */
export async function usoDeHoje(visitante: string): Promise<UsoDeHoje | null> {
  const recursos: Recurso[] = ["texto", "arquivo", "audio"];
  let totais: Map<string, number>;
  try {
    const ler = contadorAtual().ler;
    if (!ler) return null;
    totais = await ler(hojeEmBrasilia(), ["global", ...recursos.map((r) => `v:${r}:${visitante}`)], "ia:");
  } catch {
    return null;
  }

  const modelos = new Map<string, { modelo: string; ok: number; semCota: number; falha: number }>();
  for (const [chave, total] of totais) {
    const m = /^ia:(ok|sem_cota|falha):(.+)$/.exec(chave);
    if (!m) continue;
    const linha = modelos.get(m[2]) ?? { modelo: m[2], ok: 0, semCota: 0, falha: 0 };
    linha[m[1] === "ok" ? "ok" : m[1] === "sem_cota" ? "semCota" : "falha"] += total;
    modelos.set(m[2], linha);
  }

  return {
    voce: Object.fromEntries(
      recursos.map((r) => [r, { usados: totais.get(`v:${r}:${visitante}`) ?? 0, limite: LIMITE_POR_VISITANTE[r] }]),
    ) as UsoDeHoje["voce"],
    site: { usados: totais.get("global") ?? 0, limite: limiteGlobal() },
    ia: [...modelos.values()].sort((a, b) => b.ok + b.semCota + b.falha - (a.ok + a.semCota + a.falha)),
  };
}

/**
 * Identificador da rede de quem chamou. É um resumo (hash) do endereço que a
 * hospedagem informa: serve para contar, sem guardar o endereço em si.
 */
export function redeDe(cabecalhos: Headers): string | null {
  const endereco = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim();
  return endereco ? createHash("sha256").update(endereco).digest("hex").slice(0, 16) : null;
}
