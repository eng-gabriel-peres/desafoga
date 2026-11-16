/**
 * Serviços pela API do servidor (/api/desafoga). Os dados ficam no banco,
 * a Luana usa a IA de verdade e o WhatsApp cadastrado cai na mesma conta.
 */
import type { Servicos } from "../contratos";
import type { Mensagem } from "../tipos";

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

async function enviarArquivo<T>(acao: string, pessoaId: string, arquivo: Blob | null, nome = "arquivo"): Promise<T> {
  const corpo = new FormData();
  corpo.append("pessoaId", pessoaId);
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
  metas: {
    listar: (id) => chamar("metas.listar", [id]),
    salvar: (id, meta) => chamar("metas.salvar", [id, meta], true),
    remover: (id, metaId) => chamar("metas.remover", [id, metaId], true),
    guardar: (id, metaId, dep) => chamar("metas.guardar", [id, metaId, dep], true),
    apagarDeposito: (id, metaId, depId) => chamar("metas.apagarDeposito", [id, metaId, depId], true),
    incentivar: (id, metaId) => chamar("metas.incentivar", [id, metaId], true),
    lembrar: (id, metaId) => chamar("metas.lembrar", [id, metaId], true),
  },
  faturas: {
    listar: (id) => chamar("faturas.listar", [id]),
    ler: (id, arquivo) => enviarArquivo("faturas.ler", id, arquivo),
    salvar: (id, fatura, c) => chamar("faturas.salvar", [id, fatura, c], true),
  },
  memoria: {
    obter: (id) => chamar("memoria.obter", [id]),
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
