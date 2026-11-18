import type {
  Categoria,
  CategoriaDaConta,
  CheckIn,
  Compra,
  ContaFixa,
  Pagamento,
  Periodo,
  Renda,
  Rotina,
  Divida,
  Emocao,
  Estrategia,
  Fatura,
  Deposito,
  Meta,
  Necessidade,
  Orcamento,
} from "@/lib/finance";

export type { Categoria, Compra, Deposito, Divida, Emocao, Estrategia, Fatura, Meta, Necessidade, Orcamento };
export type { CategoriaDaConta, CheckIn, ContaFixa, Pagamento, Periodo, Renda, Rotina };
export type { ConfigDosAvisos, Conquista, IconeDaConquista, TipoDeConquista } from "@/lib/finance";

/** Conta fixa nova (sem id) ou editada. */
export type ContaEditada = Omit<ContaFixa, "id"> & { id?: string };

/**
 * Contas do mês de uma pessoa. Para o profissional, `compartilhadas` é false
 * quando a pessoa não deixou ver: as listas vêm vazias.
 */
export interface DadosDasContas {
  compartilhadas: boolean;
  contas: ContaFixa[];
  pagamentos: Pagamento[];
  renda: Renda | null;
}

export interface DadosDaRotina {
  rotina: Rotina;
  /** Os check-ins das últimas duas semanas. */
  checkins: CheckIn[];
}

/** Meta nova ou ajustada pela pessoa (os depósitos vêm de "guardar"). */
export type MetaEditada = Omit<Meta, "id" | "criadaEm" | "depositos"> & { id?: string };

export interface Persona {
  id: string;
  nome: string;
  /** Primeiro nome, usado nas frases. */
  apelido: string;
  idade: number | null;
  /** Cor do avatar (hex). */
  cor: string;
  /** Descrição curta do caso, para a demonstração. */
  perfil: string;
}

export interface Profissional {
  id: string;
  nome: string;
  papel: string;
  cor: string;
}

export type TipoAviso = "gasto-alto" | "nota-baixa" | "sofrimento" | "sugestao" | "meta" | "checkin" | "compra-banco" | "divida-encontrada" | "limite-cartao" | "consentimento" | "seguro" | "conquista" | "resumo-semana";

export interface Aviso {
  id: string;
  pessoaId: string;
  tipo: TipoAviso;
  texto: string;
  quando: string;
}

export interface Plano {
  valorMensal: number;
  estrategia: Estrategia;
  /** Valor sugerido pelo profissional, se houver. */
  valorSugerido: number | null;
}

export type Tom = "acolhedor" | "direto" | "motivador";

export interface Anotacao {
  id: string;
  autorId: string;
  quando: string;
  texto: string;
  /** Privada: a pessoa não vê, e o assistente só usa para ajustar o tom. */
  privada: boolean;
}

export interface Memoria {
  caracteristicas: string[];
  tom: Tom;
  objetivo: string;
  evitar: string;
  anotacoes: Anotacao[];
}

export interface RespostaRapida {
  rotulo: string;
  /** Mostra a carinha desta emoção no botão. */
  emocao?: Emocao;
}

export interface Mensagem {
  id: string;
  de: "pessoa" | "assistente";
  texto: string;
  quando: string;
  respostasRapidas?: RespostaRapida[];
}

export interface NovaCompra {
  item: string;
  categoria: Categoria;
  valor: number;
  /** null: veio do banco no modo "registrar sozinho". */
  emocao: Emocao | null;
  necessidade: Necessidade | null;
  via: Compra["via"];
  parcelas?: number | null;
  valorDaParcela?: number | null;
  parceladaId?: string | null;
}

/** Emoção e necessidade informadas para uma compra nova encontrada na fatura. */
export type Classificacao = Partial<{ emocao: Emocao; necessidade: Necessidade }>;

// ----- bancos conectados e documentos -----
export type {
  CampoDaDivida,
  CompraParcelada,
  ConexaoBancaria,
  ContaBancaria,
  ModoCompras,
  Movimento,
  SugestaoDeDivida,
} from "@/lib/banco/tipos";
export type { DadosDoBanco } from "@/lib/desafoga/servidor/banco-acoes";
export type {
  ConviteDoEvento,
  DadosDoEvento,
  LinhaDoRanking,
  ParticipanteVisto,
  PostDoMural,
  RespostaAoEncontro,
  SalaDoEvento,
  TipoDeEvento,
  TipoDePost,
} from "@/lib/desafoga/servidor/repositorio-eventos";
export type { ComentarioVisto, ConteudoNoFeed, Criador, DetalheDoConteudo, FeedDeConteudos, NovoConteudo } from "@/lib/desafoga/servidor/repositorio-conteudos";
export type { InvestimentoDoBanco, SugestaoGuardada } from "@/lib/desafoga/servidor/repositorio-banco";
export type { ResultadoDaSincronizacao } from "@/lib/banco/sincronizar";
export type { LeituraDeDocumento } from "@/lib/desafoga/servidor/documentos";
