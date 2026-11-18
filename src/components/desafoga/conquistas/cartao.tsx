"use client";

import { Check, Gift, Medal, NotebookPen, PartyPopper, Sparkles, Sprout, Star, Target, Trophy, Zap, type LucideIcon } from "lucide-react";
import { progressoDaConquista, TIPOS_DE_CONQUISTA, type Compra, type Conquista, type IconeDaConquista } from "@/lib/finance";

export const ICONE_DA_CONQUISTA: Record<IconeDaConquista, [LucideIcon, string]> = {
  broto: [Sprout, "broto"],
  caderno: [NotebookPen, "caderno"],
  brilho: [Sparkles, "brilho"],
  estrela: [Star, "estrela"],
  alvo: [Target, "alvo"],
  raio: [Zap, "raio"],
  medalha: [Medal, "medalha"],
  festa: [PartyPopper, "festa"],
};

/** Progresso limitado ao alvo; conquistada fica cheia mesmo se o progresso cair. */
export function andamento(c: Conquista, compras: Compra[], agora: Date): { feito: number; completa: boolean } {
  const feito = Math.min(progressoDaConquista(c, compras, agora), c.alvo);
  const completa = c.concluidaEm !== null || feito >= c.alvo;
  return { feito: completa ? c.alvo : feito, completa };
}

/** Cartão da conquista, como no protótipo. `aoApagar` só no painel do profissional. */
export function CartaoDaConquista({ conquista: c, compras, agora, aoApagar }: { conquista: Conquista; compras: Compra[]; agora: Date; aoApagar?: () => void }) {
  const { feito, completa } = andamento(c, compras, agora);
  const tipo = TIPOS_DE_CONQUISTA[c.tipo];
  const [Icone] = ICONE_DA_CONQUISTA[c.icone] ?? [Trophy];
  return (
    <article className={`entrar grid grid-cols-[56px_minmax(0,1fr)] gap-3.5 rounded-[18px] bg-surface p-4 ${completa ? "border-2 border-good" : "border border-line"}`}>
      <span
        aria-hidden="true"
        className={`grid size-14 place-items-center rounded-2xl border ${completa ? "border-good bg-good-soft text-good" : "border-line bg-surface2"}`}
      >
        <Icone className="size-7" />
      </span>
      <div className="min-w-0">
        <h3 className="text-[1.05rem] font-bold">{c.titulo}</h3>
        <p className="text-[0.9rem] text-muted">{tipo.titulo}</p>
        <div
          role="progressbar"
          aria-label={`Progresso de ${c.titulo}`}
          aria-valuemin={0}
          aria-valuemax={c.alvo}
          aria-valuenow={feito}
          className="mt-2.5 mb-1 h-3 overflow-hidden rounded-md border border-line bg-surface2"
        >
          <i className={`block h-full rounded-md ${completa ? "bg-good" : "bg-primary"}`} style={{ width: `${Math.round((feito / c.alvo) * 100)}%` }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[0.88rem] text-muted">
          {completa ? (
            <span className="inline-flex items-center gap-1 font-bold text-good">
              <Check aria-hidden="true" className="size-4" /> Conquistada!
            </span>
          ) : (
            <span>
              {feito} de {c.alvo} {tipo.unidade}
            </span>
          )}
          {aoApagar ? (
            <button type="button" onClick={aoApagar} className="font-bold text-primary underline-offset-2 hover:underline">
              Apagar
            </button>
          ) : (
            c.autor && <span>Criada por {c.autor}</span>
          )}
        </div>
        {c.premio && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[0.92rem]">
            <Gift aria-hidden="true" className="size-4 shrink-0" /> Prêmio: <b>{c.premio}</b>
          </p>
        )}
      </div>
    </article>
  );
}
