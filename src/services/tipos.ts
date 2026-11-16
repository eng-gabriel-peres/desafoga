import type {
  Categoria,
  Compra,
  Divida,
  Emocao,
  Estrategia,
  Fatura,
  Necessidade,
} from "@/lib/finance";

export type { Categoria, Compra, Divida, Emocao, Estrategia, Fatura, Necessidade };

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

export type TipoAviso = "gasto-alto" | "nota-baixa" | "sofrimento" | "sugestao";

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
  emocao: Emocao;
  necessidade: Necessidade;
  via: Compra["via"];
}

/** Emoção e necessidade informadas para uma compra nova encontrada na fatura. */
export type Classificacao = Partial<{ emocao: Emocao; necessidade: Necessidade }>;
