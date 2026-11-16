import type { SementePessoa } from "./sementes";

/**
 * Ana (fictícia): 29 anos, cartão no rotativo, compra à noite quando está
 * triste. É a persona principal da demonstração.
 */
export const ana: SementePessoa = {
  persona: {
    id: "ana",
    nome: "Ana Souza",
    apelido: "Ana",
    idade: 29,
    cor: "#2350C8",
    perfil: "Auxiliar administrativa. Entrou no rotativo do cartão há três meses e compra à noite quando está triste.",
  },
  compras: [
    { id: "ana-c1", dias: 6, hora: "10:15", item: "Compras do mês", categoria: "Mercado", valor: 18240, emocao: 3, necessidade: "sim", avaliacao: "sim" },
    { id: "ana-c2", dias: 6, hora: "22:40", item: "Fone de ouvido", categoria: "Lazer", valor: 24900, emocao: 2, necessidade: "sim", avaliacao: "nao", via: "whatsapp" },
    { id: "ana-c3", dias: 5, hora: "09:05", item: "Protetor solar", categoria: "Farmácia", valor: 4590, emocao: 3, necessidade: "sim" },
    { id: "ana-c4", dias: 4, hora: "23:10", item: "Blusa e calça da loja online", categoria: "Roupa", valor: 32000, emocao: 1, necessidade: "nao", avaliacao: "nao", via: "whatsapp" },
    { id: "ana-c5", dias: 4, hora: "23:35", item: "Chocolate e doces", categoria: "Comida pronta", valor: 3850, emocao: 1, necessidade: "nao" },
    { id: "ana-c6", dias: 4, hora: "23:50", item: "Capinha de celular", categoria: "Outro", valor: 5900, emocao: 2, necessidade: "nao" },
    { id: "ana-c7", dias: 3, hora: "08:00", item: "Pão e café", categoria: "Mercado", valor: 2200, emocao: 4, necessidade: "sim" },
    { id: "ana-c8", dias: 2, hora: "11:30", item: "Presente da sobrinha", categoria: "Presente", valor: 9000, emocao: 5, necessidade: "talvez", avaliacao: "sim" },
    { id: "ana-c9", dias: 2, hora: "17:45", item: "Feira", categoria: "Mercado", valor: 9600, emocao: 4, necessidade: "sim" },
    { id: "ana-c10", dias: 1, hora: "21:20", item: "Tênis de corrida", categoria: "Roupa", valor: 39900, emocao: 2, necessidade: "nao", avaliacao: "nao", via: "whatsapp" },
    { id: "ana-c11", dias: 1, hora: "22:05", item: "Lanche por aplicativo", categoria: "Comida pronta", valor: 6800, emocao: 2, necessidade: "nao" },
    { id: "ana-c12", dias: 0, hora: "08:10", item: "Pão e leite", categoria: "Mercado", valor: 1800, emocao: 3, necessidade: "sim" },
    { id: "ana-c13", dias: 0, hora: "13:25", item: "Maquiagem", categoria: "Outro", valor: 14000, emocao: 2, necessidade: "nao", via: "whatsapp" },
  ],
  dividas: [
    { id: "ana-cartao", tipo: "cartao", nome: "Cartão de crédito", detalhe: "Final 4417, no rotativo", saldo: 185000, taxaMensal: 0.142, parcelaMinima: 32000, vencimento: 10 },
    { id: "ana-cheque", tipo: "cheque", nome: "Cheque especial", detalhe: "Conta corrente", saldo: 62000, taxaMensal: 0.079, parcelaMinima: 8000, vencimento: 5 },
    { id: "ana-emprestimo", tipo: "emprestimo", nome: "Empréstimo pessoal", detalhe: "Faltam 14 parcelas", saldo: 300000, taxaMensal: 0.041, parcelaMinima: 28000, vencimento: 20 },
    { id: "ana-celular", tipo: "parcelamento", nome: "Celular parcelado", detalhe: "Faltam 6 parcelas", saldo: 120000, taxaMensal: 0.032, parcelaMinima: 22000, vencimento: 15 },
  ],
  plano: { valorMensal: 110000, estrategia: "mais-cara", valorSugerido: null },
  faturas: [
    {
      id: "ana-fatura-cartao",
      tipo: "fatura",
      origem: "Cartão final 4417",
      lancamentos: [
        { id: "l1", dias: 12, descricao: "MERCADO BOM PRECO", valor: 41230, tipo: "compra", categoria: "Mercado" },
        { id: "l2", dias: 10, descricao: "FARMACIA CENTRAL", valor: 5890, tipo: "compra", categoria: "Farmácia" },
        { id: "l3", dias: 6, descricao: "FONE BLUETOOTH LOJA", valor: 24900, tipo: "compra", categoria: "Lazer", compraId: "ana-c2" },
        { id: "l4", dias: 4, descricao: "LOJA ONLINE MODA", valor: 32000, tipo: "compra", categoria: "Roupa", compraId: "ana-c4" },
        { id: "l5", dias: 1, descricao: "TENIS ESPORTE", valor: 39900, tipo: "compra", categoria: "Roupa", compraId: "ana-c10" },
        { id: "l6", dias: 1, descricao: "APP DELIVERY LANCHE", valor: 6800, tipo: "compra", categoria: "Comida pronta", compraId: "ana-c11" },
        { id: "l7", dias: 9, descricao: "STREAMING VIDEO", valor: 3990, tipo: "assinatura" },
        { id: "l8", dias: 9, descricao: "MUSICA PREMIUM", valor: 2190, tipo: "assinatura" },
        { id: "l9", dias: 3, descricao: "ANUIDADE PARC 3/12", valor: 3200, tipo: "tarifa" },
        { id: "l10", dias: 2, descricao: "ENCARGOS ROTATIVO", valor: 18744, tipo: "juros" },
        { id: "l11", dias: 2, descricao: "IOF", valor: 912, tipo: "iof" },
        { id: "l12", dias: 14, descricao: "PAGAMENTO RECEBIDO", valor: 90000, tipo: "pagamento" },
      ],
    },
  ],
  memoria: {
    caracteristicas: [
      "Compra quando está triste",
      "Compra à noite",
      "Responde bem a elogios",
      "Se assusta com números grandes",
    ],
    tom: "acolhedor",
    objetivo: "Sair do rotativo do cartão até fevereiro",
    evitar: "Nada de tom de bronca. Evitar valores totais grandes; prefira mostrar quanto é por mês.",
    anotacoes: [
      {
        id: "ana-n1",
        dias: 5,
        hora: "15:00",
        autorId: "marcos",
        texto:
          "Conversamos sobre as dívidas. Ana entende que o rotativo do cartão é o maior problema, mas fica ansiosa com números grandes. Mostrar sempre o valor por mês. Combinamos pagar R$ 200 a mais por mês, começando pelo cartão.",
      },
      {
        id: "ana-n2",
        dias: 3,
        hora: "18:00",
        autorId: "paula",
        texto:
          "Quando está triste, principalmente à noite, compra roupas e maquiagem pela internet. Perguntas abertas funcionam melhor do que conselhos. Reforçar pequenos avanços.",
      },
      {
        id: "ana-n3",
        dias: 1,
        hora: "19:00",
        autorId: "paula",
        privada: true,
        texto: "Relatou um conflito no trabalho nesta semana. Pode estar mais sensível.",
      },
    ],
  },
  avisos: [
    { id: "ana-a1", dias: 1, hora: "21:21", tipo: "gasto-alto", texto: "Ana registrou uma compra de R$ 399,00 (Tênis de corrida)." },
    { id: "ana-a2", dias: 4, hora: "23:51", tipo: "nota-baixa", texto: "A nota do dia de Ana ficou em 1,3 (Dia muito triste). 3 compras depois das 23h." },
    { id: "ana-a3", dias: 4, hora: "23:11", tipo: "gasto-alto", texto: "Ana registrou uma compra de R$ 320,00 (Blusa e calça da loja online)." },
  ],
  conversa: [
    { dias: 6, hora: "09:00", de: "assistente", texto: "Oi, Ana! Eu sou a Luana, assistente do Desafoga.\nComprou alguma coisa? É só me mandar, do seu jeito.\nExemplo: comprei pão 12" },
    { dias: 1, hora: "21:00", de: "assistente", texto: "Lembrete das 21h\nComo foi o seu dia? Se comprou algo e ainda não anotou, é só me mandar." },
    { dias: 1, hora: "21:19", de: "pessoa", texto: "comprei um tênis de corrida 399" },
    { dias: 1, hora: "21:20", de: "assistente", texto: "Anotado: Tênis de corrida, R$ 399,00.\nVocê estava: Triste\nEra necessária: Não" },
    { dias: 0, hora: "13:24", de: "pessoa", texto: "gastei 140 em maquiagem" },
    { dias: 0, hora: "13:25", de: "assistente", texto: "Anotado: Maquiagem, R$ 140,00.\nVocê estava: Triste\nEra necessária: Não" },
  ],
};
