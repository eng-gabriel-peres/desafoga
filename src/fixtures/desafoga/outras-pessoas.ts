import type { SementePessoa } from "./sementes";

const memoriaVazia = {
  caracteristicas: [],
  tom: "acolhedor" as const,
  objetivo: "",
  evitar: "",
  anotacoes: [],
};

/** Carlos (fictício): 41 anos, situação estável, sem dívidas. */
export const carlos: SementePessoa = {
  persona: {
    id: "carlos",
    nome: "Carlos Lima",
    apelido: "Carlos",
    idade: 41,
    cor: "#17804F",
    perfil: "Motorista de aplicativo. Usa o Desafoga para manter o controle depois de quitar o cartão.",
  },
  compras: [
    { id: "carlos-c1", dias: 6, hora: "08:30", item: "Feira", categoria: "Mercado", valor: 8400, emocao: 4, necessidade: "sim", avaliacao: "sim" },
    { id: "carlos-c2", dias: 5, hora: "12:10", item: "Farmácia", categoria: "Farmácia", valor: 3290, emocao: 3, necessidade: "sim", avaliacao: "sim" },
    { id: "carlos-c3", dias: 4, hora: "19:00", item: "Pizza", categoria: "Comida pronta", valor: 5900, emocao: 5, necessidade: "nao", avaliacao: "nao" },
    { id: "carlos-c4", dias: 3, hora: "09:15", item: "Compras do mercado", categoria: "Mercado", valor: 21350, emocao: 4, necessidade: "sim", avaliacao: "sim" },
    { id: "carlos-c5", dias: 2, hora: "14:00", item: "Lâmpadas", categoria: "Casa", valor: 4500, emocao: 3, necessidade: "sim" },
    { id: "carlos-c6", dias: 1, hora: "10:40", item: "Presente de aniversário", categoria: "Presente", valor: 12000, emocao: 5, necessidade: "talvez" },
    { id: "carlos-c7", dias: 0, hora: "07:50", item: "Padaria", categoria: "Mercado", valor: 1650, emocao: 4, necessidade: "sim" },
  ],
  dividas: [],
  plano: { valorMensal: 0, estrategia: "mais-cara", valorSugerido: null },
  metas: [
    {
      id: "carlos-ingles",
      nome: "Curso de inglês",
      icone: "graduation-cap",
      cor: "violeta",
      alvo: 60000,
      inicial: 0,
      modo: "valor",
      frequencia: "mes",
      valorPorPeriodo: 12000,
      prazoEmDias: null,
      criadaHaDias: 62,
      lembrete: true,
      depositos: [
        { dias: 62, hora: "09:00", valor: 12000 },
        { dias: 31, hora: "09:00", valor: 12000 },
      ],
    },
  ],
  faturas: [],
  contas: [{ id: "carlos-aluguel", nome: "Aluguel", categoria: "moradia", valor: 90000, vencimento: 5, variavel: false, debitoAutomatico: false, lembrete: true }],
  memoria: {
    ...memoriaVazia,
    caracteristicas: ["Prefere mensagens curtas", "Responde bem a elogios"],
    tom: "direto",
    objetivo: "Montar uma reserva de emergência",
  },
  avisos: [],
  conversa: [
    { dias: 6, hora: "09:00", de: "assistente", texto: "Oi, Carlos! Eu sou a Luana, assistente do Desafoga.\nComprou alguma coisa? É só me mandar.\nExemplo: comprei pão 12" },
  ],
};

/** Lúcia (fictícia): 72 anos, aposentada, empréstimo consignado. */
export const lucia: SementePessoa = {
  persona: {
    id: "lucia",
    nome: "Lúcia Andrade",
    apelido: "Lúcia",
    idade: 72,
    cor: "#8E44AD",
    perfil: "Aposentada. Compra produtos de TV quando se sente sozinha e tem um consignado.",
  },
  compras: [
    { id: "lucia-c1", dias: 6, hora: "10:00", item: "Compras do mercado", categoria: "Mercado", valor: 15620, emocao: 3, necessidade: "sim", avaliacao: "sim" },
    { id: "lucia-c2", dias: 5, hora: "15:30", item: "Produto de TV", categoria: "Outro", valor: 19990, emocao: 2, necessidade: "nao", avaliacao: "nao" },
    { id: "lucia-c3", dias: 4, hora: "09:20", item: "Remédios", categoria: "Farmácia", valor: 8740, emocao: 3, necessidade: "sim" },
    { id: "lucia-c4", dias: 3, hora: "16:10", item: "Lembrancinha para a neta", categoria: "Presente", valor: 4500, emocao: 5, necessidade: "talvez" },
    { id: "lucia-c5", dias: 2, hora: "14:45", item: "Panela elétrica", categoria: "Casa", valor: 27900, emocao: 2, necessidade: "nao" },
    { id: "lucia-c6", dias: 1, hora: "11:00", item: "Hortifrúti", categoria: "Mercado", valor: 4380, emocao: 4, necessidade: "sim" },
    { id: "lucia-c7", dias: 0, hora: "10:30", item: "Vitaminas", categoria: "Farmácia", valor: 6990, emocao: 2, necessidade: "nao" },
  ],
  dividas: [
    { id: "lucia-consignado", tipo: "emprestimo", nome: "Empréstimo consignado", detalhe: "Desconto na aposentadoria", saldo: 500000, taxaMensal: 0.018, parcelaMinima: 25000, vencimento: 5 },
  ],
  plano: { valorMensal: 25000, estrategia: "mais-cara", valorSugerido: null },
  faturas: [],
  memoria: {
    ...memoriaVazia,
    caracteristicas: ["Compra por tédio", "Tem dificuldade com contas"],
    objetivo: "Parar de comprar produtos de TV",
    evitar: "Termos técnicos. Explicar com calma, uma coisa de cada vez.",
  },
  avisos: [
    { id: "lucia-a1", dias: 2, hora: "14:46", tipo: "gasto-alto", texto: "Lúcia registrou uma compra de R$ 279,00 (Panela elétrica)." },
  ],
  conversa: [
    { dias: 6, hora: "09:00", de: "assistente", texto: "Oi, Lúcia! Eu sou a Luana, assistente do Desafoga.\nComprou alguma coisa? É só me mandar.\nExemplo: comprei pão 12" },
  ],
};

/** Rafael (fictício): 23 anos, compra de madrugada, cartão no rotativo. */
export const rafael: SementePessoa = {
  persona: {
    id: "rafael",
    nome: "Rafael Torres",
    apelido: "Rafael",
    idade: 23,
    cor: "#C2410C",
    perfil: "Estudante e estagiário. Compra jogos e roupas de madrugada, quando está ansioso.",
  },
  compras: [
    { id: "rafael-c1", dias: 6, hora: "23:40", item: "Jogo online", categoria: "Lazer", valor: 14990, emocao: 2, necessidade: "nao" },
    { id: "rafael-c2", dias: 5, hora: "12:30", item: "Lanche por aplicativo", categoria: "Comida pronta", valor: 4200, emocao: 3, necessidade: "talvez" },
    { id: "rafael-c3", dias: 5, hora: "01:15", item: "Tênis", categoria: "Roupa", valor: 34990, emocao: 1, necessidade: "nao" },
    { id: "rafael-c4", dias: 4, hora: "09:00", item: "Padaria", categoria: "Mercado", valor: 1500, emocao: 3, necessidade: "sim" },
    { id: "rafael-c5", dias: 3, hora: "22:50", item: "Fone sem fio", categoria: "Outro", valor: 22900, emocao: 2, necessidade: "nao" },
    { id: "rafael-c6", dias: 2, hora: "13:00", item: "Compras do mercado", categoria: "Mercado", valor: 9870, emocao: 3, necessidade: "sim" },
    { id: "rafael-c7", dias: 1, hora: "00:30", item: "Jaqueta", categoria: "Roupa", valor: 27900, emocao: 1, necessidade: "nao" },
    { id: "rafael-c8", dias: 1, hora: "23:10", item: "Ingresso de show", categoria: "Lazer", valor: 18000, emocao: 2, necessidade: "nao" },
    { id: "rafael-c9", dias: 0, hora: "02:05", item: "Doces", categoria: "Comida pronta", valor: 3200, emocao: 2, necessidade: "nao" },
  ],
  dividas: [
    { id: "rafael-cartao", tipo: "cartao", nome: "Cartão de crédito", detalhe: "No rotativo", saldo: 240000, taxaMensal: 0.15, parcelaMinima: 38000, vencimento: 8 },
  ],
  plano: { valorMensal: 38000, estrategia: "mais-cara", valorSugerido: null },
  faturas: [],
  memoria: {
    ...memoriaVazia,
    caracteristicas: ["Age por impulso", "Compra quando está ansiosa", "Compra à noite"],
    tom: "motivador",
    objetivo: "Ficar uma semana sem compra de madrugada",
  },
  avisos: [
    { id: "rafael-a1", dias: 1, hora: "00:31", tipo: "nota-baixa", texto: "Rafael registrou 2 compras depois da meia-noite com nota 1 (muito triste)." },
    { id: "rafael-a2", dias: 5, hora: "01:16", tipo: "gasto-alto", texto: "Rafael registrou uma compra de R$ 349,90 (Tênis)." },
  ],
  conversa: [
    { dias: 6, hora: "09:00", de: "assistente", texto: "Oi, Rafael! Eu sou a Luana, assistente do Desafoga.\nComprou alguma coisa? É só me mandar.\nExemplo: comprei pão 12" },
  ],
};
