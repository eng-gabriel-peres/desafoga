import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { recursoLigado, type Recurso } from "@/lib/recursos";

/** Recurso desligado (apresentação do hackathon): quem abre o endereço volta para `senao`. */
export function SoComRecurso({ recurso, senao, children }: { recurso: Recurso; senao: string; children: ReactNode }) {
  if (!recursoLigado(recurso)) redirect(senao);
  return children;
}
