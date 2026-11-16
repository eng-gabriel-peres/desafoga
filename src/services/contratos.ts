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
  /** Número de WhatsApp cadastrado pela pessoa (só dígitos), ou null. */
  whatsapp(pessoaId: string): Promise<string | null>;
  /**
   * Começa o cadastro do WhatsApp: manda um código para o número. Devolve o
   * número normalizado. `codigoDeTeste` só vem em desenvolvimento, quando não
   * há WhatsApp configurado para enviar.
   */
  conectarWhatsapp(pessoaId: string, telefone: string): Promise<{ telefone: string; codigoDeTeste: string | null }>;
  /** Confirma com o código recebido no WhatsApp. Devolve o número ligado. */
  confirmarWhatsapp(pessoaId: string, codigo: string): Promise<string>;
  desconectarWhatsapp(pessoaId: string): Promise<void>;
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
  /** Lê o arquivo enviado com a IA. Sem IA ou sem arquivo, lê um documento de exemplo. */
  ler(pessoaId: string, arquivo: File | null): Promise<{ fatura: Fatura; deExemplo: boolean }>;
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
  /** Fatura, extrato ou print mandado no chat: a Luana lê e responde com o resumo. */
  enviarArquivo(pessoaId: string, arquivo: File): Promise<Mensagem[]>;
  /** Mensagem de voz: a Luana transcreve e responde. */
  enviarAudio(pessoaId: string, audio: Blob): Promise<{ transcricao: string; respostas: Mensagem[] }>;
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
