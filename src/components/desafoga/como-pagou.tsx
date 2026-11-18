"use client";

import { Banknote, CreditCard, Landmark } from "lucide-react";
import { useEffect } from "react";
import { useConsulta } from "@/hooks/use-consulta";
import type { MeioDePagamento } from "@/lib/finance";
import { reais } from "@/lib/formatar";
import { servicos } from "@/services";

export interface Pagamento {
  meio: MeioDePagamento | null;
  cartaoId: string | null;
  parcelas: number;
}

export const SEM_PAGAMENTO: Pagamento = { meio: null, cartaoId: null, parcelas: 1 };

const chave = (pessoaId: string) => `desafoga:pagamento:${pessoaId}`;

/** A última forma de pagamento usada (só o meio e o cartão; parcelas voltam para à vista). */
function lembrar(pessoaId: string): Pagamento | null {
  try {
    const v = JSON.parse(localStorage.getItem(chave(pessoaId)) ?? "null") as Pagamento | null;
    return v?.meio ? { meio: v.meio, cartaoId: v.cartaoId ?? null, parcelas: 1 } : null;
  } catch {
    return null;
  }
}

export function guardarPagamento(pessoaId: string, p: Pagamento): void {
  try {
    if (p.meio) localStorage.setItem(chave(pessoaId), JSON.stringify({ meio: p.meio, cartaoId: p.cartaoId }));
  } catch {
    // Sem armazenamento: só não lembra da próxima vez.
  }
}

const OPCAO =
  "inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3 text-[0.92rem] font-bold hover:border-primary aria-checked:border-primary aria-checked:bg-primary-soft [&_svg]:size-4";

/**
 * "Como você pagou?": débito/Pix sai da conta na hora; no cartão, a compra
 * cai na fatura certa (e dá para parcelar); em dinheiro não mexe na conta.
 */
export function ComoPagou({ pessoaId, valor, pagamento, mudar }: { pessoaId: string; valor: number | null; pagamento: Pagamento; mudar: (p: Pagamento) => void }) {
  const dinheiro = useConsulta(`dinheiro:${pessoaId}`, () => servicos.dinheiro.ver(pessoaId));
  const cartoes = dinheiro?.cartoes ?? [];

  // Começa com a última escolha (se o cartão ainda existir).
  useEffect(() => {
    if (pagamento.meio || !dinheiro) return;
    const ultima = lembrar(pessoaId);
    if (ultima && (ultima.meio !== "cartao" || cartoes.some((c) => c.id === ultima.cartaoId))) mudar(ultima);
    // Só na primeira carga dos cartões.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dinheiro]);

  const escolhido = (meio: MeioDePagamento, cartaoId: string | null = null) => pagamento.meio === meio && pagamento.cartaoId === cartaoId;
  return (
    <fieldset className="mt-4 min-w-0">
      <legend className="mb-1.5 font-bold">Como você pagou?</legend>
      <div role="radiogroup" aria-label="Como você pagou" className="flex flex-wrap gap-2">
        <button type="button" role="radio" aria-checked={escolhido("conta")} onClick={() => mudar({ meio: "conta", cartaoId: null, parcelas: 1 })} className={OPCAO}>
          <Landmark aria-hidden="true" /> Débito ou Pix
        </button>
        <button type="button" role="radio" aria-checked={escolhido("dinheiro")} onClick={() => mudar({ meio: "dinheiro", cartaoId: null, parcelas: 1 })} className={OPCAO}>
          <Banknote aria-hidden="true" /> Dinheiro
        </button>
        {cartoes.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={escolhido("cartao", c.id)} onClick={() => mudar({ meio: "cartao", cartaoId: c.id, parcelas: 1 })} className={OPCAO}>
            <CreditCard aria-hidden="true" /> {c.nome}
          </button>
        ))}
      </div>
      {!cartoes.length && <p className="mt-1.5 text-[0.85rem] text-muted">Pagou no cartão? Cadastre o cartão em Contas para a compra cair na fatura certa.</p>}
      {pagamento.meio === "cartao" && (
        <label className="mt-2.5 flex items-center gap-2">
          <span className="font-bold">Parcelas</span>
          <select
            value={pagamento.parcelas}
            onChange={(e) => mudar({ ...pagamento, parcelas: Number(e.target.value) })}
            className="min-h-11 rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3 font-bold"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "À vista" : `${n}x${valor ? ` de ${reais(Math.floor(valor / n))}` : ""}`}
              </option>
            ))}
          </select>
        </label>
      )}
    </fieldset>
  );
}
