"use client";

import type { SituacaoDoOrcamento } from "@/lib/finance";
import { explicarOrcamento } from "@/lib/assistente/textos";
import { reais } from "@/lib/formatar";
import { Barra } from "./ui/campos";

const TOM = { tranquilo: "boa", atencao: "atencao", estourou: "ruim" } as const;

/** Uma categoria do orçamento: barra, valores e o aviso em palavras (não só a cor). */
export function CartaoDoOrcamento({ situacao: s, pessoa }: { situacao: SituacaoDoOrcamento; pessoa?: string }) {
  return (
    <li className="grid gap-1.5 border-b border-line py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <b>{s.categoria}</b>
        <span className="text-[0.92rem] text-muted">
          {reais(s.gasto)} de {reais(s.limite)}
        </span>
      </div>
      <Barra fracao={s.usado} tom={TOM[s.estado]} />
      <p className={`text-[0.92rem] ${s.estado === "estourou" ? "text-bad" : s.estado === "atencao" ? "text-maybe" : "text-muted"}`}>
        {explicarOrcamento(s, pessoa)}
      </p>
    </li>
  );
}

/** Com `pessoa`, os avisos falam dela (painel do profissional). */
export function ListaDoOrcamento({ situacoes, pessoa }: { situacoes: SituacaoDoOrcamento[]; pessoa?: string }) {
  return (
    <ul>
      {situacoes.map((s) => (
        <CartaoDoOrcamento key={s.categoria} situacao={s} pessoa={pessoa} />
      ))}
    </ul>
  );
}
