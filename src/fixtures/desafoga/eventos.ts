/**
 * Eventos da demonstração (os do protótipo), criados pela Paula. Datas em
 * dias a partir de hoje; `por` é o id curto de quem escreveu ("sistema" sem autor).
 */
import type { Categoria } from "@/lib/finance";

export interface SementePost {
  dias: number;
  hora: string;
  por: string;
  tipo: "recado" | "dica" | "conquista" | "desabafo" | "aviso" | "sistema";
  texto: string;
  apoios?: string[];
  fixado?: boolean;
}

export interface SementeEvento {
  autor: string;
  tipo: "desafio" | "presencial";
  nome: string;
  descricao: string;
  regra?: "sem-desnecessaria" | "sem-categoria" | "limite-dia" | "nota-boa";
  categoria?: Categoria;
  /** Dias a partir de hoje (negativo: passado). */
  inicio?: number;
  fim?: number;
  data?: number;
  hora?: string;
  local?: string;
  premio?: string;
  participantes: { quem: string; entrou: number; resposta?: "vou" | "talvez" | "nao" }[];
  posts: SementePost[];
}

export const EVENTOS_DA_DEMO: SementeEvento[] = [
  {
    autor: "paula",
    tipo: "desafio",
    nome: "7 dias sem delivery",
    descricao: "Uma semana sem pedir comida por aplicativo. Quem cozinhar algo diferente pode contar no grupo.",
    regra: "sem-categoria",
    categoria: "Comida pronta",
    inicio: -4,
    fim: 2,
    premio: "Café da manhã juntos no encerramento",
    participantes: [
      { quem: "ana", entrou: -4 },
      { quem: "carlos", entrou: -4 },
      { quem: "rafael", entrou: -3 },
    ],
    posts: [
      { dias: 4, hora: "08:30", por: "paula", tipo: "aviso", texto: "Bem-vindos ao desafio! A ideia não é ser perfeito. Se escorregar, conte aqui e recomece no dia seguinte.", apoios: ["ana", "carlos", "rafael"], fixado: true },
      { dias: 3, hora: "12:10", por: "carlos", tipo: "dica", texto: "Fiz marmita para três dias no domingo. Ajudou muito a não pedir nada no almoço.", apoios: ["ana", "paula"] },
      { dias: 3, hora: "19:05", por: "sistema", tipo: "sistema", texto: "Rafael entrou no evento." },
      { dias: 1, hora: "23:40", por: "rafael", tipo: "desabafo", texto: "Ontem à noite quase pedi pizza. Fui dormir e a vontade passou.", apoios: ["carlos", "paula", "ana"] },
      { dias: 0, hora: "09:15", por: "ana", tipo: "recado", texto: "Escorreguei ontem com um lanche, mas hoje estou firme.", apoios: ["paula"] },
    ],
  },
  {
    autor: "paula",
    tipo: "desafio",
    nome: "Semana do essencial",
    descricao: "Durante a semana, comprar só o que for necessário. Antes de qualquer compra, a pergunta: eu preciso disso agora?",
    regra: "sem-desnecessaria",
    inicio: -2,
    fim: 4,
    participantes: [
      { quem: "ana", entrou: -2 },
      { quem: "lucia", entrou: -2 },
      { quem: "rafael", entrou: -2 },
    ],
    posts: [
      { dias: 2, hora: "09:00", por: "paula", tipo: "aviso", texto: "Antes de qualquer compra nesta semana, pergunte: eu preciso disso agora? Se a resposta for talvez, espere até amanhã.", apoios: ["lucia"], fixado: true },
      { dias: 1, hora: "15:20", por: "lucia", tipo: "dica", texto: "Anoto num papel o que quero comprar e espero até o dia seguinte. Metade das vezes desisto.", apoios: ["ana", "paula", "rafael"] },
      { dias: 0, hora: "10:05", por: "rafael", tipo: "recado", texto: "Alguém tem dica para não comprar quando está entediado?" },
    ],
  },
  {
    autor: "paula",
    tipo: "presencial",
    nome: "Roda de conversa: compras e emoções",
    descricao: "Encontro em grupo para conversar sobre o que cada um percebeu com a nota do dia. Traga suas dúvidas.",
    data: 3,
    hora: "19:00",
    local: "Clínica Reis, sala 2. Rua das Flores, 120",
    participantes: [
      { quem: "ana", entrou: 0, resposta: "vou" },
      { quem: "carlos", entrou: 0, resposta: "talvez" },
      { quem: "lucia", entrou: 0, resposta: "vou" },
      { quem: "rafael", entrou: 0 },
    ],
    posts: [
      { dias: 1, hora: "10:00", por: "paula", tipo: "aviso", texto: "Teremos café e bolo. Se puder, chegue 10 minutos antes.", apoios: ["ana", "lucia"], fixado: true },
      { dias: 0, hora: "11:30", por: "carlos", tipo: "recado", texto: "Posso levar alguém da família?" },
    ],
  },
];
