"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHAVE = "desafoga-barra-recolhida";
const ouvintes = new Set<() => void>();

function ler(): boolean {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

/** Barra lateral do desktop recolhida (só ícones). Lembra a escolha neste navegador. */
export function useBarraRecolhida(): [boolean, () => void] {
  const recolhida = useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    ler,
    () => false,
  );
  const alternar = useCallback(() => {
    try {
      localStorage.setItem(CHAVE, ler() ? "0" : "1");
    } catch {
      // Sem armazenamento: não dá para lembrar; segue como está.
    }
    ouvintes.forEach((o) => o());
  }, []);
  return [recolhida, alternar];
}
