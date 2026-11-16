const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" no fuso local do aparelho. */
export function chaveDoDia(data: Date): string {
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

/** "YYYY-MM" no fuso local do aparelho. */
export function chaveDoMes(data: Date): string {
  return chaveDoDia(data).slice(0, 7);
}

/** Chave do dia de uma data em ISO. */
export function diaDe(iso: string): string {
  return chaveDoDia(new Date(iso));
}

/** Hora local (0 a 23) de uma data em ISO. */
export function horaDe(iso: string): number {
  return new Date(iso).getHours();
}

/** Os últimos `n` dias até hoje, do mais antigo para o mais recente. */
export function ultimosDias(hoje: Date, n: number): string[] {
  const dias: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i);
    dias.push(chaveDoDia(d));
  }
  return dias;
}
