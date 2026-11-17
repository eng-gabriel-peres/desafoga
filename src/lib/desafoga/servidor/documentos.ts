/**
 * Documento enviado pela pessoa (tela, chat ou WhatsApp): lê com a IA,
 * converte e grava nas mesmas estruturas da Pluggy — compras parceladas,
 * sugestões de dívida e faturas. Uma fatura que também veio do banco fica
 * só como registro (a do banco vale).
 */
import { CONTRATO_DE_EXEMPLO, REGISTRATO_DE_EXEMPLO } from "@/fixtures/desafoga/documentos-de-exemplo";
import { FATURA_DE_EXEMPLO, materializarFatura } from "@/fixtures/desafoga";
import { chaveDaInstituicao } from "@/lib/banco/instituicoes";
import { compraManualCorrespondente, novaParcelada } from "@/lib/banco/relacionar";
import type { CandidataParcelada, SugestaoDeDivida } from "@/lib/banco/tipos";
import { fundirFaturas, type Fatura } from "@/lib/finance";
import { lerDocumento, type DocumentoLido } from "@/lib/luana/ler";
import { TAMANHO_MAXIMO } from "@/lib/luana/luana";
import type { Classificacao } from "@/services/tipos";
import { parceladasDoDocumento, parcelasDeEmprestimoNosExtratos, sugestaoDeRotativoDaFatura, sugestaoDoContrato, sugestoesDoRegistrato } from "../documentos";
import { paraFatura } from "../fatura-lida";
import { nomeDeCompraDaFatura } from "../regras";
import * as repo from "./repositorio";

export class ArquivoRecusado extends Error {}

const TIPOS_DE_DOCUMENTO = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export type LeituraDeDocumento =
  | { tipo: "fatura"; fatura: Fatura; parceladas: CandidataParcelada[]; deExemplo: boolean }
  | { tipo: "dividas"; fonte: "registrato" | "contrato"; sugestoes: SugestaoDeDivida[]; deExemplo: boolean };

export type ExemploDeDocumento = "fatura" | "registrato" | "contrato";

const origemDoDocumento = (emissor: string) => `doc:${chaveDaInstituicao(emissor)}`;

async function guardarDividas(pessoaId: string, fonte: "registrato" | "contrato", sugestoes: SugestaoDeDivida[], deExemplo: boolean): Promise<LeituraDeDocumento> {
  for (const s of sugestoes) await repo.receberSugestaoDeDivida(pessoaId, s);
  return { tipo: "dividas", fonte, sugestoes, deExemplo };
}

/** Converte um documento já lido. Registrato e contrato já gravam as sugestões; fatura e extrato esperam `salvarDocumento`. */
async function converter(pessoaId: string, doc: DocumentoLido, deExemplo: boolean): Promise<LeituraDeDocumento> {
  if (!doc.legivel) throw new ArquivoRecusado("Não consegui ler esse arquivo. Mande o PDF ou um print nítido.");
  if (doc.tipo === "registrato") {
    const sugestoes = sugestoesDoRegistrato(doc);
    if (!sugestoes.length) throw new ArquivoRecusado("Não achei dívidas nesse Registrato.");
    return guardarDividas(pessoaId, "registrato", sugestoes, deExemplo);
  }
  if (doc.tipo === "contrato_emprestimo") {
    const s = sugestaoDoContrato(doc);
    if (!s) throw new ArquivoRecusado("Não achei o saldo do empréstimo nesse documento.");
    return guardarDividas(pessoaId, "contrato", [s], deExemplo);
  }
  if (!doc.lancamentos.length) throw new ArquivoRecusado("Não achei lançamentos nesse arquivo. Mande a fatura em PDF ou um print nítido.");
  const fatura = paraFatura(doc, await repo.compras(pessoaId), new Date(), crypto.randomUUID());
  return { tipo: "fatura", fatura, parceladas: parceladasDoDocumento(doc, origemDoDocumento(fatura.origem)), deExemplo };
}

/**
 * Lê fatura, extrato, print, Registrato ou contrato. Sem IA (ou sem arquivo),
 * usa o exemplo — só faz sentido na demonstração.
 */
export async function lerDocumentoEnviado(
  pessoaId: string,
  arquivo: { bytes: Uint8Array; mime: string } | null,
  o: { exemplo?: ExemploDeDocumento; comIa?: boolean; ler?: typeof lerDocumento } = {},
): Promise<LeituraDeDocumento> {
  if (arquivo) {
    if (!TIPOS_DE_DOCUMENTO.includes(arquivo.mime)) throw new ArquivoRecusado("Só leio PDF ou foto (JPG, PNG, WebP).");
    if (arquivo.bytes.byteLength > TAMANHO_MAXIMO) throw new ArquivoRecusado("O arquivo passa de 4 MB.");
  }
  if (o.exemplo === "registrato") return converter(pessoaId, REGISTRATO_DE_EXEMPLO, true);
  if (o.exemplo === "contrato") return converter(pessoaId, CONTRATO_DE_EXEMPLO, true);
  if (arquivo && o.comIa && !o.exemplo) {
    const doc = await (o.ler ?? lerDocumento)(arquivo.bytes, arquivo.mime, hoje());
    return converter(pessoaId, doc, false);
  }
  const fatura = { ...materializarFatura(FATURA_DE_EXEMPLO, new Date()), id: crypto.randomUUID(), fonte: "documento" as const };
  return { tipo: "fatura", fatura, parceladas: [], deExemplo: true };
}

const mesmaFatura = (a: Fatura, b: Fatura) =>
  a.tipo === b.tipo &&
  a.origem === b.origem &&
  a.mes === b.mes &&
  (a.total ?? null) === (b.total ?? null) &&
  a.lancamentos.length === b.lancamentos.length &&
  a.lancamentos.every((l, i) => l.valor === b.lancamentos[i].valor && l.descricao === b.lancamentos[i].descricao);

/**
 * Grava a fatura ou o extrato enviado: compras parceladas (uma compra para a
 * parcelada inteira), sugestões de dívida (parcela de empréstimo no extrato,
 * rotativo na fatura) e a fusão com a fatura do banco do mesmo cartão.
 */
export async function salvarDocumento(
  pessoaId: string,
  enviada: Fatura,
  classificacoes: Record<string, Classificacao>,
  contaId: string | null,
): Promise<{ parceladas: number; sugestoes: number }> {
  const fatura: Fatura = { ...enviada, fonte: "documento", contaId, foraDosCalculos: false, lancamentos: enviada.lancamentos.map((l) => ({ ...l })) };
  const restantes = { ...classificacoes };
  const origem = contaId ?? origemDoDocumento(fatura.origem);
  const compras = await repo.compras(pessoaId);
  const ligadas = new Set<string>();
  let parceladas = 0;

  for (const l of fatura.lancamentos) {
    if (l.tipo !== "compra" || !l.parcela || !l.totalParcelas) continue;
    const candidata: CandidataParcelada = {
      origem,
      descricao: l.descricao,
      valorParcela: l.valor,
      totalParcelas: l.totalParcelas,
      parcelaAtual: l.parcela,
      mesDaParcela: fatura.mes,
      valorTotal: null,
      compradaEm: null,
    };
    const { parcelada } = await repo.salvarParcelada(pessoaId, novaParcelada(candidata, l.categoria ?? "Outro", "documento"));
    parceladas++;
    // A parcela não vira compra própria: a compra é da parcelada inteira.
    delete restantes[l.id];
    if (parcelada.compraId) {
      l.compraId = parcelada.compraId;
      continue;
    }
    const manual = l.compraId
      ? compras.find((c) => c.id === l.compraId)
      : compraManualCorrespondente({ valor: l.valor, data: l.data, parcelada }, compras, ligadas, 3);
    if (manual) {
      ligadas.add(manual.id);
      await repo.ligarParceladaACompra(parcelada.id, manual.id);
      l.compraId = manual.id;
      continue;
    }
    const c = classificacoes[l.id];
    if (c?.emocao && c.necessidade) {
      const compra = await repo.registrarCompra(
        pessoaId,
        {
          item: nomeDeCompraDaFatura(parcelada.nome),
          categoria: parcelada.categoria,
          valor: parcelada.valorTotal,
          emocao: c.emocao,
          necessidade: c.necessidade,
          via: "fatura",
          parcelas: parcelada.totalParcelas,
          valorDaParcela: parcelada.valorParcela,
          parceladaId: parcelada.id,
        },
        new Date(`${parcelada.compradaEm}T12:00:00-03:00`),
      );
      await repo.ligarParceladaACompra(parcelada.id, compra.id);
      l.compraId = compra.id;
    }
  }

  // A mesma fatura de novo substitui a anterior em vez de duplicar.
  for (const antiga of (await repo.faturas(pessoaId)).filter((f) => f.fonte !== "pluggy" && mesmaFatura(f, fatura))) await repo.apagarFatura(antiga.id);

  if (contaId) {
    const doBanco = (await repo.faturasDoCartao(pessoaId, contaId, fatura.mes)).find((f) => f.fonte === "pluggy");
    if (doBanco) {
      const junta = fundirFaturas(repo.paraFatura(doBanco), fatura);
      await repo.atualizarFatura(doBanco.id, {
        vencimento: junta.pluggy.vencimento ?? null,
        total: junta.pluggy.total ?? null,
        pagamentoMinimo: junta.pluggy.pagamentoMinimo ?? null,
        taxaRotativoMensal: junta.pluggy.taxaRotativoMensal ?? null,
      });
      fatura.foraDosCalculos = true;
    }
  }
  const salva = await repo.salvarFatura(pessoaId, fatura, restantes);

  let sugestoes = 0;
  const novas: SugestaoDeDivida[] = [];
  if (salva.tipo === "extrato") novas.push(...parcelasDeEmprestimoNosExtratos((await repo.faturas(pessoaId)).filter((f) => f.tipo === "extrato")));
  const rotativo = sugestaoDeRotativoDaFatura(salva);
  if (rotativo) novas.push(rotativo);
  for (const s of novas) if ((await repo.receberSugestaoDeDivida(pessoaId, s)) === "nova") sugestoes++;
  return { parceladas, sugestoes };
}
