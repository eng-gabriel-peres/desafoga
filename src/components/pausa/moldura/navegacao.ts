import { Brain, ClipboardList, House, MessageCircle, Plus, Users, Wallet, type LucideIcon } from "lucide-react";

export type Modo = "pessoa" | "responsavel";

/** Persona do modo "Pessoa" na demonstração. */
export const PESSOA_DA_DEMO = "ana";

export interface ItemDoMenu {
  href: string;
  rotulo: string;
  Icone: LucideIcon;
  /** Marca o item como página atual. */
  ativo: (caminho: string) => boolean;
}

export function modoDaRota(caminho: string): Modo {
  return caminho.startsWith("/pacientes") ? "responsavel" : "pessoa";
}

export function itensDoMenu(modo: Modo, pacienteId: string): ItemDoMenu[] {
  if (modo === "pessoa") {
    return [
      { href: "/hoje", rotulo: "Hoje", Icone: House, ativo: (c) => c === "/hoje" },
      { href: "/registrar", rotulo: "Registrar", Icone: Plus, ativo: (c) => c === "/registrar" },
      { href: "/assistente", rotulo: "Assistente", Icone: MessageCircle, ativo: (c) => c === "/assistente" },
      { href: "/dividas", rotulo: "Dívidas", Icone: Wallet, ativo: (c) => c.startsWith("/dividas") },
    ];
  }
  const base = `/pacientes/${pacienteId}`;
  return [
    { href: "/pacientes", rotulo: "Pacientes", Icone: Users, ativo: (c) => c === "/pacientes" },
    { href: base, rotulo: "Resumo", Icone: ClipboardList, ativo: (c) => /^\/pacientes\/[^/]+$/.test(c) },
    { href: `${base}/dividas`, rotulo: "Dívidas", Icone: Wallet, ativo: (c) => c.endsWith("/dividas") },
    { href: `${base}/memoria`, rotulo: "Memória", Icone: Brain, ativo: (c) => c.endsWith("/memoria") },
  ];
}

interface Titulo {
  titulo: string;
  subtitulo?: string;
}

/** Título do cabeçalho do desktop para cada rota. */
export function tituloDaRota(caminho: string): Titulo {
  if (caminho === "/registrar") return { titulo: "Registrar compra", subtitulo: "Leva menos de 30 segundos" };
  if (caminho === "/assistente") return { titulo: "Assistente", subtitulo: "Converse com a Luana como no WhatsApp" };
  if (caminho === "/dividas/fatura") return { titulo: "Enviar fatura", subtitulo: "A Luana lê os lançamentos e separa juros e tarifas" };
  if (caminho === "/dividas") return { titulo: "Dívidas", subtitulo: "Quanto suas dívidas custam e como sair delas" };
  if (caminho === "/pacientes") return { titulo: "Pacientes", subtitulo: "Quem você acompanha, nos últimos 7 dias" };
  if (caminho.endsWith("/dividas")) return { titulo: "Dívidas do paciente", subtitulo: "Só leitura. Você pode sugerir um valor mensal." };
  if (caminho.endsWith("/memoria")) return { titulo: "Memória do assistente", subtitulo: "O que a Luana sabe para conversar melhor" };
  if (caminho.startsWith("/pacientes/")) return { titulo: "Resumo do paciente", subtitulo: "Últimos 7 dias" };
  return { titulo: "Hoje" };
}

/** Troca o paciente mantendo a mesma tela: /pacientes/ana/dividas -> /pacientes/lucia/dividas. */
export function rotaDeOutroPaciente(caminho: string, pacienteId: string): string {
  const m = caminho.match(/^\/pacientes\/[^/]+(\/.*)?$/);
  return `/pacientes/${pacienteId}${m?.[1] ?? ""}`;
}
