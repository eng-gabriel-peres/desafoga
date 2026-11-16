import type { Emocao } from "@/lib/finance";
import { NOME_DA_EMOCAO } from "@/lib/assistente/textos";

/** Boca de cada nível: da tristeza (curva para baixo) à alegria (sorriso aberto). */
const BOCA: Record<Emocao, string> = {
  1: "M8 16.8 Q12 12.6 16 16.8",
  2: "M8.6 16.2 Q12 14.2 15.4 16.2",
  3: "M8.6 15.4 L15.4 15.4",
  4: "M8.6 14.6 Q12 17.4 15.4 14.6",
  5: "M7.8 13.8 Q12 19.2 16.2 13.8 Z",
};

export const COR_DA_EMOCAO: Record<Emocao, string> = {
  1: "var(--e1)",
  2: "var(--e2)",
  3: "var(--e3)",
  4: "var(--e4)",
  5: "var(--e5)",
};

const TAMANHOS = {
  xs: "size-7 border-2",
  sm: "size-9 border-2",
  md: "size-12 border-2",
  lg: "size-20 border-[3px] desk:size-24",
} as const;

/** Só o desenho do rosto, para usar dentro de outros elementos. */
export function RostoSvg({ emocao, className = "size-[70%]" }: { emocao: Emocao; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="8.8" cy="10" r="1.35" fill="currentColor" />
      <circle cx="15.2" cy="10" r="1.35" fill="currentColor" />
      <path
        d={BOCA[emocao]}
        fill={emocao === 5 ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {emocao === 1 && <path d="M7.4 12.4 q-1 1.6 0 2.2 q1-.6 0-2.2z" fill="currentColor" />}
    </svg>
  );
}

interface CarinhaProps {
  emocao: Emocao;
  tamanho?: keyof typeof TAMANHOS;
  /** Texto para leitores de tela. `false` quando o texto já está ao lado. */
  rotulo?: string | false;
  className?: string;
}

/** Carinha de emoção em círculo, na cor da escala de 1 (muito triste) a 5 (muito feliz). */
export function Carinha({ emocao, tamanho = "md", rotulo, className = "" }: CarinhaProps) {
  const cor = COR_DA_EMOCAO[emocao];
  const texto = rotulo === false ? undefined : (rotulo ?? `Estava ${NOME_DA_EMOCAO[emocao].toLowerCase()}`);
  return (
    <span
      role={texto ? "img" : undefined}
      aria-label={texto}
      aria-hidden={texto ? undefined : true}
      title={texto}
      className={`inline-grid shrink-0 place-items-center rounded-full text-ink ${TAMANHOS[tamanho]} ${className}`}
      style={{ borderColor: cor, background: `color-mix(in srgb, ${cor} 28%, var(--surface))` }}
    >
      <RostoSvg emocao={emocao} />
    </span>
  );
}
