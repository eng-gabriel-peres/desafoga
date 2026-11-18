/**
 * O que a Luana manda sozinha em cada momento: os check-ins nos horários da
 * rotina, a conta que vence amanhã e o dia de guardar das metas. Regra pura;
 * quem envia (e garante que cada chave sai uma vez só) é o servidor.
 */
import { timingSafeEqual } from "node:crypto";
import { lembreteDeConta, mensagemDeLembrete, perguntaDoCheckIn } from "@/lib/assistente/textos";
import { situacaoDaMeta, type CheckIn, type ContaFixa, type Meta, type Pagamento, type Periodo, type Rotina } from "@/lib/finance";

export interface DadosDoAgendador {
  pessoaId: string;
  apelido: string;
  rotina: Rotina;
  checkins: CheckIn[];
  contas: ContaFixa[];
  pagamentos: Pagamento[];
  metas: Meta[];
}

export interface Envio {
  /** Única por envio: o servidor manda cada chave uma vez só. */
  chave: string;
  tipo: "checkin" | "conta" | "meta";
  texto: string;
}

/** Até quanto tempo depois do horário o check-in ainda sai (o agendador do GitHub atrasa). */
const JANELA_DO_CHECKIN_MIN = 60;
/** Lembretes de conta e de meta só saem entre estas horas. */
const HORA_DA_CONTA = 9;
const HORA_DA_META = 10;
const ULTIMA_HORA = 21;

const PERIODOS: Periodo[] = ["manha", "tarde", "noite"];

/** Brasília não tem horário de verão desde 2019: UTC-3 o ano todo. */
const emBrasilia = (d: Date) => new Date(d.getTime() - 3 * 3_600_000);
const chaveDoDia = (b: Date) => b.toISOString().slice(0, 10);
const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();

/** Chave do check-in de um dia ("YYYY-MM-DD") e período. */
export const chaveDoCheckIn = (pessoaId: string, dia: string, periodo: Periodo) => `checkin:${pessoaId}:${dia}:${periodo}`;

function checkins(d: DadosDoAgendador, b: Date): Envio[] {
  const dia = chaveDoDia(b);
  const minutos = b.getUTCHours() * 60 + b.getUTCMinutes();
  return PERIODOS.filter((p) => {
    if (!d.rotina.ligados[p]) return false;
    const [h, m] = d.rotina.horarios[p].split(":").map(Number);
    const depois = minutos - (h * 60 + m);
    if (depois < 0 || depois >= JANELA_DO_CHECKIN_MIN) return false;
    return !d.checkins.some((c) => c.dia === dia && c.periodo === p);
  }).map((p) => ({ chave: chaveDoCheckIn(d.pessoaId, dia, p), tipo: "checkin" as const, texto: perguntaDoCheckIn(d.apelido, p) }));
}

function contas(d: DadosDoAgendador, b: Date): Envio[] {
  if (b.getUTCHours() < HORA_DA_CONTA || b.getUTCHours() >= ULTIMA_HORA) return [];
  const amanha = new Date(b.getTime() + 86_400_000);
  const ano = amanha.getUTCFullYear();
  const mesIdx = amanha.getUTCMonth();
  const mes = chaveDoDia(amanha).slice(0, 7);
  return d.contas
    .filter((c) => c.lembrete && !c.debitoAutomatico)
    .filter((c) => Math.min(Math.max(1, c.vencimento), diasNoMes(ano, mesIdx)) === amanha.getUTCDate())
    .filter((c) => !d.pagamentos.some((p) => p.tipo === "conta" && p.alvoId === c.id && p.mes === mes))
    .map((c) => ({ chave: `conta:${d.pessoaId}:${c.id}:${mes}`, tipo: "conta" as const, texto: lembreteDeConta(d.apelido, c) }));
}

/** Hoje é dia de guardar? No mesmo dia da semana (ou do mês) em que a meta foi criada. */
function diaDeGuardar(m: Meta, b: Date): boolean {
  const hoje = chaveDoDia(b);
  if (hoje <= m.criadaEm) return false;
  const criada = new Date(`${m.criadaEm}T00:00:00Z`);
  if (m.frequencia === "dia") return true;
  if (m.frequencia === "semana") return criada.getUTCDay() === b.getUTCDay();
  return Math.min(criada.getUTCDate(), diasNoMes(b.getUTCFullYear(), b.getUTCMonth())) === b.getUTCDate();
}

function metas(d: DadosDoAgendador, b: Date, agora: Date): Envio[] {
  if (b.getUTCHours() < HORA_DA_META || b.getUTCHours() >= ULTIMA_HORA) return [];
  const dia = chaveDoDia(b);
  return d.metas
    .filter((m) => m.lembrete && diaDeGuardar(m, b))
    .filter((m) => !m.depositos.some((x) => chaveDoDia(emBrasilia(new Date(x.quando))) === dia))
    .map((m) => ({ m, s: situacaoDaMeta(m, agora) }))
    .filter(({ s }) => !s.concluida)
    .map(({ m, s }) => ({ chave: `meta:${d.pessoaId}:${m.id}:${dia}`, tipo: "meta" as const, texto: mensagemDeLembrete(m, s) }));
}

export function enviosDoMomento(d: DadosDoAgendador, agora: Date): Envio[] {
  const b = emBrasilia(agora);
  return [...checkins(d, b), ...contas(d, b), ...metas(d, b, agora)];
}

/**
 * O cabeçalho `Authorization: Bearer <segredo>` confere com o segredo do
 * ambiente. Sem segredo configurado, ninguém entra (fecha por padrão).
 */
export function autorizadoNoAgendador(cabecalho: string | null, segredo: string | undefined): boolean {
  if (!segredo || !cabecalho?.startsWith("Bearer ")) return false;
  const x = Buffer.from(cabecalho.slice(7));
  const y = Buffer.from(segredo);
  return x.length === y.length && timingSafeEqual(x, y);
}
