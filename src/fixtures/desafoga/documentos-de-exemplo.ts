/**
 * Documentos de exemplo, já como a IA os transcreveria. Servem para a
 * demonstração (sem IA ou sem arquivo à mão) e para os testes.
 */
import type { DocumentoLido } from "@/lib/luana/ler";

const vazio = {
  legivel: true,
  emissor: null,
  vencimento: null,
  total: null,
  pagamentoMinimo: null,
  taxaRotativoMensal: null,
  saldoEmConta: null,
  dataBase: null,
  lancamentos: [],
} satisfies Omit<DocumentoLido, "tipo" | "contratos">;

const linha = (l: Partial<DocumentoLido["contratos"][number]> & Pick<DocumentoLido["contratos"][number], "instituicao" | "modalidade">) => ({
  aVencer: null,
  vencido: null,
  saldoDevedor: null,
  valorParcela: null,
  parcelasPagas: null,
  parcelasRestantes: null,
  totalParcelas: null,
  taxaMensal: null,
  taxaAnual: null,
  cet: null,
  seguro: null,
  proximoVencimento: null,
  ...l,
});

/** Registrato (SCR) com três instituições. O consignado do Itaú é o mesmo da parcela no extrato da Ana. */
export const REGISTRATO_DE_EXEMPLO: DocumentoLido = {
  ...vazio,
  tipo: "registrato",
  emissor: "Banco Central do Brasil",
  dataBase: "2026-10",
  contratos: [
    linha({ instituicao: "ITAU UNIBANCO S.A.", modalidade: "Empréstimos - crédito pessoal consignado", aVencer: "18.400,00", vencido: "0,00" }),
    linha({ instituicao: "NU PAGAMENTOS S.A.", modalidade: "Cartão de crédito - rotativo", aVencer: "1.230,00", vencido: "410,00" }),
    linha({ instituicao: "CAIXA ECONOMICA FEDERAL", modalidade: "Financiamentos - veículos", aVencer: "22.900,00", vencido: "0,00" }),
  ],
};

/** Print da tela do empréstimo no app do banco. */
export const CONTRATO_DE_EXEMPLO: DocumentoLido = {
  ...vazio,
  tipo: "contrato_emprestimo",
  emissor: "Itaú",
  contratos: [
    linha({
      instituicao: "Itaú",
      modalidade: "Crédito pessoal consignado",
      saldoDevedor: "18.400,00",
      valorParcela: "610,00",
      parcelasPagas: "12",
      totalParcelas: "48",
      taxaMensal: "1,90% a.m.",
      cet: "26,2% a.a.",
      seguro: true,
      proximoVencimento: "2026-12-07",
    }),
  ],
};
