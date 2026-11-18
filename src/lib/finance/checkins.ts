/** Check-ins da rotina: como a pessoa está ao acordar, ao meio-dia e à noite. */
import type { CheckIn, Periodo, Rotina, ConfigDosAvisos } from "./tipos";

export const PERIODOS: Periodo[] = ["manha", "tarde", "noite"];

export const NOME_DO_PERIODO: Record<Periodo, string> = {
  manha: "Ao acordar",
  tarde: "Meio-dia",
  noite: "À noite",
};

/** Como vêm as contas novas; o lembrete diário começa desligado (a pessoa já tem o check-in da noite). */
export const AVISOS_PADRAO: ConfigDosAvisos = {
  lembreteDiario: false,
  horaDoLembrete: "21:00",
  compraAlta: true,
  valorDaCompraAlta: 20000,
  diaDificil: true,
  resumoDaSemana: true,
};

export const ROTINA_PADRAO: Rotina = {
  horarios: { manha: "08:00", tarde: "12:00", noite: "20:00" },
  ligados: { manha: true, tarde: true, noite: true },
  avisarQuandoTriste: true,
  compartilharContas: true,
};

export const checkInDe = (checkins: CheckIn[], dia: string, periodo: Periodo) =>
  checkins.find((c) => c.dia === dia && c.periodo === periodo);

/** "HH:MM" de agora, para comparar com os horários da rotina. */
export const horaMinuto = (agora: Date) =>
  `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;

/** O check-in já pode ser respondido (chegou o horário)? */
export const jaEHora = (rotina: Rotina, periodo: Periodo, agora: Date) => horaMinuto(agora) >= rotina.horarios[periodo];

/** O período do dia pelo horário: antes do meio-dia é manhã; depois das 18h, noite. */
export function periodoDaHora(agora: Date): Periodo {
  const h = agora.getHours();
  return h < 12 ? "manha" : h < 18 ? "tarde" : "noite";
}
