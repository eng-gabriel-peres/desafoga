/**
 * Serviços pela API do servidor (/api/desafoga). Os dados ficam no banco,
 * a Luana usa a IA de verdade e o WhatsApp cadastrado cai na mesma conta.
 */
import type { Servicos } from "../contratos";
import type { LeituraDeDocumento, Mensagem } from "../tipos";

/** De quanto em quanto tempo as telas buscam novidades (mensagens que chegaram pelo WhatsApp, por exemplo). */
const INTERVALO_DE_ATUALIZACAO = 15_000;
/** Cabeçalho que só o próprio app manda: barra pedidos forjados por outros sites. */
const CABECALHO = { "x-desafoga": "1" };

export class ErroDaApi extends Error {}

const ouvintes = new Set<() => void>();
const avisarMudanca = () => ouvintes.forEach((o) => o());

async function resposta<T>(r: Response): Promise<T> {
  const corpo = (await r.json().catch(() => ({}))) as { dados?: T; erro?: string };
  if (!r.ok) throw new ErroDaApi(corpo.erro ?? `Erro ${r.status}`);
  return corpo.dados as T;
}

/** Chama uma ação; as que mudam dados avisam as telas para recarregar. */
async function chamar<T>(acao: string, args: unknown[] = [], muda = false): Promise<T> {
  const r = await fetch(`/api/desafoga/${acao}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...CABECALHO },
    body: JSON.stringify({ args }),
  });
  const dados = await resposta<T>(r);
  if (muda) avisarMudanca();
  return dados;
}

async function enviarArquivo<T>(acao: string, pessoaId: string, arquivo: Blob | null, nome = "arquivo", exemplo?: string): Promise<T> {
  const corpo = new FormData();
  corpo.append("pessoaId", pessoaId);
  if (exemplo) corpo.append("exemplo", exemplo);
  if (arquivo) corpo.append("arquivo", arquivo, arquivo instanceof File ? arquivo.name : nome);
  const r = await fetch(`/api/desafoga/${acao}`, { method: "POST", headers: CABECALHO, body: corpo });
  return resposta<T>(r);
}

let relogio: ReturnType<typeof setInterval> | null = null;

export const servicosDaApi: Servicos = {
  sessao: {
    eu: () => chamar("sessao.eu"),
    entrarNaDemo: (perfil) => chamar("sessao.entrarNaDemo", [perfil], true),
    criarConta: (conta) => chamar("sessao.criarConta", [conta], true),
    sair: () => chamar("sessao.sair", [], true),
    aceitarConvite: (codigo) => chamar("sessao.aceitarConvite", [codigo], true),
    apagarConta: () => chamar("sessao.apagarConta", [], true),
    recomecar: () => chamar("recomecar", [], true),
  },
  pessoas: {
    listar: () => chamar("pessoas.listar"),
    obter: (id) => chamar("pessoas.obter", [id]),
    profissionais: (id) => chamar("pessoas.profissionais", [id]),
    whatsapp: (id) => chamar("pessoas.whatsapp", [id]),
    conectarWhatsapp: (id, telefone) => chamar("pessoas.conectarWhatsapp", [id, telefone]),
    confirmarWhatsapp: (id, codigo) => chamar("pessoas.confirmarWhatsapp", [id, codigo], true),
    desistirDoWhatsapp: (id) => chamar("pessoas.desistirDoWhatsapp", [id]),
    desconectarWhatsapp: (id) => chamar("pessoas.desconectarWhatsapp", [id], true),
  },
  compras: {
    listar: (id) => chamar("compras.listar", [id]),
    registrar: (id, nova) => chamar("compras.registrar", [id, nova], true),
  },
  dividas: {
    listar: (id) => chamar("dividas.listar", [id]),
    salvar: (id, divida) => chamar("dividas.salvar", [id, divida], true),
    remover: (id, dividaId) => chamar("dividas.remover", [id, dividaId], true),
    plano: (id) => chamar("dividas.plano", [id]),
    salvarPlano: (id, m) => chamar("dividas.salvarPlano", [id, m], true),
    sugerirValor: (id, valor) => chamar("dividas.sugerirValor", [id, valor], true),
  },
  orcamentos: {
    listar: (id) => chamar("orcamentos.listar", [id]),
    salvar: (id, categoria, limite) => chamar("orcamentos.salvar", [id, categoria, limite], true),
  },
  eventos: {
    listar: () => chamar("eventos.listar"),
    ver: (eventoId) => chamar("eventos.ver", [eventoId]),
    criar: (dados) => chamar("eventos.criar", [dados], true),
    adicionar: (eventoId, pessoaId) => chamar("eventos.adicionar", [eventoId, pessoaId], true),
    remover: (eventoId, pessoaId) => chamar("eventos.remover", [eventoId, pessoaId], true),
    configurar: (eventoId, mudancas) => chamar("eventos.configurar", [eventoId, mudancas], true),
    apagar: (eventoId) => chamar("eventos.apagar", [eventoId], true),
    responder: (eventoId, resposta) => chamar("eventos.responder", [eventoId, resposta], true),
    aceitar: (eventoId) => chamar("eventos.aceitar", [eventoId], true),
    sair: (eventoId) => chamar("eventos.sair", [eventoId], true),
    postar: (eventoId, tipo, texto) => chamar("eventos.postar", [eventoId, tipo, texto], true),
    apoiar: (eventoId, postId) => chamar("eventos.apoiar", [eventoId, postId], true),
    fixar: (eventoId, postId) => chamar("eventos.fixar", [eventoId, postId], true),
    apagarPost: (eventoId, postId) => chamar("eventos.apagarPost", [eventoId, postId], true),
  },
  conquistas: {
    listar: (id) => chamar("conquistas.listar", [id]),
    criar: (id, nova) => chamar("conquistas.criar", [id, nova], true),
    apagar: (id, conquistaId) => chamar("conquistas.apagar", [id, conquistaId], true),
  },
  metas: {
    listar: (id) => chamar("metas.listar", [id]),
    salvar: (id, meta) => chamar("metas.salvar", [id, meta], true),
    remover: (id, metaId) => chamar("metas.remover", [id, metaId], true),
    guardar: (id, metaId, dep) => chamar("metas.guardar", [id, metaId, dep], true),
    apagarDeposito: (id, metaId, depId) => chamar("metas.apagarDeposito", [id, metaId, depId], true),
    incentivar: (id, metaId) => chamar("metas.incentivar", [id, metaId], true),
    lembrar: (id, metaId) => chamar("metas.lembrar", [id, metaId], true),
  },
  rotina: {
    obter: (id) => chamar("rotina.obter", [id]),
    salvar: (id, m) => chamar("rotina.salvar", [id, m], true),
    responder: (id, periodo, humor) => chamar("rotina.responder", [id, periodo, humor], true),
  },
  contas: {
    listar: (id) => chamar("contas.listar", [id]),
    salvar: (id, conta) => chamar("contas.salvar", [id, conta], true),
    remover: (id, contaId) => chamar("contas.remover", [id, contaId], true),
    pagar: (id, tipo, alvo, valor) => chamar("contas.pagar", [id, tipo, alvo, valor], true),
    desfazer: (id, tipo, alvo) => chamar("contas.desfazer", [id, tipo, alvo], true),
    salvarRenda: (id, renda) => chamar("contas.salvarRenda", [id, renda], true),
  },
  faturas: {
    listar: (id) => chamar("faturas.listar", [id]),
    ler: (id, arquivo) => enviarArquivo("faturas.ler", id, arquivo),
    salvar: (id, fatura, c, contaId) => chamar("faturas.salvar", [id, fatura, c, contaId ?? null], true),
  },
  documentos: {
    // Registrato e contrato já gravam as sugestões: as telas recarregam.
    ler: (id, arquivo, exemplo) => enviarArquivo<LeituraDeDocumento>("documentos.ler", id, arquivo, "arquivo", exemplo).finally(avisarMudanca),
    salvar: (id, fatura, c, contaId) => chamar("documentos.salvar", [id, fatura, c, contaId], true),
  },
  banco: {
    listar: (id) => chamar("banco.listar", [id]),
    tokenDeConexao: (id, itemId) => chamar("banco.tokenDeConexao", itemId ? [id, itemId] : [id]),
    conectado: (id, itemId) => chamar("banco.conectado", [id, itemId], true),
    atualizar: (id, conexaoId) => chamar("banco.atualizar", [id, conexaoId], true),
    desconectar: (id, conexaoId) => chamar("banco.desconectar", [id, conexaoId], true),
    modo: (id, modo) => chamar("banco.modo", [id, modo], true),
    ignorar: (id, m) => chamar("banco.ignorar", [id, m], true),
    marcarTransferencia: (id, m) => chamar("banco.marcarTransferencia", [id, m], true),
    registrar: (id, m, r) => chamar("banco.registrar", [id, m, r], true),
    completarEmocao: (id, c, e, n) => chamar("banco.completarEmocao", [id, c, e, n], true),
    renomearParcelada: (id, p, nome, cat) => chamar("banco.renomearParcelada", cat ? [id, p, nome, cat] : [id, p, nome], true),
    aceitarSugestao: (id, chave, correcoes, vencimento) => chamar("banco.aceitarSugestao", [id, chave, correcoes ?? {}, ...(vencimento ? [vencimento] : [])], true),
    vincularSugestao: (id, chave, dividaId) => chamar("banco.vincularSugestao", [id, chave, dividaId], true),
    dispensarSugestao: (id, chave) => chamar("banco.dispensarSugestao", [id, chave], true),
    desvincularDivida: (id, d) => chamar("dividas.desvincular", [id, d], true),
    corrigirDivida: (id, d, campo, valor) => chamar("dividas.corrigir", [id, d, campo, valor], true),
    simularCompra: (id) => chamar("banco.simularCompra", [id], true),
    aceitarRenda: (id) => chamar("banco.aceitarRenda", [id], true),
    ligarInvestimentos: (id, metaId, ids) => chamar("metas.ligarInvestimentos", [id, metaId, ids], true),
  },
  memoria: {
    obter: (id) => chamar("memoria.obter", [id]),
    minha: (id) => chamar("memoria.minha", [id]),
    salvar: (id, m) => chamar("memoria.salvar", [id, m], true),
    anotar: (id, nota) => chamar("memoria.anotar", [id, nota], true),
    apagarAnotacao: (id, notaId) => chamar("memoria.apagarAnotacao", [id, notaId], true),
  },
  assistente: {
    conversa: (id) => chamar("assistente.conversa", [id]),
    enviar: (id, texto) => chamar("assistente.enviar", [id, texto], true),
    async enviarArquivo(id, arquivo) {
      const r = await enviarArquivo<Mensagem[]>("assistente.enviarArquivo", id, arquivo);
      avisarMudanca();
      return r;
    },
    async enviarAudio(id, audio) {
      const r = await enviarArquivo<{ transcricao: string; respostas: Mensagem[] }>("assistente.enviarAudio", id, audio, "mensagem-de-voz");
      avisarMudanca();
      return r;
    },
    testar: (id, texto) => chamar("assistente.testar", [id, texto]),
    contexto: (id) => chamar("assistente.contexto", [id]),
  },
  avisos: {
    listar: () => chamar("avisos.listar"),
    daPessoa: (id) => chamar("avisos.daPessoa", [id]),
  },
  aoMudar(ouvinte) {
    ouvintes.add(ouvinte);
    // Enquanto alguém escuta, busca novidades de tempos em tempos (só com a aba visível).
    relogio ??= setInterval(() => {
      if (document.visibilityState === "visible") avisarMudanca();
    }, INTERVALO_DE_ATUALIZACAO);
    return () => {
      ouvintes.delete(ouvinte);
      if (!ouvintes.size && relogio) {
        clearInterval(relogio);
        relogio = null;
      }
    };
  },
};
