/**
 * Contratos da camada de dados do Desafoga. As telas só conhecem estas
 * interfaces; a implementação (`api/`) chama o servidor, que confere a
 * sessão e a permissão de cada pedido.
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

/** Quem está usando o app neste navegador. */
export interface Eu {
  demo: boolean;
  pessoa: (Persona & { telefone: string | null }) | null;
  profissional: (Profissional & { convite: string }) | null;
  /** Profissionais que acompanham a pessoa (vazio para o profissional). */
  acompanhantes: Profissional[];
}

export type PerfilDaDemo = "ana" | "carlos" | "lucia" | "rafael" | "paula" | "marcos";

export type NovaConta =
  | { tipo: "pessoa"; nome: string; apelido: string; idade: number | null }
  | { tipo: "profissional"; nome: string; papel: string };

export interface SessaoService {
  eu(): Promise<Eu | null>;
  /** Entra na demonstração como uma persona; na mesma visita, os dados são os mesmos. */
  entrarNaDemo(perfil: PerfilDaDemo): Promise<void>;
  /** Cria uma conta real, sem senha (decisão do hackathon), e já entra nela. */
  criarConta(conta: NovaConta): Promise<void>;
  sair(): Promise<void>;
  /** A pessoa aceita ser acompanhada pelo profissional dono do código. */
  aceitarConvite(codigo: string): Promise<Profissional>;
  /** LGPD: apaga a conta e tudo dela. */
  apagarConta(): Promise<void>;
  /** Volta a demonstração ao começo. */
  recomecar(): Promise<void>;
}

export interface PessoasService {
  /** Para o profissional, quem ele acompanha; para a pessoa, ela mesma. */
  listar(): Promise<Persona[]>;
  obter(pessoaId: string): Promise<Persona | null>;
  /** Profissionais que acompanham a pessoa (autores das anotações). */
  profissionais(pessoaId: string): Promise<Profissional[]>;
  /** Número de WhatsApp conectado pela pessoa (só dígitos), ou null. */
  whatsapp(pessoaId: string): Promise<string | null>;
  /**
   * Começa a conexão do WhatsApp: manda um código para o número. Devolve o
   * número normalizado. `codigoDeTeste` só vem em desenvolvimento, quando não
   * há WhatsApp configurado para enviar.
   */
  conectarWhatsapp(pessoaId: string, telefone: string): Promise<{ telefone: string; codigoDeTeste: string | null }>;
  /** Confirma com o código recebido no WhatsApp. Devolve o número ligado. */
  confirmarWhatsapp(pessoaId: string, codigo: string): Promise<string>;
  /** Conecta pelo link assinado que a Luana mandou no WhatsApp. Devolve o número ligado. */
  conectarWhatsappPorLink(pessoaId: string, codigoDoLink: string): Promise<string>;
  desconectarWhatsapp(pessoaId: string): Promise<void>;
}

export interface ComprasService {
  listar(pessoaId: string): Promise<Compra[]>;
  registrar(pessoaId: string, compra: NovaCompra): Promise<Compra>;
}

export interface DividasService {
  listar(pessoaId: string): Promise<Divida[]>;
  /** Cria (sem id) ou atualiza uma dívida informada pela pessoa. */
  salvar(pessoaId: string, divida: Omit<Divida, "id"> & { id?: string }): Promise<Divida>;
  remover(pessoaId: string, dividaId: string): Promise<void>;
  plano(pessoaId: string): Promise<Plano>;
  salvarPlano(pessoaId: string, mudancas: Partial<Pick<Plano, "valorMensal" | "estrategia">>): Promise<Plano>;
  /** O profissional sugere um valor mensal; a pessoa recebe a sugestão no app. */
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
  /** O autor é quem está na sessão. */
  anotar(pessoaId: string, anotacao: Pick<Anotacao, "texto" | "privada">): Promise<Anotacao>;
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
  /** Os avisos de quem está na sessão: sugestões para a pessoa; alertas dos acompanhados para o profissional. */
  listar(): Promise<Aviso[]>;
  /** Avisos de uma pessoa acompanhada (para o profissional). */
  daPessoa(pessoaId: string): Promise<Aviso[]>;
}

export interface Servicos {
  sessao: SessaoService;
  pessoas: PessoasService;
  compras: ComprasService;
  dividas: DividasService;
  faturas: FaturasService;
  memoria: MemoriaService;
  assistente: AssistenteService;
  avisos: AvisosService;
  /** Avisa quando algum dado mudou, para as telas recarregarem. */
  aoMudar(ouvinte: () => void): () => void;
}
