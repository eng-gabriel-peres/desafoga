import { formatarReais, lerPercentual, lerValorEmReais } from "@/lib/dinheiro";
import { IaIndisponivel, IaSobrecarregada } from "@/lib/ia/gemini";
import { acrescentar, converter, hojeEmBrasilia } from "./lancamentos";
import { type DocumentoLido, lerDocumento, lerMensagem, redigir } from "./ler";
import { apagarConta, buscarConta, salvarConta } from "./repositorio";
import { type Conta, resumir } from "./resumo";
import {
  AVISO,
  blocoDeEncargos,
  blocoDeHoje,
  blocoDePoupanca,
  blocoDoMes,
  BOAS_VINDAS,
  dicas,
  listar,
  resumoParaIA,
} from "./textos";

/** Limite de tamanho; a Vercel recusa corpos de requisição maiores que 4,5 MB. */
export const TAMANHO_MAXIMO = 4 * 1024 * 1024;
const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const SEM_IA =
  "Estou sem acesso ao meu leitor agora, então não consegui entender. Tente de novo em instantes.";
const IA_LENTA =
  "O serviço de IA que eu uso para ler está sobrecarregado neste momento e não respondeu a tempo. Não é problema no seu arquivo: mande de novo daqui a um minuto.";

/** Fatura, extrato ou print recebido. Igual no WhatsApp e no chat web. */
export async function receberArquivo(usuario: string, bytes: Uint8Array, mime: string): Promise<string[]> {
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
  const lidos = converter(doc.lancamentos, datas.sort().at(-1) ?? hoje);
  const novos = acrescentar(conta.lancamentos, lidos);
  guardarDadosDaFatura(conta, doc);
  await salvarConta(usuario, conta);

  const r = resumir(conta, hoje);
  const origem = doc.emissor ? ` (${doc.emissor})` : "";
  const repetidos = lidos.length - novos.length;
  const abertura =
    novos.length === 0
      ? `Já tinha anotado tudo desse arquivo${origem}. Seu resumo continua assim:`
      : `Li seu arquivo${origem}: *${novos.length} ${novos.length === 1 ? "lançamento novo" : "lançamentos novos"}*${repetidos > 0 ? ` (${repetidos} eu já tinha)` : ""}.`;

  const partes = [abertura, blocoDoMes(r)];
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
    lida = await lerMensagem(texto, hoje);
  } catch (erro) {
    return [falha(erro)];
  }

  const conta = await buscarConta(usuario);

  if (lida.intencao === "registrar_gasto") {
    const novos = acrescentar(conta.lancamentos, converter(lida.lancamentos, hoje));
    if (novos.length === 0) {
      return ["Não peguei o valor. Escreva o gasto com o valor, tipo _mercado 120_."];
    }
    await salvarConta(usuario, conta);
    const r = resumir(conta, hoje);
    const doDia = novos.every((l) => l.data === hoje);
    return [`Anotado:\n${listar(novos)}\n\n${doDia ? blocoDeHoje(r) : blocoDoMes(r)}`];
  }

  if (lida.intencao === "informar_renda_ou_saldo") {
    const renda = lida.rendaMensal ? lerValorEmReais(lida.rendaMensal) : null;
    const saldo = lida.saldoEmConta ? lerValorEmReais(lida.saldoEmConta) : null;
    if (renda) conta.rendaMensal = renda;
    if (saldo !== null) conta.saldoEmConta = saldo;
    if (!renda && saldo === null) return ["Não peguei o valor. Escreva, por exemplo, _ganho 4000_."];
    await salvarConta(usuario, conta);
    const r = resumir(conta, hoje);
    const partes: string[] = [];
    if (renda) partes.push(`Anotei sua renda: ${formatarReais(renda)} por mês.`, blocoDePoupanca(r));
    if (saldo !== null) partes.push(`Anotei seu saldo em conta: ${formatarReais(saldo)}.`);
    return [partes.join("\n\n")];
  }

  if (conta.lancamentos.length === 0) return [BOAS_VINDAS];

  const r = resumir(conta, hoje);
  try {
    return [await redigir(texto, resumoParaIA(r, conta.rendaMensal, conta.saldoEmConta))];
  } catch (erro) {
    registrar(erro);
    // Sem o modelo, ainda dá para entregar os números.
    return [[blocoDeHoje(r), blocoDoMes(r)].join("\n\n")];
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

