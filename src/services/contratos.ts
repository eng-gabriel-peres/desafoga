/**
 * Contratos da camada de dados do Desafoga. As telas só conhecem estas
 * interfaces. Hoje a implementação é simulada (`mock/`); depois ela troca por
 * chamadas à API sem mexer nas telas.
 */
import type {
  Anotacao,
  Aviso,
  Classificacao,
  Compra,
  Divida,
  Fatura,
  Memoria,
  Mensagem,
  NovaCompra,
  Persona,
  Plano,
  Profissional,
} from "./tipos";

export interface PessoasService {
  listar(): Promise<Persona[]>;
  obter(pessoaId: string): Promise<Persona | null>;
  profissionais(): Promise<Profissional[]>;
  /** Profissional que está usando o modo "Responsável". */
  responsavel(): Promise<Profissional>;
}

export interface ComprasService {
  listar(pessoaId: string): Promise<Compra[]>;
  registrar(pessoaId: string, compra: NovaCompra): Promise<Compra>;
}

export interface DividasService {
  listar(pessoaId: string): Promise<Divida[]>;
  plano(pessoaId: string): Promise<Plano>;
  salvarPlano(pessoaId: string, mudancas: Partial<Pick<Plano, "valorMensal" | "estrategia">>): Promise<Plano>;
  /** O profissional sugere um valor mensal; a pessoa recebe a sugestão no chat. */
  sugerirValor(pessoaId: string, valor: number): Promise<void>;
}

export interface FaturasService {
  listar(pessoaId: string): Promise<Fatura[]>;
  /** Lê o arquivo enviado. Na demonstração, devolve sempre o documento de exemplo. */
  ler(pessoaId: string, arquivo: File | null): Promise<Fatura>;
  /** Guarda a fatura lida e registra as compras novas classificadas. */
  salvar(pessoaId: string, fatura: Fatura, classificacoes: Record<string, Classificacao>): Promise<void>;
}

export interface MemoriaService {
  obter(pessoaId: string): Promise<Memoria>;
  salvar(pessoaId: string, mudancas: Partial<Omit<Memoria, "anotacoes">>): Promise<Memoria>;
  anotar(pessoaId: string, anotacao: Omit<Anotacao, "id" | "quando">): Promise<Anotacao>;
  apagarAnotacao(pessoaId: string, anotacaoId: string): Promise<void>;
}

export interface AssistenteService {
  conversa(pessoaId: string): Promise<Mensagem[]>;
  /** Envia uma mensagem da pessoa e devolve as respostas da assistente. */
  enviar(pessoaId: string, texto: string): Promise<Mensagem[]>;
  /** Simula a resposta sem gravar nada (área "Testar o assistente"). */
  testar(pessoaId: string, texto: string): Promise<string>;
  /** Texto de contexto montado a partir da memória e dos números do sistema. */
  contexto(pessoaId: string): Promise<string>;
}

export interface AvisosService {
  /** Avisos de uma pessoa, ou de todas, do mais recente para o mais antigo. */
  listar(pessoaId?: string): Promise<Aviso[]>;
}

export interface Servicos {
  pessoas: PessoasService;
  compras: ComprasService;
  dividas: DividasService;
  faturas: FaturasService;
  memoria: MemoriaService;
  assistente: AssistenteService;
  avisos: AvisosService;
  /** Avisa quando algum dado mudou, para as telas recarregarem. */
  aoMudar(ouvinte: () => void): () => void;
  /** Volta a demonstração ao estado inicial. */
  recomecar(): Promise<void>;
}
