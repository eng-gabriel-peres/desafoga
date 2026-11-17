/**
 * O que é cada movimento do banco (compra, transferência entre as próprias
 * contas, pagamento de fatura, parcela de empréstimo…) e, se for compra, de
 * que categoria. A Pluggy quase nunca manda categoria, então decidimos pelo
 * nome da loja, pelo MCC e pelo que a pessoa já corrigiu.
 */
import type { Categoria } from "@/lib/finance";
import { CATEGORIA_DA_PLUGGY, CONTAS_DE_CONSUMO, LOJAS, MCC_PARA_CATEGORIA } from "./lojas";
import type { MovimentoNovo, Natureza, TipoDeContaBancaria } from "./tipos";

export interface RegraDoBanco {
  /** chaveDaDescricao(...) ou documento (CPF/CNPJ) da contraparte. */
  padrao: string;
  efeito: { categoria: Categoria } | { natureza: "transferencia-propria" } | { ignorar: true };
}

export const PARCELA_DE_EMPRESTIMO = /PARC.*EMPR|EMPREST|CONSIG|FINANC|CREDITO PESSOAL|\bCDC\b/i;

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** Maiúsculas, sem acento, só letras e números, sem o marcador de parcela. */
export function chaveDaDescricao(descricao: string): string {
  return semAcento(descricao)
    .replace(/\bPARC(ELA)?\.?\s*\d{1,3}\s*(\/|DE)\s*\d{1,3}\b/g, " ")
    .replace(/\b\d{1,3}\s*(\/|DE)\s*\d{1,3}\b/g, " ")
    .replace(/[^A-Z0-9]/g, "");
}

function regraPara(m: Pick<MovimentoNovo, "descricao" | "documentoContraparte">, regras: RegraDoBanco[]): RegraDoBanco | undefined {
  const chave = chaveDaDescricao(m.descricao);
  return regras.find((r) => r.padrao === chave || (m.documentoContraparte !== null && r.padrao === m.documentoContraparte));
}

export function naturezaDe(m: MovimentoNovo, ctx: { cpfDoTitular: string | null; regras: RegraDoBanco[]; tipoDaConta: TipoDeContaBancaria }): Natureza {
  const texto = semAcento(m.descricao);
  const regra = regraPara(m, ctx.regras);
  if (regra && "natureza" in regra.efeito) return regra.efeito.natureza;
  const pluggy = m.categoriaPluggy ?? "";

  if (
    (ctx.cpfDoTitular && m.documentoContraparte === ctx.cpfDoTitular) ||
    /same person transfer/i.test(pluggy) ||
    /MESMA TITULARIDADE|ENTRE CONTAS|TRANSF.*PROPRIA/.test(texto)
  ) {
    return "transferencia-propria";
  }

  const cartao = ctx.tipoDaConta === "cartao";
  if (/ESTORNO|REEMBOLSO|CHARGEBACK/.test(texto)) return m.direcao === "entrada" ? "estorno" : "outra-saida";
  if (/PAGAMENTO.*(FATURA|CARTAO)|PGTO.*(FAT|CART)/.test(texto) || /credit card payment/i.test(pluggy)) return "pagamento-fatura";
  if (cartao && m.direcao === "entrada") return "pagamento-fatura";
  if (!cartao && m.direcao === "saida" && PARCELA_DE_EMPRESTIMO.test(texto)) return "parcela-emprestimo";

  if (/\bIOF\b/.test(texto)) return "iof";
  if (/JUROS|ENCARGOS|\bMORA\b/.test(texto)) return "juros";
  if (/TARIFA|ANUIDADE|PACOTE (DE )?SERV|CESTA (DE )?SERV|MULTA/.test(texto)) return "tarifa";

  if (m.direcao === "entrada") {
    return /SALARIO|PROVENTOS|FOLHA/.test(texto) || /salary/i.test(pluggy) ? "renda" : "outra-entrada";
  }
  if (CONTAS_DE_CONSUMO.test(texto)) return "outra-saida";
  return "compra";
}

export function categoriaDe(m: Pick<MovimentoNovo, "descricao" | "mcc" | "categoriaPluggy"> & { documentoContraparte?: string | null }, regras: RegraDoBanco[]): Categoria {
  const regra = regraPara({ descricao: m.descricao, documentoContraparte: m.documentoContraparte ?? null }, regras);
  if (regra && "categoria" in regra.efeito) return regra.efeito.categoria;
  const texto = semAcento(m.descricao);
  const loja = LOJAS.find(([padrao]) => padrao.test(texto));
  if (loja) return loja[1];
  if (m.mcc && MCC_PARA_CATEGORIA[m.mcc]) return MCC_PARA_CATEGORIA[m.mcc];
  const pluggy = m.categoriaPluggy && CATEGORIA_DA_PLUGGY.find(([padrao]) => padrao.test(m.categoriaPluggy!));
  if (pluggy) return pluggy[1];
  return "Outro";
}
