import type { ComponentProps } from "react";

export const CAMPO =
  "min-h-12 w-full rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 outline-none focus:border-primary";

/** Campo de valor em reais, com "R$" fixo na frente. */
export function CampoReais({ rotulo, className = "", ...props }: { rotulo: string } & Omit<ComponentProps<"input">, "type">) {
  return (
    <label className={className}>
      <span className="mb-1 block font-bold">{rotulo}</span>
      <span className="flex items-center rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 focus-within:border-primary">
        <span aria-hidden="true" className="font-bold text-muted">
          R$
        </span>
        <input inputMode="decimal" placeholder="0,00" autoComplete="off" className="min-h-11 w-full border-0 bg-transparent pl-2 outline-none" {...props} />
      </span>
    </label>
  );
}

/** Barra de progresso só visual; o texto ao lado diz os números. */
export function Barra({ fracao, tom }: { fracao: number; tom: "primaria" | "boa" | "atencao" | "ruim" }) {
  const cor = { primaria: "bg-primary", boa: "bg-good", atencao: "bg-maybe", ruim: "bg-bad" }[tom];
  return (
    <span aria-hidden="true" className="block h-2.5 overflow-hidden rounded-full bg-surface2 ring-1 ring-line ring-inset">
      <span className={`block h-full rounded-full ${cor}`} style={{ width: `${Math.max(2, Math.min(100, fracao * 100))}%` }} />
    </span>
  );
}
