import type { GastoAvulso } from "@/lib/finance";
import type { DadosDoBanco } from "@/services";

/**
 * Compras do banco que ainda não viraram compra registrada (esperando revisão
 * ou só no histórico): o dinheiro já saiu, então contam no orçamento do mês.
 * No modo "não usar compras", o banco não entra no orçamento.
 */
export function gastosAvulsosDoBanco(banco: DadosDoBanco | undefined): GastoAvulso[] {
  if (!banco || banco.modo === "desligado") return [];
  return banco.movimentos
    .filter((m) => m.natureza === "compra" && !m.compraId && (m.situacao === "revisar" || m.situacao === "historico"))
    .map((m) => ({ categoria: m.categoria ?? "Outro", valor: m.valor, data: m.data }));
}
