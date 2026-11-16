import Link from "next/link";
import type { ComponentProps } from "react";

type Variante = "primario" | "secundario" | "link";
type Tamanho = "normal" | "pequeno" | "grande";

const BASE =
  "inline-flex items-center justify-center gap-2 font-bold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-[1.15em] [&_svg]:shrink-0";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-primary text-primary-ink border-2 border-primary hover:brightness-110",
  secundario: "bg-surface text-ink border-2 border-line hover:border-primary",
  link: "bg-transparent text-primary border-0 px-0! hover:underline",
};

const TAMANHOS: Record<Tamanho, string> = {
  normal: "min-h-14 rounded-[var(--radius-ctl)] px-5 text-[1.05rem] desk:min-h-12 desk:text-base",
  pequeno: "min-h-11 rounded-[11px] px-3.5 text-[0.92rem]",
  grande: "min-h-[4.25rem] rounded-[var(--radius-card)] px-6 text-[1.2rem] desk:min-h-[3.75rem] desk:text-[1.1rem]",
};

interface Estilo {
  variante?: Variante;
  tamanho?: Tamanho;
  bloco?: boolean;
}

export function classesDoBotao({ variante = "primario", tamanho = "normal", bloco = false }: Estilo, extra = "") {
  return `${BASE} ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${bloco ? "w-full" : ""} ${extra}`;
}

export function Botao({ variante, tamanho, bloco, className = "", type = "button", ...props }: Estilo & ComponentProps<"button">) {
  return <button type={type} className={classesDoBotao({ variante, tamanho, bloco }, className)} {...props} />;
}

export function BotaoLink({ variante, tamanho, bloco, className = "", ...props }: Estilo & ComponentProps<typeof Link>) {
  return <Link className={classesDoBotao({ variante, tamanho, bloco }, className)} {...props} />;
}

/** Botão só de ícone: quadrado de 44px, sempre com aria-label. */
export function BotaoIcone({
  className = "",
  type = "button",
  leve = false,
  ...props
}: ComponentProps<"button"> & { "aria-label": string; /** Só o ícone, sem o quadro atrás. */ leve?: boolean }) {
  const estilo = leve
    ? "rounded-full text-muted hover:bg-surface2 hover:text-ink aria-expanded:bg-surface2 aria-expanded:text-ink aria-pressed:bg-primary-soft aria-pressed:text-primary"
    : "rounded-[10px] border border-line bg-surface2 text-ink hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-ink";
  return (
    <button
      type={type}
      className={`relative inline-grid size-11 shrink-0 place-items-center font-bold [&_svg]:size-5 ${estilo} ${className}`}
      {...props}
    />
  );
}
