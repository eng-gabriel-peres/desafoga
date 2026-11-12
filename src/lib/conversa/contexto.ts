import { z } from "zod";
import { ID_FATURA_ENVIADA } from "@/lib/ingestao/analise";
import { buscarPersona, type Persona } from "@/lib/personas";

/**
 * Análise de fatura que o chat web guarda no navegador e devolve a cada
 * mensagem. Vem do cliente, então é validada antes de chegar ao motor.
 */
const AnaliseDoCliente = z.object({
  id: z.literal(ID_FATURA_ENVIADA),
  nome: z.string().max(200),
  perfil: z.string().max(500),
  encargosDaFatura: z.number().int().min(0).max(1e10),
  dividas: z
    .array(
      z.object({
        id: z.string().max(50),
        nome: z.string().max(200),
        tipo: z.enum(["cartao_rotativo", "cheque_especial", "parcelamento", "emprestimo"]),
        saldo: z.number().int().min(0).max(1e10),
        taxaMensal: z.number().min(0).max(1),
        pagamentoMinimo: z.number().int().min(0).max(1e10),
      }),
    )
    .max(20),
});

/** Resolve o contexto enviado pelo chat web: persona fictícia ou fatura lida. */
export function contextoDoCliente(persona: unknown, analise: unknown): Persona | null {
  const lida = AnaliseDoCliente.safeParse(analise);
  if (lida.success) return lida.data;
  return (typeof persona === "string" && buscarPersona(persona)) || null;
}

/** Formato devolvido ao chat web para ele guardar o contexto. */
export function contextoParaCliente(atual: Persona | null) {
  if (!atual) return { persona: null, analise: null };
  return atual.id === ID_FATURA_ENVIADA
    ? { persona: null, analise: atual }
    : { persona: atual.id, analise: null };
}
