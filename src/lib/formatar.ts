/** Formatação de datas para a tela (não faz contas). */
import { chaveDoDia } from "@/lib/finance";

export { formatarReais as reais } from "@/lib/dinheiro";

const primeiraMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "13:25" */
export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** "Hoje", "Ontem" ou "Quinta, 12 de nov." */
export function nomeDoDia(chave: string, agora: Date): string {
  if (chave === chaveDoDia(agora)) return "Hoje";
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (chave === chaveDoDia(ontem)) return "Ontem";
  const [a, m, d] = chave.split("-").map(Number);
  return primeiraMaiuscula(
    new Date(a, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" }),
  );
}

/** "Ontem, 21:20" */
export function quando(iso: string, agora: Date): string {
  return `${nomeDoDia(chaveDoDia(new Date(iso)), agora)}, ${hora(iso)}`;
}

/** "Segunda-feira, 16 de novembro" */
export function dataPorExtenso(agora: Date): string {
  return primeiraMaiuscula(agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
}

/** Sigla do dia da semana: "Seg" */
export function diaDaSemanaCurto(chave: string): string {
  const [a, m, d] = chave.split("-").map(Number);
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][new Date(a, m - 1, d).getDay()];
}
