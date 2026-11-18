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
  Meta,
  MetaEditada,
  NovaCompra,
  Orcamento,
  Persona,
  Plano,
  Profissional,
  ContaEditada,
  ContaFixa,
  DadosDasContas,
  DadosDaRotina,
  Emocao,
  Pagamento,
  Periodo,
  Renda,
  Rotina,
} from "./tipos";
import type { CampoDaDivida, CompraParcelada, ModoCompras } from "@/lib/banco/tipos";
import type { Categoria, DadosDoBanco, LeituraDeDocumento, Necessidade, ResultadoDaSincronizacao } from "./tipos";
import type { Conquista, IconeDaConquista, TipoDeConquista } from "./tipos";
import type { DadosDoEvento, RespostaAoEncontro, SalaDoEvento, TipoDePost } from "./tipos";

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
  /** "Errei o número": invalida o código pendente. */
  desistirDoWhatsapp(pessoaId: string): Promise<void>;
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

export interface OrcamentosService {
  listar(pessoaId: string): Promise<Orcamento[]>;
  /** Limite do mês da categoria; 0 tira o orçamento dela. */
  salvar(pessoaId: string, categoria: Orcamento["categoria"], limite: number): Promise<Orcamento[]>;
}

export interface MetasService {
  listar(pessoaId: string): Promise<Meta[]>;
  /** Cria (sem id) ou ajusta a meta. */
  salvar(pessoaId: string, meta: MetaEditada): Promise<Meta>;
  remover(pessoaId: string, metaId: string): Promise<void>;
  /** Dinheiro guardado: a transferência é registrada uma vez só e já conta na meta. */
  guardar(pessoaId: string, metaId: string, deposito: { valor: number; descricao: string }): Promise<Meta>;
  apagarDeposito(pessoaId: string, metaId: string, depositoId: string): Promise<Meta>;
  /** O profissional manda um incentivo pela Luana. */
  incentivar(pessoaId: string, metaId: string): Promise<{ whatsapp: boolean }>;
  /** Manda agora o lembrete de guardar (no WhatsApp, se conectado; senão no chat do app). */
  lembrar(pessoaId: string, metaId: string): Promise<{ whatsapp: boolean }>;
}

export interface NovaConquista {
  icone: IconeDaConquista;
  tipo: TipoDeConquista;
  alvo: number;
  /** Vazio: título automático. */
  titulo: string;
  premio: string;
}

export interface ConquistasService {
  listar(pessoaId: string): Promise<Conquista[]>;
  /** Só quem acompanha; a Luana avisa a pessoa no chat. */
  criar(pessoaId: string, nova: NovaConquista): Promise<Conquista>;
  apagar(pessoaId: string, conquistaId: string): Promise<void>;
}

export interface EventosService {
  /** Do profissional: os que criou. Da pessoa: os de que participa (sem os posts). */
  listar(): Promise<SalaDoEvento[]>;
  ver(eventoId: string): Promise<SalaDoEvento>;
  /** Só profissional; os participantes precisam ser pessoas que ele acompanha. */
  criar(dados: DadosDoEvento & { participantes: string[] }): Promise<{ id: string }>;
  adicionar(eventoId: string, pessoaId: string): Promise<void>;
  remover(eventoId: string, pessoaId: string): Promise<void>;
  configurar(eventoId: string, mudancas: { mostrarRanking: boolean }): Promise<void>;
  apagar(eventoId: string): Promise<void>;
  responder(eventoId: string, resposta: RespostaAoEncontro): Promise<void>;
  /** A pessoa aceita o convite e passa a aparecer para o grupo. */
  aceitar(eventoId: string): Promise<void>;
  /** Recusar o convite ou sair do evento (leva os próprios posts). */
  sair(eventoId: string): Promise<void>;
  postar(eventoId: string, tipo: Exclude<TipoDePost, "sistema">, texto: string): Promise<{ id: string }>;
  apoiar(eventoId: string, postId: string): Promise<void>;
  fixar(eventoId: string, postId: string): Promise<void>;
  apagarPost(eventoId: string, postId: string): Promise<void>;
}

export interface RotinaService {
  obter(pessoaId: string): Promise<DadosDaRotina>;
  salvar(
    pessoaId: string,
    mudancas: { horarios?: Partial<Rotina["horarios"]>; ligados?: Partial<Rotina["ligados"]>; avisarQuandoTriste?: boolean; compartilharContas?: boolean },
  ): Promise<Rotina>;
  /** Responde o check-in de hoje naquele período; devolve o que a Luana responde. */
  responder(pessoaId: string, periodo: Periodo, humor: Emocao): Promise<{ resposta: string }>;
}

export interface ContasService {
  listar(pessoaId: string): Promise<DadosDasContas>;
  salvar(pessoaId: string, conta: ContaEditada): Promise<ContaFixa>;
  remover(pessoaId: string, contaId: string): Promise<void>;
  /** Marca como paga neste mês. Sem valor, usa o da conta. */
  pagar(pessoaId: string, tipo: Pagamento["tipo"], alvoId: string, valor: number | null): Promise<void>;
  desfazer(pessoaId: string, tipo: Pagamento["tipo"], alvoId: string): Promise<void>;
  salvarRenda(pessoaId: string, renda: Renda | null): Promise<void>;
}

export interface FaturasService {
  listar(pessoaId: string): Promise<Fatura[]>;
  /** Lê o arquivo enviado com a IA. Sem IA ou sem arquivo, lê um documento de exemplo. */
  ler(pessoaId: string, arquivo: File | null): Promise<{ fatura: Fatura; deExemplo: boolean }>;
  /** Guarda a fatura lida e registra as compras novas classificadas. `contaId`: cartão conectado a que a fatura pertence. */
  salvar(pessoaId: string, fatura: Fatura, classificacoes: Record<string, Classificacao>, contaId?: string | null): Promise<void>;
}

export interface DocumentosService {
  /** Lê fatura, extrato, print, Registrato ou contrato. `exemplo` só na demonstração. */
  ler(pessoaId: string, arquivo: File | null, exemplo?: "fatura" | "registrato" | "contrato"): Promise<LeituraDeDocumento>;
  salvar(pessoaId: string, fatura: Fatura, classificacoes: Record<string, Classificacao>, contaId: string | null): Promise<{ parceladas: number; sugestoes: number }>;
}

export interface BancoService {
  listar(pessoaId: string): Promise<DadosDoBanco>;
  tokenDeConexao(pessoaId: string, itemId?: string): Promise<{ token: string; incluirSandbox: boolean }>;
  conectado(pessoaId: string, itemId: string): Promise<ResultadoDaSincronizacao>;
  atualizar(pessoaId: string, conexaoId: string): Promise<ResultadoDaSincronizacao | null>;
  desconectar(pessoaId: string, conexaoId: string): Promise<void>;
  modo(pessoaId: string, modo: ModoCompras): Promise<void>;
  ignorar(pessoaId: string, movimentoId: string): Promise<void>;
  marcarTransferencia(pessoaId: string, movimentoId: string): Promise<void>;
  registrar(pessoaId: string, movimentoId: string, r: { item: string; categoria: Categoria; emocao: Emocao; necessidade: Necessidade }): Promise<void>;
  completarEmocao(pessoaId: string, compraId: string, emocao: Emocao, necessidade: Necessidade): Promise<void>;
  renomearParcelada(pessoaId: string, parceladaId: string, nome: string, categoria?: Categoria): Promise<CompraParcelada>;
  aceitarSugestao(pessoaId: string, chave: string, correcoes?: Partial<Record<CampoDaDivida, number>>, vencimento?: number): Promise<Divida>;
  vincularSugestao(pessoaId: string, chave: string, dividaId: string): Promise<Divida>;
  dispensarSugestao(pessoaId: string, chave: string): Promise<void>;
  desvincularDivida(pessoaId: string, dividaId: string): Promise<Divida>;
  corrigirDivida(pessoaId: string, dividaId: string, campo: CampoDaDivida, valor: number): Promise<Divida>;
  simularCompra(pessoaId: string): Promise<void>;
  aceitarRenda(pessoaId: string): Promise<void>;
  ligarInvestimentos(pessoaId: string, metaId: string, ids: string[]): Promise<void>;
}

export interface MemoriaService {
  obter(pessoaId: string): Promise<Memoria>;
  /** O que a assistente sabe, visto pela própria pessoa (sem anotações privadas nem orientações internas). */
  minha(pessoaId: string): Promise<{ caracteristicas: string[]; objetivo: string; anotacoes: Anotacao[]; temPrivadas: boolean }>;
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
  orcamentos: OrcamentosService;
  metas: MetasService;
  conquistas: ConquistasService;
  eventos: EventosService;
  rotina: RotinaService;
  contas: ContasService;
  faturas: FaturasService;
  documentos: DocumentosService;
  banco: BancoService;
  memoria: MemoriaService;
  assistente: AssistenteService;
  avisos: AvisosService;
  /** Avisa quando algum dado mudou, para as telas recarregarem. */
  aoMudar(ouvinte: () => void): () => void;
}
