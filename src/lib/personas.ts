import type { Divida } from "@/lib/motor/juros";
import ana from "../../fixtures/personas/ana.json";
import carlos from "../../fixtures/personas/carlos.json";
import marina from "../../fixtures/personas/marina.json";

export interface Persona {
  id: string;
  nome: string;
  perfil: string;
  /** Encargos (juros, IOF, multas) cobrados na última fatura, em centavos. */
  encargosDaFatura: number;
  dividas: Divida[];
}

type Bruta = typeof ana | typeof carlos | typeof marina;

function carregar(bruta: Bruta): Persona {
  const encargos: { valor: number }[] = bruta.fatura.encargos;
  return {
    id: bruta.persona.id,
    nome: bruta.persona.nome,
    perfil: bruta.persona.perfil,
    encargosDaFatura: encargos.reduce((s, e) => s + e.valor, 0),
    dividas: bruta.dividas as Divida[],
  };
}

/** Personas com dados fictícios usadas na demo. Nenhum dado real entra aqui. */
export const PERSONAS: Persona[] = [ana, carlos, marina].map(carregar);

export function buscarPersona(id: string | null | undefined): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}
