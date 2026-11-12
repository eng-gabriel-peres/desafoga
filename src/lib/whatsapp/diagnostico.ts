/**
 * Últimos acontecimentos do webhook, em memória, para descobrir onde uma
 * conversa parou sem abrir os logs da hospedagem. Nunca guarda segredos nem
 * o telefone inteiro de quem escreveu.
 */
interface Evento {
  quando: string;
  etapa: string;
  detalhe?: string;
}

const eventos: Evento[] = [];

export function registrar(etapa: string, detalhe?: string): void {
  eventos.unshift({ quando: new Date().toISOString(), etapa, detalhe: detalhe?.slice(0, 400) });
  if (eventos.length > 30) eventos.length = 30;
}

export function ultimosEventos(): Evento[] {
  return eventos;
}

/** Mostra só o começo e o tamanho do telefone. */
export function mascarar(telefone: string): string {
  return `${telefone.slice(0, 4)}… (${telefone.length} dígitos)`;
}
