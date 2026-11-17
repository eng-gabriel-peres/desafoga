/**
 * Documentos que a pessoa envia (fatura em PDF, extrato, Registrato,
 * contrato ou print do empréstimo) convertidos nas mesmas estruturas que a
 * Pluggy alimenta: compras parceladas e sugestões de dívida. A IA só
 * transcreve; as contas são feitas aqui.
 */
import { chaveDaDescricao } from "@/lib/banco/classificar";
import { aplicarTravas, chaveDaDivida, taxaMensalDe } from "@/lib/banco/dividas";
import { nomeDaInstituicao } from "@/lib/banco/instituicoes";
import type { CampoDaDivida, CandidataParcelada, SugestaoDeDivida } from "@/lib/banco/tipos";
import { lerPercentual, lerValorEmReais } from "@/lib/dinheiro";
import type { Fatura, Lancamento, TipoDivida } from "@/lib/finance";
import type { DocumentoLido } from "@/lib/luana/ler";
import { lerParcela } from "./fatura-lida";

type ContratoLido = DocumentoLido["contratos"][number];

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const valor = (t: string | null | undefined) => (t ? lerValorEmReais(t) : null);
const inteiro = (t: string | null | undefined) => {
  const n = t ? Number(t.replace(/\D/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};
const diaDe = (data: string | null | undefined) => (data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? Number(data.slice(8, 10)) : null);

export function tipoDaModalidade(texto: string): { tipo: TipoDivida; detalhe: string } {
  const t = semAcento(texto);
  if (/CHEQUE ESPECIAL|ADIANTAMENTO A DEPOSITANTE|LIMITE DA CONTA/.test(t)) return { tipo: "cheque", detalhe: "Cheque especial" };
  if (/CARTAO|ROTATIVO/.test(t)) return { tipo: "cartao", detalhe: "Cartão de crédito" };
  if (/SEM CONSIGNACAO/.test(t)) return { tipo: "emprestimo", detalhe: "Crédito pessoal" };
  if (/CONSIGN/.test(t)) return { tipo: "emprestimo", detalhe: "Consignado" };
  if (/VEICULO/.test(t)) return { tipo: "parcelamento", detalhe: "Financiamento de veículo" };
  if (/IMOVEL|HABITAC/.test(t)) return { tipo: "parcelamento", detalhe: "Financiamento de imóvel" };
  if (/FINANCIAMENTO/.test(t)) return { tipo: "parcelamento", detalhe: "Financiamento" };
  if (/PESSOAL|EMPRESTIMO|\bCDC\b/.test(t)) return { tipo: "emprestimo", detalhe: "Crédito pessoal" };
  return { tipo: "outra", detalhe: texto.trim().slice(0, 60) };
}

function semColisao(lista: SugestaoDeDivida[]): SugestaoDeDivida[] {
  const vistas = new Map<string, number>();
  return lista.map((s) => {
    const n = (vistas.get(s.chave) ?? 0) + 1;
    vistas.set(s.chave, n);
    return n === 1 ? s : { ...s, chave: `${s.chave}|${n}` };
  });
}

export function sugestoesDoRegistrato(doc: DocumentoLido): SugestaoDeDivida[] {
  const lista: SugestaoDeDivida[] = [];
  for (const c of doc.contratos) {
    const aVencer = valor(c.aVencer) ?? 0;
    const vencido = valor(c.vencido) ?? 0;
    const saldo = aVencer + vencido;
    if (!saldo) continue;
    const { tipo, detalhe } = tipoDaModalidade(c.modalidade);
    const instituicao = nomeDaInstituicao(c.instituicao);
    // Parcela e quantas faltam só fazem sentido no que é parcelado (empréstimo, financiamento).
    const confira: CampoDaDivida[] = tipo === "emprestimo" || tipo === "parcelamento" ? ["taxaMensal", "parcelaMinima", "parcelasRestantes"] : ["taxaMensal"];
    lista.push(
      aplicarTravas({
        chave: chaveDaDivida({ instituicao, tipo, parcelaMinima: 0 }),
        fonte: "registrato",
        pluggyLoanId: null,
        tipo,
        nome: `${detalhe} · ${instituicao}`,
        instituicao,
        detalhe,
        saldo,
        vencido: vencido || null,
        taxaMensal: null,
        parcelaMinima: 0,
        vencimento: null,
        parcelasRestantes: null,
        cet: null,
        temSeguro: null,
        faltaPagarComJuros: null,
        confira,
      }),
    );
  }
  return semColisao(lista);
}

function taxaDoContrato(c: ContratoLido): number | null {
  const mensal = c.taxaMensal ? lerPercentual(c.taxaMensal) : null;
  if (mensal !== null) return mensal;
  // "145%" ao mês não é lido como taxa (lerPercentual recusa ≥ 100%): fica para conferir.
  if (c.taxaMensal) return null;
  const anual = c.taxaAnual ? lerPercentual(c.taxaAnual) : null;
  return anual !== null ? taxaMensalDe({ valor: anual, periodicidade: "YEARLY" }) : null;
}

export function sugestaoDoContrato(doc: DocumentoLido): SugestaoDeDivida | null {
  const c = doc.contratos[0];
  if (!c) return null;
  const parcela = valor(c.valorParcela) ?? 0;
  const total = inteiro(c.totalParcelas);
  const pagas = inteiro(c.parcelasPagas);
  const restantes = inteiro(c.parcelasRestantes) ?? (total && pagas !== null ? total - pagas : null);
  const saldo = valor(c.saldoDevedor) ?? valor(c.aVencer) ?? (parcela && restantes ? parcela * restantes : null);
  if (!saldo) return null;
  const { tipo, detalhe } = tipoDaModalidade(c.modalidade);
  const confira: CampoDaDivida[] = [];
  if (!valor(c.saldoDevedor) && !valor(c.aVencer)) confira.push("saldo");
  if (!parcela && tipo !== "cheque" && tipo !== "cartao") confira.push("parcelaMinima");
  if (!restantes && tipo !== "cheque" && tipo !== "cartao") confira.push("parcelasRestantes");
  return aplicarTravas({
    chave: chaveDaDivida({ instituicao: c.instituicao, tipo, parcelaMinima: parcela }),
    fonte: "contrato",
    pluggyLoanId: null,
    tipo,
    nome: `${detalhe} · ${nomeDaInstituicao(c.instituicao)}`,
    instituicao: nomeDaInstituicao(c.instituicao),
    detalhe,
    saldo,
    vencido: valor(c.vencido),
    taxaMensal: taxaDoContrato(c),
    parcelaMinima: parcela,
    vencimento: diaDe(c.proximoVencimento),
    parcelasRestantes: restantes,
    cet: c.cet ? lerPercentual(c.cet) : null,
    temSeguro: c.seguro,
    faltaPagarComJuros: parcela && restantes ? parcela * restantes : null,
    confira,
  });
}

export function parceladasDoDocumento(doc: DocumentoLido, origem: string): CandidataParcelada[] {
  const lista: CandidataParcelada[] = [];
  for (const l of doc.lancamentos) {
    if (l.natureza !== "compra") continue;
    const p = lerParcela(l.parcela);
    const v = valor(l.valor);
    const mes = (doc.vencimento && /^\d{4}-\d{2}/.test(doc.vencimento) ? doc.vencimento : l.data)?.slice(0, 7);
    if (!p || !v || !mes) continue;
    lista.push({
      origem,
      descricao: l.descricao.trim(),
      valorParcela: v,
      totalParcelas: p.totalParcelas,
      parcelaAtual: p.parcela,
      mesDaParcela: mes,
      valorTotal: null,
      compradaEm: null,
    });
  }
  return lista;
}

/**
 * Débitos de parcela de empréstimo nos extratos enviados: a mesma descrição
 * (e valor parecido) em 2 ou mais meses, ou 1 com "x/y", vira sugestão.
 */
export function parcelasDeEmprestimoNosExtratos(extratos: Fatura[]): SugestaoDeDivida[] {
  const grupos: { chave: string; valor: number; linhas: (Lancamento & { instituicao: string })[] }[] = [];
  for (const f of extratos) {
    if (f.foraDosCalculos) continue;
    for (const l of f.lancamentos) {
      if (l.tipo !== "parcela_emprestimo") continue;
      const chave = chaveDaDescricao(l.descricao);
      const g = grupos.find((x) => x.chave === chave && Math.abs(x.valor - l.valor) <= x.valor * 0.05);
      const linha = { ...l, instituicao: f.origem };
      if (g) g.linhas.push(linha);
      else grupos.push({ chave, valor: l.valor, linhas: [linha] });
    }
  }
  const lista: SugestaoDeDivida[] = [];
  for (const g of grupos) {
    const meses = new Set(g.linhas.map((l) => l.data.slice(0, 7)));
    const ultima = [...g.linhas].sort((a, b) => b.data.localeCompare(a.data))[0];
    const parcela = ultima.parcela && ultima.totalParcelas ? { parcela: ultima.parcela, totalParcelas: ultima.totalParcelas } : lerParcela(ultima.descricao);
    if (meses.size < 2 && !parcela) continue;
    const { tipo, detalhe } = /FINANC/i.test(ultima.descricao) ? { tipo: "parcelamento" as const, detalhe: "Financiamento" } : tipoDaModalidade(/CONSIG/i.test(ultima.descricao) ? "consignado" : "empréstimo");
    const restantes = parcela ? parcela.totalParcelas - parcela.parcela : null;
    lista.push(
      aplicarTravas({
        chave: chaveDaDivida({ instituicao: ultima.instituicao, tipo, parcelaMinima: ultima.valor }),
        fonte: "extrato",
        pluggyLoanId: null,
        tipo,
        nome: `${detalhe} · ${nomeDaInstituicao(ultima.instituicao)}`,
        instituicao: nomeDaInstituicao(ultima.instituicao),
        detalhe,
        saldo: restantes ? ultima.valor * restantes : 0,
        vencido: null,
        taxaMensal: null,
        parcelaMinima: ultima.valor,
        vencimento: diaDe(ultima.data),
        parcelasRestantes: restantes && restantes > 0 ? restantes : null,
        cet: null,
        temSeguro: null,
        faltaPagarComJuros: restantes ? ultima.valor * restantes : null,
        confira: restantes ? ["saldo"] : ["saldo", "parcelasRestantes"],
      }),
    );
  }
  return lista;
}

/** Fatura com juros cobrados: a pessoa está no rotativo. */
export function sugestaoDeRotativoDaFatura(f: Fatura): SugestaoDeDivida | null {
  if (f.tipo !== "fatura" || f.foraDosCalculos || !f.total) return null;
  const juros = f.lancamentos.filter((l) => l.tipo === "juros").reduce((s, l) => s + l.valor, 0);
  if (!juros) return null;
  return aplicarTravas({
    chave: chaveDaDivida({ instituicao: f.origem, tipo: "cartao", parcelaMinima: 0 }),
    fonte: "fatura",
    pluggyLoanId: null,
    tipo: "cartao",
    nome: `Rotativo do cartão · ${nomeDaInstituicao(f.origem)}`,
    instituicao: nomeDaInstituicao(f.origem),
    detalhe: "Rotativo do cartão",
    saldo: f.total,
    vencido: null,
    taxaMensal: f.taxaRotativoMensal ?? null,
    parcelaMinima: f.pagamentoMinimo ?? 0,
    vencimento: diaDe(f.vencimento),
    parcelasRestantes: null,
    cet: null,
    temSeguro: null,
    faltaPagarComJuros: null,
    confira: [],
  });
}
