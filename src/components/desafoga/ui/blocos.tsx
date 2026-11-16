import { Info } from "lucide-react";
import type { ReactNode } from "react";
import type { Necessidade } from "@/lib/finance";
import type { Situacao } from "@/lib/finance";
import { NOME_DA_NECESSIDADE, AVISO_EDUCATIVO } from "@/lib/assistente/textos";

export function Painel({
  titulo,
  acao,
  children,
  className = "",
  rotulo,
}: {
  titulo?: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  /** aria-label quando não houver título visível. */
  rotulo?: string;
}) {
  return (
    <section aria-label={rotulo} className={`rounded-[var(--radius-card)] border border-line bg-surface p-[1.1rem] ${className}`}>
      {(titulo || acao) && (
        <div className="mb-2.5 flex items-center justify-between gap-2.5">
          {titulo && <h2 className="text-[1.12rem] leading-tight font-bold">{titulo}</h2>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; tom?: "ruim" | "bom" }) {
  const cor = tom === "ruim" ? "text-bad" : tom === "bom" ? "text-good" : "";
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <span className="block text-[0.85rem] text-muted">{rotulo}</span>
      <b className={`mt-1 block text-[1.35rem] leading-tight ${cor}`}>{valor}</b>
      {detalhe && <small className="text-[0.8rem] text-muted">{detalhe}</small>}
    </div>
  );
}

export function Sub({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[0.92rem] text-muted ${className}`}>{children}</p>;
}

const COR_DA_NECESSIDADE: Record<Necessidade, string> = {
  sim: "bg-good-soft text-good",
  nao: "bg-bad-soft text-bad",
  talvez: "bg-maybe-soft text-maybe",
};

export function Etiqueta({ children, tom = "neutra" }: { children: ReactNode; tom?: "boa" | "ruim" | "talvez" | "neutra" | "primaria" }) {
  const cor = {
    boa: "bg-good-soft text-good",
    ruim: "bg-bad-soft text-bad",
    talvez: "bg-maybe-soft text-maybe",
    neutra: "bg-surface2 text-muted border border-line",
    primaria: "bg-primary-soft text-primary",
  }[tom];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.8rem] font-bold whitespace-nowrap ${cor}`}>{children}</span>;
}

export function EtiquetaNecessidade({ necessidade }: { necessidade: Necessidade }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.8rem] font-bold whitespace-nowrap ${COR_DA_NECESSIDADE[necessidade]}`}>
      {NOME_DA_NECESSIDADE[necessidade]}
    </span>
  );
}

export const NOME_DA_SITUACAO: Record<Situacao, string> = {
  estavel: "Estável",
  acompanhar: "Acompanhar",
  atencao: "Precisa de atenção",
  novo: "Novo",
};

export function EtiquetaSituacao({ situacao }: { situacao: Situacao }) {
  const tom = ({ estavel: "boa", acompanhar: "talvez", atencao: "ruim", novo: "primaria" } as const)[situacao];
  return <Etiqueta tom={tom}>{NOME_DA_SITUACAO[situacao]}</Etiqueta>;
}

export function Avatar({ nome, cor, tamanho = "md" }: { nome: string; cor: string; tamanho?: "sm" | "md" | "lg" }) {
  const iniciais = nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const t = { sm: "size-8 text-[0.8rem]", md: "size-10 text-[0.95rem]", lg: "size-13 text-[1.15rem]" }[tamanho];
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${t}`} style={{ background: cor }}>
      {iniciais}
    </span>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-[var(--radius-card)] border-2 border-dashed border-line p-5 text-center text-muted">{children}</div>;
}

/** Aviso fixo das telas de dívidas. */
export function AvisoEducativo() {
  return (
    <p className="mt-3 flex items-start gap-2 text-[0.88rem] text-muted">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {AVISO_EDUCATIVO}
    </p>
  );
}

/** Placeholder enquanto os dados carregam. */
export function Carregando({ rotulo = "Carregando" }: { rotulo?: string }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      <span className="sr-only">{rotulo}…</span>
      <div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-surface" />
      <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-surface" />
      <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-surface" />
    </div>
  );
}

/** Título que só aparece no celular; no desktop o título fica no cabeçalho. */
export function TituloCelular({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <div className="mb-4 desk:hidden">
      <h1 className="text-[1.7rem] leading-tight font-bold">{titulo}</h1>
      {subtitulo && <p className="mt-0.5 text-muted">{subtitulo}</p>}
    </div>
  );
}

/** Botão de opção que fica marcado (chips, atalhos, filtros). */
export function Chip({
  marcado,
  children,
  onClick,
  pequeno,
}: {
  marcado: boolean;
  children: ReactNode;
  onClick: () => void;
  pequeno?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={marcado}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-line bg-surface px-3.5 font-bold hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary-soft [&_svg]:size-4 ${pequeno ? "text-[0.85rem]" : "text-[0.95rem]"}`}
    >
      {children}
    </button>
  );
}

/** Opção grande com bolinha de seleção (estratégia, tom). */
export function Opcao({
  marcada,
  onClick,
  titulo,
  descricao,
}: {
  marcada: boolean;
  onClick: () => void;
  titulo: string;
  descricao?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcada}
      onClick={onClick}
      className="group flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 py-2.5 text-left hover:border-primary aria-checked:border-primary aria-checked:bg-primary-soft"
    >
      <span
        aria-hidden="true"
        className="size-[18px] shrink-0 rounded-full border-2 border-line bg-surface group-aria-checked:border-primary group-aria-checked:bg-primary group-aria-checked:shadow-[inset_0_0_0_3px_var(--surface)]"
      />
      <span>
        <b className="block">{titulo}</b>
        {descricao && <span className="text-[0.88rem] text-muted">{descricao}</span>}
      </span>
    </button>
  );
}
