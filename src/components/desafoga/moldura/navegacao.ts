import { AlarmClock, BarChart3, Brain, CalendarCheck, CalendarDays, ChartPie, ClipboardList, House, MessageCircle, Plus, Target, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";

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
  /** Item principal, em destaque no meio da barra. */
  destaque?: boolean;
  /** Só na barra lateral do desktop; no celular o acesso fica na tela Hoje. */
  soDesktop?: boolean;
  /** Em vez de trocar de tela, abre o registro de compra por cima da atual. */
  abreRegistro?: boolean;
}

/** Telas do painel que não são de um paciente (eventos com várias pessoas). */
const foraDoPaciente = (c: string) => /^\/painel\/eventos(\/|$)/.test(c);

export function itensDoMenu(area: Area, pacienteId: string): ItemDoMenu[] {
  if (area === "pessoa") {
    return [
      { href: "/app/hoje", rotulo: "Hoje", Icone: House, ativo: (c) => c === "/app/hoje" },
      { href: "/app/registrar", rotulo: "Registrar", Icone: Plus, ativo: (c) => c === "/app/registrar", abreRegistro: true },
      { href: "/app/assistente", rotulo: "Assistente", Icone: MessageCircle, ativo: (c) => c === "/app/assistente", destaque: true },
      { href: "/app/dividas", rotulo: "Dívidas", Icone: Wallet, ativo: (c) => c.startsWith("/app/dividas") },
      { href: "/app/metas", rotulo: "Metas", Icone: Target, ativo: (c) => c.startsWith("/app/metas") },
      { href: "/app/contas", rotulo: "Contas", Icone: CalendarCheck, ativo: (c) => c === "/app/contas", soDesktop: true },
      { href: "/app/orcamento", rotulo: "Orçamento", Icone: ChartPie, ativo: (c) => c === "/app/orcamento", soDesktop: true },
      { href: "/app/semana", rotulo: "Semana", Icone: BarChart3, ativo: (c) => c === "/app/semana", soDesktop: true },
      { href: "/app/eventos", rotulo: "Eventos", Icone: CalendarDays, ativo: (c) => c.startsWith("/app/eventos"), soDesktop: true },
      { href: "/app/conquistas", rotulo: "Conquistas", Icone: Trophy, ativo: (c) => c === "/app/conquistas", soDesktop: true },
      { href: "/app/rotina", rotulo: "Rotina", Icone: AlarmClock, ativo: (c) => c === "/app/rotina", soDesktop: true },
    ];
  }
  const base = `/painel/${pacienteId}`;
  return [
    { href: "/painel", rotulo: "Pacientes", Icone: Users, ativo: (c) => c === "/painel" },
    { href: base, rotulo: "Resumo", Icone: ClipboardList, ativo: (c) => /^\/painel\/[^/]+$/.test(c) && !foraDoPaciente(c) },
    { href: `${base}/dividas`, rotulo: "Dívidas", Icone: Wallet, ativo: (c) => /^\/painel\/[^/]+\/dividas$/.test(c) },
    { href: `${base}/contas`, rotulo: "Contas", Icone: CalendarCheck, ativo: (c) => /^\/painel\/[^/]+\/contas$/.test(c) },
    { href: `${base}/metas`, rotulo: "Metas", Icone: Target, ativo: (c) => /^\/painel\/[^/]+\/metas/.test(c) },
    { href: `${base}/memoria`, rotulo: "Memória", Icone: Brain, ativo: (c) => c.endsWith("/memoria") },
    { href: `${base}/conquistas`, rotulo: "Conquistas", Icone: Trophy, ativo: (c) => c.endsWith("/conquistas") },
    { href: "/painel/eventos", rotulo: "Eventos", Icone: CalendarDays, ativo: foraDoPaciente },
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
  if (caminho === "/app/contas") return { titulo: "Contas do mês", subtitulo: "O que você paga todo mês e quando vence" };
  if (caminho === "/app/rotina") return { titulo: "Rotina e privacidade", subtitulo: "Seus horários e o que quem te acompanha vê" };
  if (/^\/painel\/[^/]+\/contas$/.test(caminho)) return { titulo: "Contas do paciente", subtitulo: "Só leitura, se a pessoa compartilhou" };
  if (caminho === "/app/eventos") return { titulo: "Eventos", subtitulo: "Desafios e encontros de que você participa" };
  if (caminho.startsWith("/app/eventos/")) return { titulo: "Evento", subtitulo: "Mural, ranking e o seu andamento" };
  if (caminho === "/painel/eventos") return { titulo: "Eventos", subtitulo: "Desafios em grupo e encontros presenciais" };
  if (caminho === "/painel/eventos/novo") return { titulo: "Novo evento", subtitulo: "Desafio em grupo ou encontro presencial" };
  if (caminho.startsWith("/painel/eventos/")) return { titulo: "Evento", subtitulo: "Mural, ranking e andamento do grupo" };
  if (caminho === "/app/conquistas") return { titulo: "Conquistas", subtitulo: "Metas com prêmio que quem te acompanha criou" };
  if (/^\/painel\/[^/]+\/conquistas$/.test(caminho)) return { titulo: "Conquistas", subtitulo: "Metas com prêmio para o paciente" };
  if (caminho === "/app/semana") return { titulo: "Sua semana", subtitulo: "Os últimos 7 dias" };
  if (caminho === "/app/orcamento") return { titulo: "Orçamento", subtitulo: "Quanto você quer gastar por categoria no mês" };
  if (caminho === "/app/metas") return { titulo: "Metas", subtitulo: "Junte dinheiro para o que importa" };
  if (caminho === "/app/metas/nova") return { titulo: "Nova meta", subtitulo: "Junte dinheiro para o que importa" };
  if (/^\/app\/metas\/[^/]+\/ajustar$/.test(caminho)) return { titulo: "Ajustar meta" };
  if (caminho.startsWith("/app/metas/")) return { titulo: "Meta", subtitulo: "Seu ritmo, o plano e o histórico" };
  if (/^\/painel\/[^/]+\/metas/.test(caminho)) return { titulo: "Metas", subtitulo: "Só leitura. Você pode mandar um incentivo." };
  if (caminho === "/app/perfil") return { titulo: "Perfil", subtitulo: "WhatsApp, quem te acompanha e seus dados" };
  if (caminho === "/app/dividas") return { titulo: "Dívidas", subtitulo: "Quanto suas dívidas custam e como sair delas" };
  if (caminho === "/painel") return { titulo: "Pacientes", subtitulo: "Quem você acompanha, nos últimos 7 dias" };
  if (/^\/painel\/[^/]+\/dividas$/.test(caminho)) return { titulo: "Dívidas do paciente", subtitulo: "Só leitura. Você pode sugerir um valor mensal." };
  if (caminho.endsWith("/memoria")) return { titulo: "Memória do assistente", subtitulo: "O que a Luana sabe para conversar melhor" };
  if (caminho.startsWith("/painel/")) return { titulo: "Resumo do paciente", subtitulo: "Últimos 7 dias" };
  return { titulo: "Hoje" };
}

/** Troca o paciente mantendo a mesma tela: /painel/ana/dividas -> /painel/lucia/dividas. */
export function rotaDeOutroPaciente(caminho: string, pacienteId: string): string {
  // A meta aberta é de outra pessoa: volta para a lista de metas.
  if (/^\/painel\/[^/]+\/metas\//.test(caminho)) return `/painel/${pacienteId}/metas`;
  const m = caminho.match(/^\/painel\/[^/]+(\/.*)?$/);
  return `/painel/${pacienteId}${m?.[1] ?? ""}`;
}

export const temPaciente = (caminho: string) => /^\/painel\/[^/]+/.test(caminho) && !foraDoPaciente(caminho);
