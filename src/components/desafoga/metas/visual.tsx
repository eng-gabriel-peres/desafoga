"use client";

import { Car, Check, Gift, GraduationCap, Heart, House, PiggyBank, Plane, Shield, Smartphone, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { CorDaMeta, IconeDaMeta, SituacaoDaMeta } from "@/lib/finance";
import { rotuloDoRitmo } from "@/lib/assistente/textos";

export const COR_DA_META: Record<CorDaMeta, string> = {
  azul: "#3B6FE0",
  amarelo: "#E8B931",
  coral: "#E8455A",
  violeta: "#8B5CF6",
  petroleo: "#14A3A0",
};

export const ICONE_DA_META: Record<IconeDaMeta, [LucideIcon, string]> = {
  "piggy-bank": [PiggyBank, "Cofrinho"],
  shield: [Shield, "Escudo"],
  plane: [Plane, "Avião"],
  home: [House, "Casa"],
  car: [Car, "Carro"],
  "graduation-cap": [GraduationCap, "Estudo"],
  gift: [Gift, "Presente"],
  smartphone: [Smartphone, "Celular"],
  heart: [Heart, "Coração"],
};

/** Cor da meta, ou verde quando concluída. */
export const corDaMeta = (cor: CorDaMeta, concluida: boolean) => (concluida ? "var(--good)" : COR_DA_META[cor]);

/** Quadradinho com o ícone da meta na cor dela. */
export function IconeDaMetaBadge({ icone, cor }: { icone: IconeDaMeta; cor: string }) {
  const [Icone] = ICONE_DA_META[icone];
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-[11px]"
      style={{ color: cor, background: `color-mix(in srgb, ${cor} 16%, var(--surface))` }}
    >
      <Icone className="size-5" />
    </span>
  );
}

/** "Em dia", "Adiantada", "Faltam R$ X para ficar em dia" ou "Concluída". */
export function EtiquetaDoRitmo({ situacao }: { situacao: SituacaoDaMeta }) {
  const cor = situacao.concluida || situacao.ritmo !== "atrasada" ? "bg-good-soft text-good" : "bg-maybe-soft text-maybe";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.8rem] font-bold whitespace-nowrap ${cor}`}>
      {situacao.concluida && <Check aria-hidden="true" className="size-3.5" />}
      {rotuloDoRitmo(situacao)}
    </span>
  );
}

/**
 * Anel de progresso, com a seta na ponta enquanto não termina. Só visual:
 * os números vão em texto ao lado ou no centro.
 */
export function Anel({
  fracao,
  cor,
  tamanho,
  espessura,
  centro,
  animar = true,
}: {
  fracao: number;
  cor: string;
  tamanho: number;
  espessura: number;
  centro: ReactNode;
  animar?: boolean;
}) {
  const r = (tamanho - espessura) / 2;
  const h = tamanho / 2;
  const circunferencia = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, fracao));
  const concluida = v >= 0.9999;
  const cheio = concluida ? 0 : circunferencia * (1 - v);
  const angulo = -Math.PI / 2 + 2 * Math.PI * v;
  const s = espessura * 0.28;
  const corFinal = concluida ? "var(--good)" : cor;
  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      <svg viewBox={`0 0 ${tamanho} ${tamanho}`} width={tamanho} height={tamanho} aria-hidden="true" className="block">
        <circle cx={h} cy={h} r={r} fill="none" stroke={`color-mix(in srgb, ${corFinal} 20%, transparent)`} strokeWidth={espessura} />
        {v > 0 && (
          <circle
            className={animar ? "anel-arco" : undefined}
            cx={h}
            cy={h}
            r={r}
            fill="none"
            stroke={corFinal}
            strokeWidth={espessura}
            strokeLinecap="round"
            strokeDasharray={circunferencia.toFixed(2)}
            strokeDashoffset={cheio.toFixed(2)}
            transform={`rotate(-90 ${h} ${h})`}
            style={{ ["--cheio" as string]: circunferencia.toFixed(2), ["--resto" as string]: cheio.toFixed(2) }}
          />
        )}
        {v > 0.04 && !concluida && (
          <path
            className={animar ? "anel-ponta" : undefined}
            d={`M ${-s} 0 H ${s} M ${s * 0.25} ${-s * 0.75} L ${s} 0 L ${s * 0.25} ${s * 0.75}`}
            transform={`translate(${(h + r * Math.cos(angulo)).toFixed(1)} ${(h + r * Math.sin(angulo)).toFixed(1)}) rotate(${((angulo * 180) / Math.PI + 90).toFixed(1)})`}
            fill="none"
            // Branco sobre a cor do anel: aparece em todas as cores, no claro e no escuro.
            stroke="#ffffff"
            strokeWidth={Math.max(1.8, espessura / 7)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-[1.1]">{centro}</div>
    </div>
  );
}
