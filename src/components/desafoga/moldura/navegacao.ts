import { Brain, ClipboardList, House, MessageCircle, Plus, UserRound, Users, Wallet, type LucideIcon } from "lucide-react";

/**
 * O Desafoga tem duas áreas separadas:
 * - "pessoa": o app de quem usa (/app);
 * - "responsavel": o painel do profissional que acompanha (/painel).
 */
export type Area = "pessoa" | "responsavel";

export interface ItemDoMenu {
  href: string;
  rotulo: string;
  Icone: LucideIcon;
  /** Marca o item como página atual. */
  ativo: (caminho: string) => boolean;
}

export function itensDoMenu(area: Area, pacienteId: string): ItemDoMenu[] {
  if (area === "pessoa") {
    return [
      { href: "/app/hoje", rotulo: "Hoje", Icone: House, ativo: (c) => c === "/app/hoje" },
      { href: "/app/registrar", rotulo: "Registrar", Icone: Plus, ativo: (c) => c === "/app/registrar" },
      { href: "/app/assistente", rotulo: "Assistente", Icone: MessageCircle, ativo: (c) => c === "/app/assistente" },
      { href: "/app/dividas", rotulo: "Dívidas", Icone: Wallet, ativo: (c) => c.startsWith("/app/dividas") },
      { href: "/app/perfil", rotulo: "Perfil", Icone: UserRound, ativo: (c) => c === "/app/perfil" || c === "/app/conectar" },
    ];
  }
  const base = `/painel/${pacienteId}`;
  return [
    { href: "/painel", rotulo: "Pacientes", Icone: Users, ativo: (c) => c === "/painel" },
    { href: base, rotulo: "Resumo", Icone: ClipboardList, ativo: (c) => /^\/painel\/[^/]+$/.test(c) },
    { href: `${base}/dividas`, rotulo: "Dívidas", Icone: Wallet, ativo: (c) => /^\/painel\/[^/]+\/dividas$/.test(c) },
    { href: `${base}/memoria`, rotulo: "Memória", Icone: Brain, ativo: (c) => c.endsWith("/memoria") },
  ];
}

interface Titulo {
  titulo: string;
  subtitulo?: string;
}

/** Título do cabeçalho do desktop para cada rota. */
export function tituloDaRota(caminho: string): Titulo {
  if (caminho === "/app/registrar") return { titulo: "Registrar compra", subtitulo: "Leva menos de 30 segundos" };
  if (caminho === "/app/assistente") return { titulo: "Assistente", subtitulo: "Converse com a Luana como no WhatsApp" };
  if (caminho === "/app/dividas/fatura") return { titulo: "Enviar fatura", subtitulo: "A Luana lê os lançamentos e separa juros e tarifas" };
  if (caminho === "/app/perfil") return { titulo: "Perfil", subtitulo: "WhatsApp, quem te acompanha e seus dados" };
  if (caminho === "/app/conectar") return { titulo: "Conectar WhatsApp", subtitulo: "Pelo link que a Luana mandou" };
  if (caminho === "/app/dividas") return { titulo: "Dívidas", subtitulo: "Quanto suas dívidas custam e como sair delas" };
  if (caminho === "/painel") return { titulo: "Pacientes", subtitulo: "Quem você acompanha, nos últimos 7 dias" };
  if (/^\/painel\/[^/]+\/dividas$/.test(caminho)) return { titulo: "Dívidas do paciente", subtitulo: "Só leitura. Você pode sugerir um valor mensal." };
  if (caminho.endsWith("/memoria")) return { titulo: "Memória do assistente", subtitulo: "O que a Luana sabe para conversar melhor" };
  if (caminho.startsWith("/painel/")) return { titulo: "Resumo do paciente", subtitulo: "Últimos 7 dias" };
  return { titulo: "Hoje" };
}

/** Troca o paciente mantendo a mesma tela: /painel/ana/dividas -> /painel/lucia/dividas. */
export function rotaDeOutroPaciente(caminho: string, pacienteId: string): string {
  const m = caminho.match(/^\/painel\/[^/]+(\/.*)?$/);
  return `/painel/${pacienteId}${m?.[1] ?? ""}`;
}

export const temPaciente = (caminho: string) => /^\/painel\/[^/]+/.test(caminho);
