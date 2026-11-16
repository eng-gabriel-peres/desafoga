"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useConsulta } from "@/hooks/use-consulta";
import { servicos, type Eu } from "@/services";
import type { Area } from "./moldura/navegacao";
import { Carregando } from "./ui/blocos";

const ContextoEu = createContext<Eu | null>(null);

/**
 * Garante que quem abriu a área tem o perfil certo (pessoa no app, profissional
 * no painel). Sem sessão, ou com o perfil errado, volta para a entrada.
 */
export function ComSessao({ area, children }: { area: Area; children: ReactNode }) {
  const router = useRouter();
  const eu = useConsulta("eu", () => servicos.sessao.eu());
  const certo = eu ? (area === "pessoa" ? eu.pessoa : eu.profissional) : null;

  useEffect(() => {
    if (eu === null || (eu && !certo)) router.replace("/");
  }, [eu, certo, router]);

  if (!eu || !certo) {
    return (
      <div className="mx-auto max-w-[620px] p-4">
        <Carregando rotulo="Abrindo o Desafoga" />
      </div>
    );
  }
  return <ContextoEu.Provider value={eu}>{children}</ContextoEu.Provider>;
}

/** Quem está usando o app. Só dentro de <ComSessao>. */
export function useEu(): Eu {
  const eu = useContext(ContextoEu);
  if (!eu) throw new Error("useEu fora de <ComSessao>.");
  return eu;
}

/** Id da pessoa da sessão (área do app). */
export function useMinhaPessoaId(): string {
  const eu = useEu();
  if (!eu.pessoa) throw new Error("Sessão sem pessoa.");
  return eu.pessoa.id;
}
