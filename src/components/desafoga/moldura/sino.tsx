"use client";

import { Bell } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { useFecharFora } from "@/hooks/use-fechar-fora";
import { servicos } from "@/services";
import { ListaDeAvisos } from "../avisos";
import { BotaoIcone } from "../ui/botao";
import type { Area } from "./navegacao";

/**
 * Sino de avisos. O responsável vê os avisos de todos os pacientes; a pessoa
 * vê as sugestões que os profissionais mandaram para ela.
 */
export function Sino({ area, paraCima = false }: { area: Area; /** Na barra lateral, a caixa abre para cima. */ paraCima?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId();
  const agora = useAgora();
  // O servidor já filtra: sugestões para a pessoa, alertas dos acompanhados para o profissional.
  const avisos = useConsulta(`avisos:${area}`, () => servicos.avisos.listar()) ?? [];
  const recentes = avisos.filter((a) => a.lido === false).length;
  const ver = (ids: string[] | null) => void servicos.avisos.marcarVistos(ids).catch(() => {});

  const fechar = useCallback(() => setAberto(false), []);
  useFecharFora(aberto, fechar, caixa);

  return (
    <div ref={caixa} className="relative">
      <BotaoIcone
        leve
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
          className={`absolute z-40 ${paraCima ? "surgir-de-baixo bottom-13 left-0" : "surgir top-13 right-0"} max-h-[70dvh] w-[min(380px,calc(100vw-24px))] overflow-auto rounded-2xl border border-line bg-surface px-4 py-2 shadow-[0_12px_32px_rgb(0_0_0/0.18)]`}
        >
          <div className="flex items-center justify-between gap-2 pt-2 pb-1">
            <b>Avisos recentes</b>
            {recentes > 0 && (
              <button type="button" onClick={() => ver(null)} className="text-[0.85rem] font-bold text-primary hover:underline">
                Marcar todos como vistos
              </button>
            )}
          </div>
          <ListaDeAvisos avisos={avisos.slice(0, 8)} agora={agora} vazio="Nada novo por aqui." aoVer={(id) => ver([id])} />
        </div>
      )}
    </div>
  );
}
