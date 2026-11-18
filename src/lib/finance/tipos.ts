/**
 * Tipos do motor financeiro do Desafoga.
 *
 * Regra do projeto: a IA lê, o código calcula. Valores em centavos (inteiros)
 * e taxas como fração ao mês (0.142 = 14,2% a.m.).
 */

/** Como a pessoa estava na hora da compra: 1 muito triste … 5 muito feliz. */
export type Emocao = 1 | 2 | 3 | 4 | 5;

/** Se a compra era necessária, na opinião de quem comprou (ou do profissional). */
export type Necessidade = "sim" | "nao" | "talvez";

export type Categoria =
  | "Mercado"
  | "Roupa"
  | "Comida pronta"
  | "Farmácia"
  | "Casa"
  | "Lazer"
  | "Presente"
  | "Outro";

export interface Compra {
  id: string;
  item: string;
  categoria: Categoria;
  /** Centavos. */
  valor: number;
  /** null: veio do banco no modo "registrar sozinho" e a pessoa ainda não disse como estava (ou não lembra). */
  emocao: Emocao | null;
  /** A pessoa disse que não lembra como estava: fica sem emoção (fora da nota do dia) e não é cobrada de novo. */
  naoLembra?: boolean;
  /** Como pagou: "conta" (débito/Pix), "dinheiro" ou "cartao" (com `cartaoId`). Ausente nas compras antigas. */
  meio?: MeioDePagamento | null;
  cartaoId?: string | null;
  necessidade: Necessidade | null;
  /** Data e hora em ISO 8601. */
  quando: string;
  via: "app" | "whatsapp" | "fatura" | "banco";
  /** Compra parcelada: em quantas vezes e o valor de cada uma (o `valor` é o total). */
  parcelas?: number | null;
  valorDaParcela?: number | null;
  parceladaId?: string | null;
  /** Opinião do profissional sobre a necessidade; null enquanto não avaliou. */
  avaliacaoProfissional: Necessidade | null;
}

export type MeioDePagamento = "conta" | "dinheiro" | "cartao";

export type TipoDivida =
  | "cartao"
  | "cheque"
  | "emprestimo"
  | "parcelamento"
  | "outra";

export interface Divida {
  id: string;
  tipo: TipoDivida;
  nome: string;
  detalhe: string;
  /** Saldo devedor em centavos. */
  saldo: number;
  /** Juros ao mês em fração: 0.142 = 14,2% a.m. */
  taxaMensal: number;
  /** Parcela mínima mensal em centavos. */
  parcelaMinima: number;
  /** Dia do mês em que vence. */
  vencimento: number;
  /** "banco": veio da Pluggy; "documento": de um documento enviado; ausente = a pessoa cadastrou. */
  origem?: "manual" | "banco" | "documento";
  /** Parcelas que faltam, quando o contrato informa. */
  parcelasRestantes?: number | null;
  /** Fonte mais confiável que já atualizou a dívida (pluggy, contrato, registrato, fatura, extrato). */
  fonte?: "pluggy" | "contrato" | "registrato" | "fatura" | "extrato" | null;
  instituicao?: string | null;
  /** Custo efetivo total ao ano. */
  cet?: number | null;
  temSeguro?: boolean | null;
  /** Parte vencida e não paga (Registrato). */
  vencido?: number | null;
  /** Soma das parcelas que faltam, com juros. */
  faltaPagarComJuros?: number | null;
  /** Campos que a pessoa ainda precisa conferir. */
  confira?: ("saldo" | "taxaMensal" | "parcelaMinima" | "parcelasRestantes")[];
  /** Valores corrigidos pela pessoa (já aplicados nos campos acima). */
  correcoes?: Partial<Record<"saldo" | "taxaMensal" | "parcelaMinima" | "parcelasRestantes", number>>;
  atualizadaEm?: string | null;
}

/** "mais-cara": maior taxa primeiro (avalanche). "menor": menor saldo primeiro (bola de neve). */
export type Estrategia = "mais-cara" | "menor";

export type TipoLancamento =
  | "compra"
  | "juros"
  | "iof"
  | "tarifa"
  | "assinatura"
  | "pagamento"
  /** Parcela de empréstimo, consignado ou financiamento num extrato: não é compra nem encargo. */
  | "parcela_emprestimo";

export interface Lancamento {
  id: string;
  /** YYYY-MM-DD */
  data: string;
  descricao: string;
  /** Centavos, sempre positivo. */
  valor: number;
  tipo: TipoLancamento;
  categoria?: Categoria;
  /** Compra registrada pela pessoa que corresponde a este lançamento. */
  compraId?: string | null;
  /** Compra parcelada: número desta parcela e total. */
  parcela?: number;
  totalParcelas?: number;
}

export interface Fatura {
  id: string;
  tipo: "fatura" | "extrato";
  /** Ex.: "Cartão final 4417". */
  origem: string;
  /** YYYY-MM */
  mes: string;
  lancamentos: Lancamento[];
  /** YYYY-MM-DD do vencimento da fatura. */
  vencimento?: string | null;
  /** Total da fatura (centavos). */
  total?: number | null;
  pagamentoMinimo?: number | null;
  /** Juros do rotativo ao mês (fração). */
  taxaRotativoMensal?: number | null;
  /** Cartão conectado (Pluggy) a que esta fatura pertence. */
  contaId?: string | null;
  /** "pluggy": veio do banco; "documento": a pessoa enviou. Ausente = documento. */
  fonte?: "documento" | "pluggy";
  /** A mesma fatura veio do banco: este documento fica só como registro. */
  foraDosCalculos?: boolean;
}

/** Quanto a pessoa se permite gastar por mês numa categoria. */
export interface Orcamento {
  categoria: Categoria;
  /** Centavos por mês. */
  limite: number;
}

export type IconeDaMeta = "piggy-bank" | "shield" | "plane" | "home" | "car" | "graduation-cap" | "gift" | "smartphone" | "heart";
export type CorDaMeta = "azul" | "amarelo" | "coral" | "violeta" | "petroleo";
/** De quanto em quanto tempo a pessoa guarda. */
export type Frequencia = "dia" | "semana" | "mes";

/** Meta de economia: viagem, reserva de emergência, o "cofrinho". */
export interface Meta {
  id: string;
  nome: string;
  icone: IconeDaMeta;
  cor: CorDaMeta;
  /** Centavos. */
  alvo: number;
  /** Quanto já tinha guardado ao criar (centavos); entra como primeiro depósito. */
  inicial: number;
  /** "prazo": a pessoa escolheu uma data; "valor": escolheu quanto guardar. */
  modo: "prazo" | "valor";
  frequencia: Frequencia;
  /** Quanto guardar a cada período, em centavos. */
  valorPorPeriodo: number;
  /** YYYY-MM-DD, ou null sem data. */
  prazo: string | null;
  /** YYYY-MM-DD */
  criadaEm: string;
  /** Lembrar no WhatsApp nos dias de guardar. */
  lembrete: boolean;
  depositos: Deposito[];
  /** Investimentos do banco ligados à meta (ids). */
  investimentos?: string[];
  /** Saldo somado desses investimentos (centavos); null sem investimento ligado. Vale no lugar dos depósitos. */
  guardadoPeloBanco?: number | null;
}

/** Dinheiro guardado na meta. A transferência para o cofrinho é registrada uma vez só e já conta. */
export interface Deposito {
  id: string;
  /** Centavos, sempre positivo. */
  valor: number;
  descricao: string;
  /** Data e hora em ISO 8601. */
  quando: string;
  via: "app" | "whatsapp";
}

/** Categorias das contas fixas, como no protótipo. */
export type CategoriaDaConta = "moradia" | "luz" | "agua" | "internet" | "transporte" | "saude" | "educacao" | "assinatura" | "outra";

/** O que a pessoa paga todo mês: aluguel, luz, internet… */
export interface ContaFixa {
  id: string;
  nome: string;
  categoria: CategoriaDaConta;
  /** Centavos. Nas contas que mudam todo mês (luz, água), é a média. */
  valor: number;
  /** Dia do mês em que vence (1 a 31; em meses mais curtos, o último dia). */
  vencimento: number;
  /** O valor muda todo mês. */
  variavel: boolean;
  debitoAutomatico: boolean;
  /** Lembrar no WhatsApp um dia antes. */
  lembrete: boolean;
}

/** Pagamento do mês de uma conta fixa ou da parcela de uma dívida. */
export interface Pagamento {
  tipo: "conta" | "divida";
  /** Id da conta ou da dívida. */
  alvoId: string;
  /** "YYYY-MM". */
  mes: string;
  /** Centavos pagos. */
  valor: number;
  quando: string;
}

/** Quanto entra por mês e em que dia. */
export interface Renda {
  valor: number;
  dia: number;
}

/** Os três check-ins do dia. */
export type Periodo = "manha" | "tarde" | "noite";

export interface CheckIn {
  /** "YYYY-MM-DD". */
  dia: string;
  periodo: Periodo;
  humor: Emocao;
  quando: string;
}

/** Horários dos check-ins e escolhas de privacidade da pessoa. */
export interface Rotina {
  /** "HH:MM" de cada check-in. */
  horarios: Record<Periodo, string>;
  ligados: Record<Periodo, boolean>;
  /** Quem acompanha recebe aviso quando a pessoa responde 1 ou 2. */
  avisarQuandoTriste: boolean;
  /** Profissionais podem ver as contas fixas e a renda. */
  compartilharContas: boolean;
}

/** O que conta numa conquista criada pelo profissional. */
export type TipoDeConquista = "sem-impulso" | "registrar" | "nota-boa";
export type IconeDaConquista = "broto" | "caderno" | "brilho" | "estrela" | "alvo" | "raio" | "medalha" | "festa";

/** Meta com prêmio que o profissional cria para a pessoa. */
export interface Conquista {
  id: string;
  icone: IconeDaConquista;
  titulo: string;
  tipo: TipoDeConquista;
  /** Quantos dias ou compras. */
  alvo: number;
  /** Vazio sem prêmio. */
  premio: string;
  /** ISO; o progresso conta a partir daqui. */
  criadaEm: string;
  /** ISO de quando foi alcançada; depois disso fica conquistada mesmo se o progresso cair. */
  concluidaEm: string | null;
  /** Nome de quem criou. */
  autor: string | null;
}

/** "Avisos no WhatsApp" que quem acompanha configura para a pessoa (como no protótipo). */
export interface ConfigDosAvisos {
  /** Lembrete diário para a pessoa, com o resumo das compras do dia. */
  lembreteDiario: boolean;
  /** "HH:MM". */
  horaDoLembrete: string;
  /** Avisar quem acompanha de compra a partir de `valorDaCompraAlta` (centavos). */
  compraAlta: boolean;
  valorDaCompraAlta: number;
  /** Avisar quem acompanha quando a nota do dia ficar em 2 ou menos. */
  diaDificil: boolean;
  /** Resumo da semana todo domingo, para a pessoa e para quem acompanha. */
  resumoDaSemana: boolean;
}
