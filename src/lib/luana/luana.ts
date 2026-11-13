import { formatarReais, lerPercentual, lerValorEmReais } from "@/lib/dinheiro";
import { IaIndisponivel, IaSobrecarregada } from "@/lib/ia/gemini";
import { analisarCompra, blocoDeCompra } from "./compra";
import { PERGUNTA, proximaPergunta, pular, registrarResposta } from "./entrevista";
import { acrescentar, anotar, converter, hojeEmBrasilia } from "./lancamentos";
import { type DocumentoLido, lerAudio, lerDocumento, lerMensagem, type MensagemLida, redigir } from "./ler";
import { type DespesaLida, informar } from "./plano";
import { apagarConta, buscarConta, salvarConta } from "./repositorio";
import { type Conta, resumir } from "./resumo";
import {
  AVISO,
  avisoDeOutroMes,
  blocoDeEncargos,
  blocoDeEntradasESaidas,
  blocoDeMaiores,
  blocoDeHoje,
  blocoDePoupanca,
  blocoDoMes,
  blocoDoPlano,
  blocoDoPlanoPara,
  BOAS_VINDAS,
  dicas,
  listar,
  resumoParaIA,
} from "./textos";

/** Limite de tamanho; a Vercel recusa corpos de requisição maiores que 4,5 MB. */
export const TAMANHO_MAXIMO = 4 * 1024 * 1024;
/** Quantos arquivos recebidos ficam listados no painel. */
const MAXIMO_DE_DOCUMENTOS = 60;
const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
/** Formatos de áudio do gravador do navegador e das mensagens de voz do WhatsApp. */
export const TIPOS_DE_AUDIO = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/aac"];

const SEM_IA =
  "Estou sem acesso ao meu leitor agora, então não consegui entender. Tente de novo em instantes.";
const IA_LENTA =
  "O serviço de IA que eu uso para ler está sobrecarregado neste momento e não respondeu a tempo. Não é problema no seu arquivo: mande de novo daqui a um minuto.";

/**
 * Fatura, extrato ou print recebido. Igual no WhatsApp e no chat web.
 * Com `completo` falso, responde só o que foi lido: serve para quando vários
 * arquivos chegam em sequência e o resumo vai junto com o último.
 */
export async function receberArquivo(
  usuario: string,
  bytes: Uint8Array,
  mime: string,
  completo = true,
): Promise<string[]> {
  if (!TIPOS_ACEITOS.includes(mime)) {
    return ["Só leio PDF ou foto (JPG, PNG, WebP). Me mande a fatura ou o print em um desses formatos."];
  }
  if (bytes.byteLength > TAMANHO_MAXIMO) {
    return ["Esse arquivo passa de 4 MB. Mande uma versão menor ou um print da tela."];
  }

  const hoje = hojeEmBrasilia();
  let doc: DocumentoLido;
  try {
    doc = await lerDocumento(bytes, mime, hoje);
  } catch (erro) {
    return [falha(erro)];
  }
  if (!doc.legivel || doc.lancamentos.length === 0) {
    return ["Não achei gastos nesse arquivo. Mande a fatura do cartão em PDF ou um print nítido das compras."];
  }

  const conta = await buscarConta(usuario);
  // Encargos costumam vir sem data: entram na data do lançamento mais recente
  // do próprio documento, para caírem no mesmo mês das compras.
  const datas = doc.lancamentos.map((l) => l.data).filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d));
  const lidos = converter(doc.lancamentos, datas.sort().at(-1) ?? hoje, doc.emissor);
  const novos = acrescentar(conta.lancamentos, lidos);
  guardarDadosDaFatura(conta, doc);
  const datasLidas = lidos.map((l) => l.data).sort();
  conta.documentos = [
    ...(conta.documentos ?? []),
    {
      tipo: doc.tipo,
      emissor: doc.emissor,
      recebidoEm: hoje,
      lancamentos: lidos.length,
      de: datasLidas[0] ?? null,
      ate: datasLidas.at(-1) ?? null,
    },
  ].slice(-MAXIMO_DE_DOCUMENTOS);
  await salvarConta(usuario, conta);

  const r = resumir(conta, hoje);
  const origem = doc.emissor ? ` (${doc.emissor})` : "";
  const repetidos = lidos.length - novos.length;
  const abertura =
    novos.length === 0
      ? `Já tinha anotado tudo desse arquivo${origem}.${completo ? " Seu resumo continua assim:" : ""}`
      : `Li seu arquivo${origem}: *${novos.length} ${novos.length === 1 ? "lançamento novo" : "lançamentos novos"}*${repetidos > 0 ? ` (${repetidos} eu já tinha)` : ""}.`;

  if (!completo) return [abertura];

  const partes = [abertura];
  const outroMes = avisoDeOutroMes(novos, r);
  if (outroMes) partes.push(outroMes);
  const fluxo = blocoDeEntradasESaidas(r);
  if (fluxo) partes.push(fluxo);
  partes.push(blocoDoMes(r));
  const maiores = blocoDeMaiores(r);
  if (maiores) partes.push(maiores);
  const encargos = blocoDeEncargos(r);
  if (encargos) partes.push(encargos);
  if (r.hoje.quantidade > 0) partes.push(blocoDeHoje(r));
  partes.push(`*Onde dá para economizar*\n${dicas(r).map((d) => `• ${d}`).join("\n")}`, AVISO);
  return [partes.join("\n\n")];
}

/** Mensagem de texto recebida. */
export async function receberTexto(usuario: string, texto: string): Promise<string[]> {
  if (/^\s*(apagar|limpar|zerar)\s+(tudo|meus dados|dados)\s*$/i.test(texto)) {
    await apagarConta(usuario);
    return ["Pronto, apaguei tudo o que eu tinha anotado seu."];
  }

  const hoje = hojeEmBrasilia();
  let lida;
  try {
    lida = await lerMensagem(texto, hoje, await perguntaPendente(usuario));
  } catch (erro) {
    return [falha(erro)];
  }
  return responder(usuario, texto, lida, hoje);
}

/**
 * Mensagem de voz recebida. Devolve também a transcrição, para a conversa
 * mostrar o que foi entendido.
 */
export async function receberAudio(
  usuario: string,
  bytes: Uint8Array,
  mime: string,
): Promise<{ transcricao: string; mensagens: string[] }> {
  const tipo = mime.split(";")[0].trim().toLowerCase();
  if (!TIPOS_DE_AUDIO.includes(tipo)) {
    return { transcricao: "", mensagens: ["Não consegui abrir esse áudio. Grave de novo ou escreva a mensagem."] };
  }
  if (bytes.byteLength > TAMANHO_MAXIMO) {
    return { transcricao: "", mensagens: ["Esse áudio ficou grande demais. Mande um de até dois minutos."] };
  }

  const hoje = hojeEmBrasilia();
  let lida;
  try {
    lida = await lerAudio(bytes, tipo, hoje, await perguntaPendente(usuario));
  } catch (erro) {
    return { transcricao: "", mensagens: [falha(erro)] };
  }
  const transcricao = lida.transcricao?.trim() ?? "";
  if (!transcricao) {
    return { transcricao: "", mensagens: ["Não entendi o áudio. Pode gravar de novo, mais perto do microfone?"] };
  }
  if (/^\s*(apagar|limpar|zerar)\s+(tudo|meus dados|dados)\W*$/i.test(transcricao)) {
    return {
      transcricao,
      mensagens: ["Para apagar seus dados, escreva _apagar tudo_. Por áudio eu não apago, para não errar."],
    };
  }
  return { transcricao, mensagens: await responder(usuario, transcricao, lida, hoje) };
}

/** A pergunta da entrevista que está esperando resposta, para o leitor entender respostas curtas. */
async function perguntaPendente(usuario: string): Promise<string | null> {
  try {
    const pendente = (await buscarConta(usuario)).entrevista?.pendente;
    return pendente ? PERGUNTA[pendente] : null;
  } catch {
    return null;
  }
}

const FIM_DA_ENTREVISTA =
  "Daqui para frente é só ir me contando os gastos do dia (_mercado 120_, _uber 23_) que eu vou abatendo do previsto. Se um valor mudar, me fale o novo. E quando quiser, pergunte _posso comprar isso?_";

/** Junta a resposta com o próximo passo da entrevista: outra pergunta ou o fechamento. */
function seguirEntrevista(conta: Conta, hoje: string, partes: string[]): string[] {
  const emAndamento = !!conta.entrevista && !conta.entrevista.concluida;
  const pergunta = proximaPergunta(conta);
  if (pergunta) return [[...partes, pergunta].join("\n\n")];
  const r = resumir(conta, hoje);
  const plano = blocoDoPlano(r);
  const fecho = plano ?? (r.poupanca ? blocoDePoupanca(r) : null);
  return [[...partes, fecho, emAndamento ? FIM_DA_ENTREVISTA : null].filter(Boolean).join("\n\n")];
}

/** Quantas mensagens recentes ficam guardadas para dar continuidade à conversa. */
const TAMANHO_DO_HISTORICO = 8;

/** Responde e guarda a troca no histórico curto da conversa. */
async function responder(usuario: string, texto: string, lida: MensagemLida, hoje: string): Promise<string[]> {
  const conta = await buscarConta(usuario);
  const mensagens = await agir(usuario, conta, texto, lida, hoje);
  conta.historico = [
    ...(conta.historico ?? []),
    { de: "voce" as const, texto: texto.slice(0, 400) },
    { de: "luana" as const, texto: mensagens.join(" ").slice(0, 400) },
  ].slice(-TAMANHO_DO_HISTORICO);
  await salvarConta(usuario, conta);
  return mensagens;
}

/** Age sobre uma mensagem já interpretada, venha ela de texto ou de áudio. */
async function agir(
  usuario: string,
  conta: Conta,
  texto: string,
  lida: MensagemLida,
  hoje: string,
): Promise<string[]> {

  if (lida.intencao === "decisao_de_compra" && lida.compra) {
    const renda = lida.rendaMensal ? lerValorEmReais(lida.rendaMensal) : null;
    const citados = lida.compromissosCitados.reduce((s, c) => s + (lerValorEmReais(c.valor) ?? 0), 0);
    // Renda e contas citadas ficam guardadas para as próximas perguntas.
    if (renda) conta.rendaMensal = renda;
    if (citados > 0) conta.contasInformadas = citados;
    if (renda || citados > 0) await salvarConta(usuario, conta);
    const parcelas = lida.compra.numeroDeParcelas ? Number.parseInt(lida.compra.numeroDeParcelas, 10) : NaN;
    const analise = analisarCompra(
      {
        item: lida.compra.item,
        valorTotal: lida.compra.valorTotal ? lerValorEmReais(lida.compra.valorTotal) : null,
        parcela: lida.compra.valorDaParcela ? lerValorEmReais(lida.compra.valorDaParcela) : null,
        numeroDeParcelas: Number.isFinite(parcelas) && parcelas > 0 ? parcelas : null,
        compromissosCitados: conta.contasInformadas ?? 0,
      },
      conta,
      resumir(conta, hoje),
    );
    // Sem preço nem parcela não há conta a mostrar: a resposta segue como conversa.
    const semPreco = analise.veredito === "sem_dados" && analise.renda !== null;
    if (!semPreco) return [`${blocoDeCompra(analise)}\n\n${AVISO}`];
  }

  if (lida.intencao === "quer_contar_de_cabeca") {
    conta.entrevista = { perguntadas: [], pendente: null };
    return seguirEntrevista(conta, hoje, [
      "Fechado, sem arquivo nenhum. Vou te fazer umas perguntas rápidas. Responda do seu jeito, valor aproximado serve.",
    ]);
  }

  const pendente = conta.entrevista?.pendente ?? null;
  // Na entrevista, uma lista de contas pode ser lida como gastos: vale como despesa mensal.
  if (lida.intencao === "registrar_gasto" && (pendente === "fixas" || pendente === "variaveis")) {
    lida = {
      ...lida,
      intencao: "informar_renda_ou_saldo",
      despesasMensais: lida.lancamentos
        .filter((l) => l.natureza === "compra")
        .map((l) => ({ descricao: l.descricao, valor: l.valor, categoria: l.categoria })),
    };
  }
  // Resposta sem dado ("não tenho", "pula") a uma pergunta da entrevista: segue para a próxima.
  if (pendente && (lida.intencao === "outro" || lida.intencao === "saudacao")) {
    pular(conta);
    return seguirEntrevista(conta, hoje, ["Sem problema, essa eu pulo."]);
  }

  if (lida.intencao === "registrar_gasto") {
    const novos = anotar(conta.lancamentos, converter(lida.lancamentos, hoje));
    if (novos.length === 0) {
      return ["Não peguei o valor. Escreva o gasto com o valor, tipo _mercado 120_."];
    }
    await salvarConta(usuario, conta);
    const r = resumir(conta, hoje);
    const soEntradas = novos.every((l) => l.natureza === "entrada");
    const doDia = novos.every((l) => l.data === hoje);
    const depois = soEntradas
      ? (blocoDeEntradasESaidas(r) ?? blocoDoMes(r))
      : doDia
        ? blocoDeHoje(r)
        : blocoDoMes(r);
    const previsto = blocoDoPlanoPara(r, novos);
    return [[`Anotado:\n${listar(novos)}`, previsto, depois].filter(Boolean).join("\n\n")];
  }

  if (lida.intencao === "informar_renda_ou_saldo") {
    const renda = lida.rendaMensal ? lerValorEmReais(lida.rendaMensal) : null;
    const saldo = lida.saldoEmConta ? lerValorEmReais(lida.saldoEmConta) : null;
    const reserva = lida.reserva ? lerValorEmReais(lida.reserva) : null;
    const despesas = informar(conta.plano, lida.despesasMensais as DespesaLida[]);
    const mexeuNoPlano = despesas.anotados.length + despesas.removidos.length > 0;
    if (!renda && saldo === null && reserva === null && !mexeuNoPlano) {
      return ["Não peguei o valor. Escreva, por exemplo, _ganho 4000_ ou _aluguel 1500, luz 200_."];
    }
    if (renda) conta.rendaMensal = renda;
    if (saldo !== null) conta.saldoEmConta = saldo;
    if (reserva !== null) conta.reserva = reserva;
    if (mexeuNoPlano) conta.plano = despesas.plano;
    // Quem começa contando de cabeça, sem arquivo, entra na conversa guiada.
    if (!conta.entrevista && (conta.documentos ?? []).length === 0) {
      conta.entrevista = { perguntadas: [], pendente: null };
    }

    registrarResposta(conta, { renda: !!renda, despesas: despesas.anotados, reserva: reserva !== null });

    const anotado = [
      renda && `• Entra por mês: ${formatarReais(renda)}`,
      ...despesas.anotados.map((i) => `• ${i.descricao}: ${formatarReais(i.valor)} por mês`),
      ...despesas.removidos.map((d) => `• ${d}: tirei do seu mês`),
      saldo !== null && `• Saldo em conta: ${formatarReais(saldo)}`,
      reserva !== null && `• Guardado à parte: ${formatarReais(reserva)} (fica fora da conta do mês)`,
    ].filter(Boolean);
    return seguirEntrevista(conta, hoje, [`Anotei:\n${anotado.join("\n")}`]);
  }

  // Boas-vindas só no primeiro contato; depois a conversa segue normalmente.
  const historico = conta.historico ?? [];
  if (conta.lancamentos.length === 0 && !conta.rendaMensal && historico.length === 0) return [BOAS_VINDAS];

  const r = resumir(conta, hoje);
  const conversa = historico.map((h) => `${h.de === "voce" ? "Pessoa" : "Luana"}: ${h.texto}`).join("\n");
  try {
    return [await redigir(texto, resumoParaIA(r, conta.rendaMensal, conta.saldoEmConta), conversa)];
  } catch (erro) {
    registrar(erro);
    // Sem o modelo, ainda dá para entregar os números.
    return [[blocoDeHoje(r), blocoDeEntradasESaidas(r), blocoDoMes(r)].filter(Boolean).join("\n\n")];
  }
}

function guardarDadosDaFatura(conta: Conta, doc: DocumentoLido): void {
  if (doc.saldoEmConta) {
    const saldo = lerValorEmReais(doc.saldoEmConta);
    if (saldo !== null) conta.saldoEmConta = saldo;
  }
  if (doc.tipo !== "fatura_cartao") return;
  conta.fatura = {
    emissor: doc.emissor,
    vencimento: doc.vencimento,
    total: doc.total ? lerValorEmReais(doc.total) : null,
    pagamentoMinimo: doc.pagamentoMinimo ? lerValorEmReais(doc.pagamentoMinimo) : null,
    taxaRotativoMensal: doc.taxaRotativoMensal ? lerPercentual(doc.taxaRotativoMensal) : null,
  };
}

function falha(erro: unknown): string {
  registrar(erro);
  if (erro instanceof IaSobrecarregada) return IA_LENTA;
  return erro instanceof IaIndisponivel ? SEM_IA : "Não consegui ler agora. Tente de novo em instantes.";
}

function registrar(erro: unknown): void {
  // Só a mensagem: o erro pode carregar o conteúdo enviado pela pessoa.
  console.error("Luana:", erro instanceof Error ? erro.message.slice(0, 300) : "erro desconhecido");
}

