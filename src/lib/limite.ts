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
export type Contador = (chaves: string[], dia: string) => Promise<Map<string, number>>;

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
  return async (chaves, dia) => {
    const saida = new Map<string, number>();
    for (const chave of chaves) {
      const total = (totais.get(`${dia}|${chave}`) ?? 0) + 1;
      totais.set(`${dia}|${chave}`, total);
      saida.set(chave, total);
    }
    return saida;
  };
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

  return async (chaves, dia) => {
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
}

let atual: ReturnType<typeof criarLimitador> | null = null;

/** Conta um pedido e diz se ele pode ser atendido. */
export function consumir(recurso: Recurso, visitante: string, rede: string | null): Promise<Veredito> {
  if (!atual) {
    const url = process.env.DATABASE_URL;
    const global = Number(process.env.LIMITE_GLOBAL_DIARIO);
    atual = criarLimitador(
      url ? contadorPostgres(url) : contadorEmMemoria(),
      Number.isFinite(global) && global > 0 ? global : LIMITE_GLOBAL_PADRAO,
    );
  }
  return atual(recurso, visitante, rede);
}

/**
 * Identificador da rede de quem chamou. É um resumo (hash) do endereço que a
 * hospedagem informa: serve para contar, sem guardar o endereço em si.
 */
export function redeDe(cabecalhos: Headers): string | null {
  const endereco = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim();
  return endereco ? createHash("sha256").update(endereco).digest("hex").slice(0, 16) : null;
}
