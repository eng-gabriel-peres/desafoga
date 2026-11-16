"use client";

import { Bell } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { chaveDoDia, ultimosDias } from "@/lib/finance";
import { servicos } from "@/services";
import { ListaDeAvisos } from "../avisos";
import { BotaoIcone } from "../ui/botao";
import type { Area } from "./navegacao";

/**
 * Sino de avisos. O responsável vê os avisos de todos os pacientes; a pessoa
 * vê as sugestões que os profissionais mandaram para ela.
 */
export function Sino({ area }: { area: Area }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId();
  const agora = useAgora();
  // O servidor já filtra: sugestões para a pessoa, alertas dos acompanhados para o profissional.
  const avisos = useConsulta(`avisos:${area}`, () => servicos.avisos.listar()) ?? [];
  const recentes = agora
    ? avisos.filter((a) => ultimosDias(agora, 2).includes(chaveDoDia(new Date(a.quando)))).length
    : 0;

  useEffect(() => {
    if (!aberto) return;
    const fecharFora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const fecharEsc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("pointerdown", fecharFora);
    document.addEventListener("keydown", fecharEsc);
    return () => {
      document.removeEventListener("pointerdown", fecharFora);
      document.removeEventListener("keydown", fecharEsc);
    };
  }, [aberto]);

  return (
    <div ref={caixa} className="relative">
      <BotaoIcone
        aria-label={recentes ? `Avisos, ${recentes} novos` : "Avisos"}
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
      >
        <Bell aria-hidden="true" />
        {recentes > 0 && (
          <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1 text-[0.7rem] text-white dark:text-[#0e141e]">
            {recentes}
          </span>
        )}
      </BotaoIcone>
      {aberto && agora && (
        <div
          id={id}
          role="dialog"
          aria-label="Avisos recentes"
          className="absolute top-13 right-0 z-40 max-h-[70dvh] w-[min(380px,calc(100vw-24px))] overflow-auto rounded-2xl border border-line bg-surface px-4 py-2 shadow-[0_12px_32px_rgb(0_0_0/0.18)]"
        >
          <b className="block pt-2 pb-1">Avisos recentes</b>
          <ListaDeAvisos avisos={avisos.slice(0, 6)} agora={agora} vazio="Nada novo por aqui." />
        </div>
      )}
    </div>
  );
}
