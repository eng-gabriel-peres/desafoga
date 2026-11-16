/** Ícones e avatar do chat, desenhados em SVG para não depender de imagens externas. */

const traco = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function IconeClipe() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden {...traco}>
      <path d="M21 11.5l-8.6 8.6a5.5 5.5 0 01-7.8-7.8l8.9-8.9a3.7 3.7 0 015.2 5.2l-8.9 8.9a1.8 1.8 0 01-2.6-2.6l8.2-8.2" />
    </svg>
  );
}

export function IconeMicrofone() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden {...traco}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
    </svg>
  );
}

export function IconeEnviar() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="currentColor">
      <path d="M3.4 20.4L21 12 3.4 3.6l-.1 6.5L15 12 3.3 13.9z" />
    </svg>
  );
}

export function IconeLixeira() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...traco}>
      <path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconeFechar() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden {...traco}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Retrato ilustrado da Luana. É um desenho, não a foto de uma pessoa real. */
export function AvatarDaLuana({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <svg viewBox="0 0 80 80" width={tamanho} height={tamanho} role="img" aria-label="Luana" className="shrink-0 rounded-full">
      <rect width="80" height="80" fill="#bfe3f2" />
      {/* cabelo atrás */}
      <path d="M17 44c0-17 9-30 23-30s23 13 23 30v26H17z" fill="#3a2418" />
      {/* ombros */}
      <path d="M12 80c1-13 12-19 28-19s27 6 28 19z" fill="#0b6790" />
      {/* pescoço */}
      <path d="M33 52h14v11a7 7 0 01-14 0z" fill="#d9a07e" />
      {/* rosto */}
      <ellipse cx="40" cy="39" rx="14.5" ry="17" fill="#eab894" />
      {/* franja */}
      <path d="M24.5 37c0-12 6.5-19 15.500-19 9.500 0 15.500 7 15.500 19-5-2-9-6-11-11-3 5-10 9-20 11z" fill="#3a2418" />
      {/* sobrancelhas e olhos */}
      <path d="M31 36.500q3-2 6 0M43 36.500q3-2 6 0" fill="none" stroke="#3a2418" strokeWidth="1.300" strokeLinecap="round" />
      <ellipse cx="34" cy="40.500" rx="1.700" ry="2.100" fill="#2b1a12" />
      <ellipse cx="46" cy="40.500" rx="1.700" ry="2.100" fill="#2b1a12" />
      {/* bochechas */}
      <ellipse cx="30.500" cy="46" rx="3" ry="1.800" fill="#e59a86" opacity="0.550" />
      <ellipse cx="49.500" cy="46" rx="3" ry="1.800" fill="#e59a86" opacity="0.550" />
      {/* sorriso */}
      <path d="M34.500 47.500q5.500 5 11 0" fill="none" stroke="#a8503e" strokeWidth="1.800" strokeLinecap="round" />
    </svg>
  );
}

export function IconeSol() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...traco}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400" />
    </svg>
  );
}

export function IconeLua() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...traco}>
      <path d="M20 14.500A8.500 8.500 0 019.500 4a8.500 8.500 0 1010.500 10.500z" />
    </svg>
  );
}

export function IconePaleta() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...traco}>
      <path d="M12 3a9 9 0 100 18c1.400 0 2-1 2-2 0-1.500-1-1.800-1-3 0-1 .800-2 2-2h2a4 4 0 004-4c0-4-4-7-9-7z" />
      <circle cx="7.500" cy="11.500" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7.500" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.500" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconeVoltar() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden {...traco}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function IconeArquivo() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden {...traco}>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}
