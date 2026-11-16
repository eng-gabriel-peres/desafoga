"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHAVE = "pausa-letra-maior";
const CLASSE = "letra-maior";
const ouvintes = new Set<() => void>();

const ligada = () => document.documentElement.classList.contains(CLASSE);

/** "Letra maior": aumenta a escala de fonte do app inteiro e lembra a escolha. */
export function useLetraMaior(): [boolean, () => void] {
  const ativa = useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    ligada,
    () => false,
  );

  const alternar = useCallback(() => {
    const nova = !ligada();
    document.documentElement.classList.toggle(CLASSE, nova);
    try {
      localStorage.setItem(CHAVE, nova ? "1" : "0");
    } catch {
      // Sem armazenamento: vale só nesta aba.
    }
    ouvintes.forEach((o) => o());
  }, []);

  return [ativa, alternar];
}
