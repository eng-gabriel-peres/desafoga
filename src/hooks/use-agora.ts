"use client";

import { useSyncExternalStore } from "react";

let agora = new Date();
const ouvintes = new Set<() => void>();
let relogio: ReturnType<typeof setInterval> | null = null;

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  relogio ??= setInterval(() => {
    agora = new Date();
    ouvintes.forEach((o) => o());
  }, 60_000);
  return () => {
    ouvintes.delete(ouvinte);
    if (!ouvintes.size && relogio) {
      clearInterval(relogio);
      relogio = null;
    }
  };
}

/**
 * Data e hora atuais, atualizadas a cada minuto. No servidor é null: o que
 * depende de "hoje" só aparece no navegador, sem diferença de hidratação.
 */
export function useAgora(): Date | null {
  return useSyncExternalStore(
    assinar,
    () => agora,
    () => null,
  );
}
