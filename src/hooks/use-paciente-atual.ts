"use client";

import { useParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

const CHAVE = "desafoga-paciente";
const PADRAO = "";
const ouvintes = new Set<() => void>();

function lerGuardado(): string {
  try {
    return localStorage.getItem(CHAVE) ?? PADRAO;
  } catch {
    return PADRAO;
  }
}

/**
 * Paciente aberto no modo Responsável: o da rota, ou o último aberto quando a
 * rota não tem paciente (lista de pacientes). Vazio quando nenhum foi aberto.
 */
export function usePacienteAtual(): string {
  const params = useParams<{ id?: string }>();
  const guardado = useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    lerGuardado,
    () => PADRAO,
  );

  useEffect(() => {
    if (!params.id || params.id === lerGuardado()) return;
    try {
      localStorage.setItem(CHAVE, params.id);
    } catch {
      // Sem armazenamento: o menu volta para o paciente padrão.
    }
    ouvintes.forEach((o) => o());
  }, [params.id]);

  return params.id ?? guardado;
}
