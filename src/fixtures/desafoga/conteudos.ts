/**
 * Conteúdos da demonstração (os do protótipo). Os de Helena e Juliana, que
 * não existem na demo, ficaram com a Paula e o Marcos.
 */
import type { CorDaCapa, Tema, TipoDeConteudo } from "@/lib/desafoga/conteudos";

export const BIOS: Record<string, string> = {
  paula: "Psicóloga clínica. Escrevo sobre emoções, impulsos e como cuidar de si sem culpa.",
  marcos: "Ajudo pessoas a organizar o dinheiro com passos simples, sem planilha complicada.",
};

export interface SementeConteudo {
  dias: number;
  hora: string;
  por: string;
  tipo: TipoDeConteudo;
  tema: Tema;
  cor: CorDaCapa;
  titulo: string;
  texto?: string;
  corpo?: string[];
  cartoes?: string[];
  opcoes?: string[];
  votos?: number[];
  curtidas: number;
  comentarios?: { dias: number; hora: string; por: string; texto: string }[];
}

export const CONTEUDOS_DA_DEMO: SementeConteudo[] = [
  {
    dias: 0,
    hora: "09:00",
    por: "marcos",
    tipo: "dica",
    tema: "Compras por impulso",
    cor: "ambar",
    titulo: "Regra das 24 horas",
    texto: "Viu algo que quer muito? Coloque no carrinho e espere um dia. Se ainda fizer sentido amanhã, compre.",
    curtidas: 212,
    comentarios: [
      { dias: 0, hora: "10:05", por: "ana", texto: "Vou testar hoje mesmo!" },
      { dias: 0, hora: "10:40", por: "marcos", texto: "Depois me conta como foi, Ana." },
    ],
  },
  {
    dias: 0,
    hora: "08:10",
    por: "paula",
    tipo: "carrossel",
    tema: "Compras por impulso",
    cor: "azul",
    titulo: "5 sinais de que a compra é emocional",
    cartoes: [
      "Você compra para mudar como está se sentindo, não porque precisa.",
      "Compra à noite, sozinho, ou logo depois de um dia difícil.",
      "Esconde a compra de alguém, ou sente vontade de esconder.",
      "Sente culpa logo depois, às vezes antes da entrega chegar.",
      "Nem lembra direito o que comprou na semana passada.",
    ],
    texto: "Reconhecer o padrão é o primeiro passo. A nota do dia ajuda você a enxergar isso com dados, sem julgamento.",
    curtidas: 348,
    comentarios: [
      { dias: 0, hora: "09:00", por: "lucia", texto: "O terceiro sou eu. Escondia as sacolas no carro." },
      { dias: 0, hora: "09:20", por: "paula", texto: "Obrigada por compartilhar, Lúcia. Perceber já é muito." },
    ],
  },
  {
    dias: 1,
    hora: "18:30",
    por: "paula",
    tipo: "artigo",
    tema: "Ansiedade e humor",
    cor: "violeta",
    titulo: "Tédio também compra",
    corpo: [
      "Quando pensamos em compra por impulso, imaginamos tristeza ou ansiedade. Mas um dos gatilhos mais comuns é o tédio.",
      "Rolar o celular sem objetivo leva direto às vitrines. Cada produto novo dá uma pequena dose de novidade, e o cérebro gosta disso.",
      "Uma troca simples: tenha uma lista de três coisas rápidas para fazer quando bater o tédio. Ligar para alguém, dar uma volta no quarteirão, arrumar uma gaveta.",
      "Na próxima vez que registrar uma compra, observe: eu estava entediado? Esse dado vale ouro na conversa com quem te acompanha.",
    ],
    curtidas: 156,
    comentarios: [{ dias: 1, hora: "20:00", por: "carlos", texto: "Nunca tinha pensado no tédio. Faz sentido." }],
  },
  {
    dias: 1,
    hora: "12:00",
    por: "paula",
    tipo: "enquete",
    tema: "Hábitos",
    cor: "petroleo",
    titulo: "Em que horário você mais sente vontade de comprar?",
    opcoes: ["De manhã", "À tarde", "À noite", "De madrugada"],
    votos: [14, 31, 87, 42],
    curtidas: 95,
  },
  {
    dias: 2,
    hora: "15:00",
    por: "marcos",
    tipo: "artigo",
    tema: "Família",
    cor: "rosa",
    titulo: "Como conversar com a família sobre dívidas",
    corpo: [
      "Falar de dinheiro em casa costuma vir carregado de vergonha. Por isso muita gente adia a conversa até a situação ficar grave.",
      "Escolha um momento calmo, sem pressa e sem plateia. Comece pelo que você sente, não pelos números.",
      "Leve a situação por escrito: quanto deve, para quem e quais contas vencem primeiro. Isso tira a conversa do campo da culpa e leva para o da solução.",
      "Combine um próximo passo pequeno e concreto. Conversas sobre dinheiro funcionam melhor em capítulos do que em um único dia.",
    ],
    curtidas: 121,
  },
  {
    dias: 3,
    hora: "10:00",
    por: "marcos",
    tipo: "carrossel",
    tema: "Orçamento",
    cor: "verde",
    titulo: "Seu orçamento em 3 passos",
    cartoes: [
      "Anote quanto entra por mês. Só o valor que cai na conta.",
      "Separe primeiro o essencial: moradia, comida, contas, transporte e remédios.",
      "O que sobrar, divida entre guardar um pouco e gastar sem culpa.",
    ],
    texto: "Simples assim. Orçamento bom é o que você consegue seguir.",
    curtidas: 402,
  },
  {
    dias: 4,
    hora: "21:00",
    por: "paula",
    tipo: "dica",
    tema: "Hábitos",
    cor: "violeta",
    titulo: "A pausa da água",
    texto: "Antes de abrir o app de compras, beba um copo d’água e respire fundo cinco vezes. Parece bobo, mas cria a pausa que você precisa.",
    curtidas: 187,
  },
  {
    dias: 5,
    hora: "09:30",
    por: "paula",
    tipo: "artigo",
    tema: "Ansiedade e humor",
    cor: "azul",
    titulo: "Por que registrar como você estava ajuda",
    corpo: [
      "Quando você marca a carinha em cada compra, está criando um diário que a memória sozinha não faz.",
      "Depois de algumas semanas aparecem padrões: dias, horários e emoções que puxam as compras.",
      "Esses padrões viram assunto nas nossas conversas. Não para julgar, mas para planejar o que fazer quando eles aparecerem de novo.",
    ],
    curtidas: 88,
  },
];
