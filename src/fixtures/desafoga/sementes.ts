/**
 * Formato das sementes de dados fictícios. As datas são relativas ("N dias
 * atrás, às HH:MM") e viram datas reais quando a demonstração abre, para os
 * dados nunca ficarem velhos.
 */
import type {
  Aviso,
  Compra,
  Divida,
  Fatura,
  Mensagem,
  Memoria,
  Persona,
  Plano,
  TipoAviso,
} from "@/services/tipos";
import { chaveDoDia, chaveDoMes, type Lancamento } from "@/lib/finance";

interface Quando {
  dias: number;
  /** "HH:MM" */
  hora: string;
}

export type SementeCompra = Omit<Compra, "quando" | "via" | "avaliacaoProfissional"> &
  Quando & { via?: Compra["via"]; avaliacao?: Compra["avaliacaoProfissional"] };

export type SementeLancamento = Omit<Lancamento, "data"> & { dias: number };

export interface SementeFatura extends Omit<Fatura, "mes" | "lancamentos"> {
  lancamentos: SementeLancamento[];
}

export type SementeMensagem = Omit<Mensagem, "quando" | "id"> & Quando;
export type SementeAviso = { id: string; tipo: TipoAviso; texto: string } & Quando;
export type SementeAnotacao = { id: string; autorId: string; texto: string; privada?: boolean } & Quando;

export interface SementePessoa {
  persona: Persona;
  compras: SementeCompra[];
  dividas: Divida[];
  plano: Plano;
  faturas: SementeFatura[];
  memoria: Omit<Memoria, "anotacoes"> & { anotacoes: SementeAnotacao[] };
  avisos: SementeAviso[];
  conversa: SementeMensagem[];
}

export interface DadosDaPessoa {
  persona: Persona;
  compras: Compra[];
  dividas: Divida[];
  plano: Plano;
  faturas: Fatura[];
  memoria: Memoria;
  avisos: Aviso[];
  conversa: Mensagem[];
}

/** Data real de "N dias atrás, às HH:MM". Nunca cai no futuro. */
export function emData({ dias, hora }: Quando, agora: Date): Date {
  const [h, m] = hora.split(":").map(Number);
  const d = new Date(agora);
  d.setDate(agora.getDate() - dias);
  d.setHours(h, m, 0, 0);
  if (d > agora) return new Date(agora.getTime() - 5 * 60_000);
  return d;
}

/** Dia de um lançamento: N dias atrás, sem sair do mês corrente. */
function diaNoMes(dias: number, agora: Date): string {
  const d = new Date(agora);
  d.setDate(Math.max(1, agora.getDate() - dias));
  return chaveDoDia(d);
}

export function materializarFatura(f: SementeFatura, agora: Date): Fatura {
  return {
    ...f,
    mes: chaveDoMes(agora),
    lancamentos: f.lancamentos.map(({ dias, ...l }) => ({ ...l, data: diaNoMes(dias, agora) })),
  };
}

export function materializar(s: SementePessoa, agora: Date): DadosDaPessoa {
  const iso = (q: Quando) => emData(q, agora).toISOString();
  return {
    persona: s.persona,
    dividas: s.dividas,
    plano: s.plano,
    compras: s.compras.map(({ dias, hora, via, avaliacao, ...c }) => ({
      ...c,
      quando: iso({ dias, hora }),
      via: via ?? "app",
      avaliacaoProfissional: avaliacao ?? null,
    })),
    faturas: s.faturas.map((f) => materializarFatura(f, agora)),
    memoria: {
      ...s.memoria,
      anotacoes: s.memoria.anotacoes.map(({ dias, hora, privada, ...a }) => ({
        ...a,
        privada: privada ?? false,
        quando: iso({ dias, hora }),
      })),
    },
    avisos: s.avisos.map(({ dias, hora, ...a }) => ({ ...a, pessoaId: s.persona.id, quando: iso({ dias, hora }) })),
    conversa: s.conversa.map(({ dias, hora, ...m }, i) => ({ ...m, id: `${s.persona.id}-m${i}`, quando: iso({ dias, hora }) })),
  };
}
