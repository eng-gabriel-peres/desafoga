/**
 * Formato das sementes de dados fictícios. As datas são relativas ("N dias
 * atrás, às HH:MM") e viram datas reais quando a demonstração abre, para os
 * dados nunca ficarem velhos.
 */
import type {
  Aviso,
  CheckIn,
  Compra,
  Conquista,
  ContaFixa,
  Emocao,
  Pagamento,
  Periodo,
  Renda,
  Divida,
  Fatura,
  Mensagem,
  Memoria,
  Meta,
  Orcamento,
  Persona,
  Plano,
  TipoAviso,
} from "@/services/tipos";
import { chaveDoDia, chaveDoMes, compromissosDoMes, type Lancamento } from "@/lib/finance";
import type { SementeBanco } from "./banco-da-ana";

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

export interface SementeMeta extends Omit<Meta, "prazo" | "criadaEm" | "depositos"> {
  /** Prazo daqui a N dias (negativo: já passou), ou sem prazo. */
  prazoEmDias: number | null;
  criadaHaDias: number;
  depositos: ({ valor: number } & Quando)[];
}

/** Conquista criada pelo profissional `autorId` há N dias; com `concluidaHaDias`, já alcançada. */
export interface SementeConquista extends Omit<Conquista, "id" | "criadaEm" | "concluidaEm" | "autor"> {
  autorId: string;
  criadaHaDias: number;
  concluidaHaDias?: number;
}

export interface SementePessoa {
  persona: Persona;
  compras: SementeCompra[];
  dividas: Divida[];
  plano: Plano;
  faturas: SementeFatura[];
  memoria: Omit<Memoria, "anotacoes"> & { anotacoes: SementeAnotacao[] };
  avisos: SementeAviso[];
  conversa: SementeMensagem[];
  orcamentos?: Orcamento[];
  metas?: SementeMeta[];
  /** Contas fixas; as que já venceram neste mês entram como pagas (menos as marcadas `emAberto`). */
  contas?: (ContaFixa & { emAberto?: boolean })[];
  renda?: Renda;
  /** Humor de cada dia, do mais antigo (N dias atrás) até ontem: [manhã, meio-dia, noite]. Hoje: só os períodos de `checkinsDeHoje`. */
  checkins?: { diasAtras: number; humores: [Emocao, Emocao, Emocao] }[];
  checkinsDeHoje?: Partial<Record<Periodo, Emocao>>;
  /** As parcelas do plano que venceram antes de hoje entram como pagas neste mês. */
  parcelasEmDia?: boolean;
  /** Banco conectado de demonstração (sem Pluggy). */
  banco?: SementeBanco;
  conquistas?: SementeConquista[];
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
  orcamentos: Orcamento[];
  metas: Meta[];
  contas: ContaFixa[];
  pagamentos: Pagamento[];
  renda: Renda | null;
  checkins: CheckIn[];
}

const HORA_DO_CHECKIN: Record<Periodo, string> = { manha: "08:05", tarde: "12:05", noite: "20:05" };

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
    orcamentos: s.orcamentos ?? [],
    contas: (s.contas ?? []).map(({ emAberto, ...c }) => (void emAberto, c)),
    pagamentos: [
      ...(s.contas ?? [])
        .filter((c) => !c.emAberto && !c.debitoAutomatico && c.vencimento < agora.getDate())
        .map((c) => ({ tipo: "conta" as const, alvoId: c.id, mes: chaveDoMes(agora), valor: c.valor, quando: emData({ dias: 0, hora: "09:00" }, agora).toISOString() })),
      ...(s.parcelasEmDia ? compromissosDoMes([], s.dividas, s.plano, [], agora) : [])
        .filter((c) => c.dia < agora.getDate())
        .map((c) => ({ tipo: "divida" as const, alvoId: c.id, mes: chaveDoMes(agora), valor: c.valor, quando: emData({ dias: 0, hora: "09:00" }, agora).toISOString() })),
    ],
    renda: s.renda ?? null,
    checkins: [
      ...(s.checkins ?? []).flatMap(({ diasAtras, humores }) =>
        (["manha", "tarde", "noite"] as Periodo[]).map((periodo, i) => {
          const quando = emData({ dias: diasAtras, hora: HORA_DO_CHECKIN[periodo] }, agora);
          return { dia: chaveDoDia(quando), periodo, humor: humores[i], quando: quando.toISOString() };
        }),
      ),
      ...Object.entries(s.checkinsDeHoje ?? {}).map(([periodo, humor]) => {
        const quando = emData({ dias: 0, hora: HORA_DO_CHECKIN[periodo as Periodo] }, agora);
        return { dia: chaveDoDia(agora), periodo: periodo as Periodo, humor: humor as Emocao, quando: quando.toISOString() };
      }),
    ],
    metas: (s.metas ?? []).map(({ prazoEmDias, criadaHaDias, depositos, ...m }) => {
      const dia = (n: number) => chaveDoDia(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + n));
      return {
        ...m,
        prazo: prazoEmDias === null ? null : dia(prazoEmDias),
        criadaEm: dia(-criadaHaDias),
        depositos: depositos.map(({ dias, hora, valor }, i) => ({
          id: `${m.id}-d${i}`,
          valor,
          descricao: "Guardado",
          quando: iso({ dias, hora }),
          via: "app" as const,
        })),
      };
    }),
  };
}
