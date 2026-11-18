"use client";

import { useMinhaPessoaId } from "../sessao";
import { SalaDoEventoTela } from "./sala";

/** A sala vista pela pessoa da sessão. */
export function SalaDaPessoa({ eventoId }: { eventoId: string }) {
  return <SalaDoEventoTela eventoId={eventoId} pessoaId={useMinhaPessoaId()} voltar="/app/eventos" />;
}
