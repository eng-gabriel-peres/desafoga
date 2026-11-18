"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useConsulta } from "@/hooks/use-consulta";
import { servicos, type Aviso } from "@/services";
import { ICONE_DO_AVISO, linkDoAviso } from "../avisos";
import type { Area } from "./navegacao";

const TEMPO_NA_TELA = 8000;

/**
 * Quando chega um aviso novo com o app aberto, ele aparece um instante no
 * canto da tela (no celular, no topo). Os que já existiam ao abrir não aparecem.
 */
export function AvisoNovo({ area }: { area: Area }) {
  const avisos = useConsulta(`avisos-novos:${area}`, () => servicos.avisos.listar());
  const conhecidos = useRef<Set<string> | null>(null);
  const [mostrando, setMostrando] = useState<Aviso | null>(null);

  useEffect(() => {
    if (!avisos) return;
    if (!conhecidos.current) {
      conhecidos.current = new Set(avisos.map((a) => a.id));
      return;
    }
    const novos = avisos.filter((a) => !conhecidos.current!.has(a.id) && a.lido === false);
    for (const a of avisos) conhecidos.current.add(a.id);
    // A lista vem do mais novo para o mais antigo.
    if (novos.length) setMostrando(novos[0]);
  }, [avisos]);

  useEffect(() => {
    if (!mostrando) return;
    const t = setTimeout(() => setMostrando(null), TEMPO_NA_TELA);
    return () => clearTimeout(t);
  }, [mostrando]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 top-3 z-50 flex justify-end desk:inset-x-auto desk:top-auto desk:right-5 desk:bottom-5">
      {mostrando && <Cartao aviso={mostrando} fechar={() => setMostrando(null)} area={area} />}
    </div>
  );
}

function Cartao({ aviso, fechar, area }: { aviso: Aviso; fechar: () => void; area: Area }) {
  const [Icone, cor] = ICONE_DO_AVISO[aviso.tipo];
  const link = area === "pessoa" ? linkDoAviso(aviso) : null;
  const ver = () => {
    void servicos.avisos.marcarVistos([aviso.id]).catch(() => {});
    fechar();
  };
  return (
    <div role="status" className="surgir pointer-events-auto flex w-full max-w-[380px] gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-[0_12px_32px_rgb(0_0_0/0.22)]">
      <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-[10px] border border-line bg-surface2 ${cor}`}>
        <Icone className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.8rem] font-bold text-muted">Aviso novo</p>
        <p className="line-clamp-2">{aviso.texto}</p>
        <div className="mt-1 flex gap-3 text-[0.88rem] font-bold">
          {link && (
            <Link href={link.href} onClick={ver} className="text-primary">
              {link.rotulo}
            </Link>
          )}
          <button type="button" onClick={ver} className="text-muted hover:underline">
            Marcar como visto
          </button>
        </div>
      </div>
      <button type="button" aria-label="Fechar aviso" onClick={fechar} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface2">
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
