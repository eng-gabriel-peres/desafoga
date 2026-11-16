"use client";

import { useEffect, type RefObject } from "react";

/** Fecha uma caixa aberta (menu, avisos) com clique fora dela ou com Esc. */
export function useFecharFora(aberto: boolean, fechar: (comEsc: boolean) => void, caixa: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) fechar(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar(true);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto, fechar, caixa]);
}
