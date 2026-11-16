/**
 * Converte o documento lido pela IA (fatura, extrato, print) no formato de
 * fatura do Desafoga e liga cada compra ao que a pessoa já registrou.
 * A IA só transcreve; a conversão de valores e a conferência são do código.
 */
import { lerValorEmReais } from "@/lib/dinheiro";
import { reais } from "@/lib/assistente/textos";
import { chaveDoMes, separarFatura, type Compra, type Fatura, type Lancamento, type TipoLancamento } from "@/lib/finance";
import type { DocumentoLido } from "@/lib/luana/ler";
import { categoriaDaLeitura } from "./conversar";

const TIPO_DA_NATUREZA: Record<string, TipoLancamento | null> = {
  compra: "compra",
  juros: "juros",
  iof: "iof",
  tarifa_ou_multa: "tarifa",
  entrada: "pagamento",
  pagamento_ou_credito: "pagamento",
  pagamento_de_fatura: "pagamento",
  saldo_anterior: null,
  transferencia_propria: null,
};

/** Compras registradas e lançamento da fatura são a mesma compra: mesmo valor e até 3 dias de diferença. */
const DIAS_DE_FOLGA = 3;

function diasEntre(a: string, b: string): number {
  return Math.abs(new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 86_400_000;
}

export function paraFatura(doc: DocumentoLido, compras: Compra[], agora: Date, id: string): Fatura {
  const hoje = agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const usadas = new Set<string>();
  const lancamentos: Lancamento[] = [];

  doc.lancamentos.forEach((l, i) => {
    const natureza = TIPO_DA_NATUREZA[l.natureza];
    const valor = lerValorEmReais(l.valor);
    if (!natureza || !valor) return;
    const data = l.data && /^\d{4}-\d{2}-\d{2}$/.test(l.data) ? l.data : hoje;
    const tipo: TipoLancamento = natureza === "compra" && l.categoria === "assinaturas" ? "assinatura" : natureza;
    const lancamento: Lancamento = { id: `${id}-${i}`, data, descricao: l.descricao.trim().slice(0, 120), valor, tipo };
    if (tipo === "compra") {
      lancamento.categoria = categoriaDaLeitura(l.descricao, l.categoria);
      const igual = compras.find(
        (c) => !usadas.has(c.id) && c.valor === valor && diasEntre(c.quando.slice(0, 10), data) <= DIAS_DE_FOLGA,
      );
      if (igual) usadas.add(igual.id);
      lancamento.compraId = igual?.id ?? null;
    }
    lancamentos.push(lancamento);
  });

  return {
    id,
    tipo: doc.tipo === "fatura_cartao" ? "fatura" : "extrato",
    origem: doc.emissor ?? (doc.tipo === "fatura_cartao" ? "Fatura do cartão" : "Extrato enviado"),
    mes: chaveDoMes(agora),
    lancamentos,
  };
}

/** Resposta curta para quem mandou o arquivo pelo chat ou pelo WhatsApp. */
export function respostaDaFatura(fatura: Fatura, canal: "app" | "whatsapp"): string {
  const s = separarFatura(fatura);
  const negrito = (t: string) => (canal === "whatsapp" ? `*${t}*` : t);
  const linhas = [
    `Li ${fatura.tipo === "fatura" ? "a fatura" : "o extrato"} (${fatura.origem}): ${fatura.lancamentos.length} lançamentos.`,
    s.totalEncargos
      ? `Encontrei ${negrito(reais(s.totalEncargos))} em juros, IOF e tarifas.`
      : "Não encontrei juros, IOF nem tarifas.",
  ];
  if (s.jaRegistradas.length) linhas.push(`${s.jaRegistradas.length} compras batem com o que você já tinha registrado.`);
  if (s.novas.length) {
    linhas.push(
      `${s.novas.length} ${s.novas.length === 1 ? "compra é nova" : "compras são novas"}. Para dizer como você estava em cada uma, abra Dívidas > Enviar fatura no app.`,
    );
  }
  linhas.push("Seu raio-x das dívidas já foi atualizado.");
  return linhas.join("\n");
}
