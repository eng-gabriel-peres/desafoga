/**
 * A Luana no servidor: texto, arquivo e áudio, no app e no WhatsApp, com os
 * dados no banco. Quem chama já conferiu a permissão (acesso.ts).
 */
import { gerarTexto, iaConfigurada, iaOuve } from "@/lib/ia";
import { ESTADO_INICIAL } from "@/lib/assistente/conversa";
import { lerAudio, lerMensagem } from "@/lib/luana/ler";
import { TIPOS_DE_AUDIO, TAMANHO_MAXIMO } from "@/lib/luana/luana";
import type { Fatura, Mensagem } from "@/services/tipos";
import { conversar, type Canal, type DadosDaConversa, type IaDaConversa } from "../conversar";
import { respostaDaFatura, respostaDasDividas } from "../fatura-lida";
import { ArquivoRecusado, lerDocumentoEnviado, salvarDocumento, type ExemploDeDocumento, type LeituraDeDocumento } from "./documentos";
import * as repo from "./repositorio";

const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** A IA configurada (Gemini ou Claude local); sem ela, a Luana responde só por regras. */
export function iaDisponivel(): IaDaConversa | null {
  if (!iaConfigurada()) return null;
  return { lerMensagem, redigir: (sistema, conteudo) => gerarTexto(sistema, conteudo) };
}

/** A conversa lendo e gravando no banco. */
const dadosNoBanco: DadosDaConversa = {
  contexto: (pessoaId, canal, agora) => repo.contextoDoAssistente(pessoaId, canal, agora),
  estado: (pessoaId, canal) => repo.estado(pessoaId, canal),
  conversaRecente: (pessoaId, canal) => repo.conversaRecente(pessoaId, canal),
  async concluir(pessoaId, canal, resultado, agora) {
    for (const e of resultado.efeitos) {
      if (e.tipo === "registrar-compra") await repo.registrarCompra(pessoaId, e.compra, agora);
      else if (e.tipo === "guardar-na-meta") await repo.guardarNaMeta(pessoaId, e.metaId, { valor: e.valor, descricao: e.descricao, via: canal }, agora);
      else if (e.tipo === "pagar") await repo.pagar(pessoaId, e.alvo, e.id, e.valor, agora);
      else await repo.avisar(pessoaId, e.aviso.tipo, e.aviso.texto, agora);
    }
    await repo.guardarEstado(pessoaId, canal, resultado.estado);
    return repo.guardarMensagens(
      pessoaId,
      canal,
      resultado.respostas.map((r) => ({ de: "assistente" as const, texto: r.texto, respostasRapidas: r.respostasRapidas, quando: agora })),
    );
  },
};

export async function responderTexto(pessoaId: string, canal: Canal, texto: string): Promise<Mensagem[]> {
  await repo.guardarMensagens(pessoaId, canal, [{ de: "pessoa", texto }]);
  return conversar(dadosNoBanco, pessoaId, canal, texto, { ia: iaDisponivel() });
}

/** Simula a resposta sem gravar nada ("Testar o assistente", no painel). */
export async function testarResposta(pessoaId: string, texto: string): Promise<string> {
  let respostas: string[] = [];
  const semGravar: DadosDaConversa = {
    ...dadosNoBanco,
    estado: async () => ESTADO_INICIAL,
    async concluir(_p, _c, resultado) {
      respostas = resultado.respostas.map((r) => r.texto);
      return [];
    },
  };
  await conversar(semGravar, pessoaId, "app", texto, { ia: iaDisponivel() });
  return respostas.join("\n\n");
}

export { ArquivoRecusado };

/** Lê qualquer documento (fatura, extrato, print, Registrato, contrato). Sem IA (ou sem arquivo), usa o exemplo. */
export async function lerDocumentoDaPessoa(pessoaId: string, arquivo: { bytes: Uint8Array; mime: string } | null, exemplo?: ExemploDeDocumento): Promise<LeituraDeDocumento> {
  return lerDocumentoEnviado(pessoaId, arquivo, { exemplo, comIa: Boolean(iaDisponivel()) });
}

/**
 * Leitura pela tela de fatura (formato antigo). Registrato e contrato vão
 * direto para Dívidas: a pessoa recebe o aviso em vez da tela de fatura.
 */
export async function lerFatura(pessoaId: string, arquivo: { bytes: Uint8Array; mime: string } | null): Promise<{ fatura: Fatura; deExemplo: boolean }> {
  const lida = await lerDocumentoDaPessoa(pessoaId, arquivo);
  if (lida.tipo === "dividas") throw new ArquivoRecusado(respostaDasDividas(lida, "app"));
  return { fatura: lida.fatura, deExemplo: lida.deExemplo };
}

/** Arquivo mandado no chat (app ou WhatsApp): lê, guarda e responde com o resumo. */
export async function receberArquivoNoChat(
  pessoaId: string,
  canal: Canal,
  arquivo: { bytes: Uint8Array; mime: string; nome: string },
): Promise<Mensagem[]> {
  if (canal === "app") await repo.guardarMensagens(pessoaId, canal, [{ de: "pessoa", texto: `Arquivo: ${arquivo.nome}` }]);
  let resposta: string;
  try {
    const lida = await lerDocumentoDaPessoa(pessoaId, arquivo);
    if (lida.tipo === "dividas") {
      resposta = respostaDasDividas(lida, canal);
    } else {
      const { parceladas } = await salvarDocumento(pessoaId, lida.fatura, {}, null);
      resposta =
        respostaDaFatura(lida.fatura, canal) +
        (parceladas ? `\n${parceladas} ${parceladas === 1 ? "compra parcelada entrou" : "compras parceladas entraram"} nos próximos meses.` : "") +
        (lida.deExemplo ? "\n(Demonstração sem IA: li um extrato de exemplo no lugar do arquivo.)" : "");
    }
  } catch (erro) {
    resposta = erro instanceof ArquivoRecusado ? erro.message : "Não consegui ler o arquivo agora. Tente de novo em instantes.";
  }
  return repo.guardarMensagens(pessoaId, canal, [{ de: "assistente", texto: resposta }]);
}

/** Mensagem de voz: a IA transcreve e a conversa segue como se fosse texto. */
export async function receberAudioNoChat(
  pessoaId: string,
  canal: Canal,
  audio: { bytes: Uint8Array; mime: string },
): Promise<{ transcricao: string; respostas: Mensagem[] }> {
  const tipo = audio.mime.split(";")[0].trim().toLowerCase();
  const ia = iaDisponivel();
  const falha = async (texto: string) => ({
    transcricao: "",
    respostas: await repo.guardarMensagens(pessoaId, canal, [
      ...(canal === "app" ? [{ de: "pessoa" as const, texto: "Mensagem de voz" }] : []),
      { de: "assistente" as const, texto },
    ]),
  });
  if (!TIPOS_DE_AUDIO.includes(tipo) || audio.bytes.byteLength > TAMANHO_MAXIMO) return falha("Não consegui abrir esse áudio. Grave de novo, mais curto, ou escreva.");
  if (!ia || !iaOuve(tipo)) return falha("Nesta demonstração estou sem a IA que transcreve áudio. Pode escrever a mensagem?");

  let lida;
  try {
    lida = await lerAudio(audio.bytes, tipo, hoje());
  } catch {
    return falha("Não consegui ouvir agora. Tente de novo ou escreva a mensagem.");
  }
  const transcricao = lida.transcricao?.trim() ?? "";
  if (!transcricao) return falha("Não entendi o áudio. Pode gravar de novo, mais perto do microfone?");

  await repo.guardarMensagens(pessoaId, canal, [{ de: "pessoa", texto: canal === "app" ? `Mensagem de voz: ${transcricao}` : transcricao }]);
  const respostas = await conversar(dadosNoBanco, pessoaId, canal, transcricao, { ia, lida });
  return { transcricao, respostas };
}

