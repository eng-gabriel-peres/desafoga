import { lerValorEmReais } from "@/lib/dinheiro";
import type { Divida } from "@/lib/motor/juros";
import type { Persona } from "@/lib/personas";
import type { FaturaExtraida } from "./extrair";

export const ID_FATURA_ENVIADA = "fatura";

/** Fração do total usada como mínimo quando a fatura não informa o valor. */
const MINIMO_PADRAO = 0.15;

export type ResultadoAnalise =
  | { ok: true; analise: Persona; avisos: string[] }
  | { ok: false; motivo: string };

/**
 * Converte a transcrição do modelo em números que o motor entende. Todo
 * cálculo e toda conversão de texto para centavos acontecem aqui.
 */
export function montarAnalise(f: FaturaExtraida): ResultadoAnalise {
  if (!f.legivel || f.tipo === "outro") {
    return { ok: false, motivo: "Não consegui ler esse arquivo como fatura ou extrato." };
  }

  const encargos = f.encargos.reduce((soma, e) => soma + (lerValorEmReais(e.valor) ?? 0), 0);
  const total = f.total ? lerValorEmReais(f.total) : null;
  const taxa = f.taxaRotativoMensal ? lerPercentual(f.taxaRotativoMensal) : null;
  const avisos: string[] = [];
  const dividas: Divida[] = [];

  if (f.tipo === "fatura_cartao" && total && total > 0) {
    if (taxa === null) {
      avisos.push(
        "Não encontrei a taxa de juros do rotativo na fatura, então não dá para simular os juros nem o plano.",
      );
    } else {
      let minimo = f.pagamentoMinimo ? lerValorEmReais(f.pagamentoMinimo) : null;
      if (!minimo) {
        minimo = Math.round(total * MINIMO_PADRAO);
        avisos.push("A fatura não mostra o pagamento mínimo; usei 15% do total.");
      }
      dividas.push({
        id: "cartao",
        nome: `Fatura ${f.emissor ?? "do cartão"}`,
        tipo: "cartao_rotativo",
        saldo: total,
        taxaMensal: taxa,
        pagamentoMinimo: Math.min(minimo, total),
      });
    }
  } else if (f.tipo === "extrato_conta") {
    avisos.push("Em extrato de conta, por enquanto só somo os encargos cobrados.");
  }

  const emissor = f.emissor ? ` · ${f.emissor}` : "";
  const vencimento = f.vencimento ? `, vencimento ${formatarData(f.vencimento)}` : "";
  return {
    ok: true,
    avisos,
    analise: {
      id: ID_FATURA_ENVIADA,
      nome: `Sua ${f.tipo === "fatura_cartao" ? "fatura" : "conta"}${emissor}`,
      perfil: `${f.lancamentos.length} lançamentos lidos${vencimento}. Os juros abaixo valem se o total não for pago e ficar no rotativo.`,
      encargosDaFatura: encargos,
      dividas,
    },
  };
}

/** "13,80" ou "13.8%" -> 0.138. Devolve null se não for um percentual plausível. */
export function lerPercentual(texto: string): number | null {
  const m = texto.match(/(\d+)(?:[.,](\d+))?/);
  if (!m) return null;
  const valor = Number(`${m[1]}.${m[2] ?? "0"}`);
  return valor > 0 && valor < 100 ? valor / 100 : null;
}

function formatarData(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
