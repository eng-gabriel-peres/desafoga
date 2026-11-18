"use client";

import { CalendarDays, Check, CircleHelp, Gift, ListChecks, MapPin, Target, X } from "lucide-react";
import { useState } from "react";
import { dataCurtaDaChave, dataLongaDaChave, regraEmTexto } from "@/lib/assistente/textos";
import type { EstadoDoDia } from "@/lib/finance";
import { servicos, type ParticipanteVisto, type RespostaAoEncontro, type SalaDoEvento } from "@/services";
import { Avatar, Etiqueta } from "../ui/blocos";

export const nomeDoTipo = (e: SalaDoEvento) => (e.tipo === "desafio" ? "Desafio em grupo" : "Encontro presencial");

export function quandoDoEvento(e: SalaDoEvento): string {
  if (e.tipo === "desafio") return `${dataCurtaDaChave(e.inicio ?? "")} a ${dataCurtaDaChave(e.fim ?? "")}`;
  return `${dataLongaDaChave(e.data ?? "")}, ${e.hora}`;
}

export const regraDoEvento = (e: SalaDoEvento) => (e.regra ? regraEmTexto({ regra: e.regra, categoria: e.categoria, limite: e.limite }) : "");

export function IconeDoEvento({ evento }: { evento: SalaDoEvento }) {
  const desafio = evento.tipo === "desafio";
  const Icone = desafio ? Target : MapPin;
  return (
    <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-xl ${desafio ? "bg-primary-soft text-primary" : "bg-maybe-soft text-maybe"}`}>
      <Icone className="size-5" />
    </span>
  );
}

export function EtiquetaDaFase({ evento }: { evento: SalaDoEvento }) {
  const tom = ({ breve: "primaria", agora: "boa", fim: "neutra" } as const)[evento.situacao.fase];
  return <Etiqueta tom={tom}>{evento.situacao.texto}</Etiqueta>;
}

export function PilhaDeAvatares({ participantes }: { participantes: ParticipanteVisto[] }) {
  return (
    <span className="flex -space-x-2">
      {participantes.slice(0, 5).map((p) => (
        <span key={p.pessoaId} title={p.nome} className="rounded-full ring-2 ring-surface">
          <Avatar nome={p.nome} cor={p.cor} tamanho="sm" />
        </span>
      ))}
      {participantes.length > 5 && (
        <span className="grid size-8 place-items-center rounded-full bg-muted text-[0.8rem] font-bold text-white ring-2 ring-surface">+{participantes.length - 5}</span>
      )}
    </span>
  );
}

/** Data, regra (ou local) e prêmio. */
export function LinhasDoEvento({ evento: e }: { evento: SalaDoEvento }) {
  const linhas: [typeof CalendarDays, string][] = [[CalendarDays, quandoDoEvento(e)]];
  if (e.tipo === "desafio") linhas.push([ListChecks, regraDoEvento(e)]);
  else linhas.push([MapPin, e.local ?? ""]);
  if (e.tipo === "desafio" && e.premio) linhas.push([Gift, e.premio]);
  return (
    <ul className="mt-2.5 grid gap-1 text-[0.92rem]">
      {linhas.map(([Icone, texto]) => (
        <li key={texto} className="flex items-start gap-2">
          <Icone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
          <span>{texto}</span>
        </li>
      ))}
    </ul>
  );
}

const ESTILO_DO_DIA: Record<EstadoDoDia, string> = {
  ok: "bg-good text-white border-good",
  fora: "bg-bad text-white border-bad",
  futuro: "bg-surface text-muted border-line border-dashed",
  antes: "bg-surface2 text-muted border-line",
};

/** Uma bolinha por dia do desafio: dentro da regra, fora, ou ainda não chegou. */
export function Bolinhas({ dias, hoje, grande }: { dias: { dia: string; estado: EstadoDoDia }[]; hoje: string; grande?: boolean }) {
  const ok = dias.filter((d) => d.estado === "ok").length;
  const fora = dias.filter((d) => d.estado === "fora").length;
  return (
    <div role="img" aria-label={`${ok} dias dentro da regra, ${fora} fora`} className="flex flex-wrap gap-1.5">
      {dias.map((d, i) => (
        <span
          key={d.dia}
          title={dataCurtaDaChave(d.dia)}
          className={`grid place-items-center rounded-full border-2 font-bold ${grande ? "size-10 text-[0.9rem]" : "size-7 text-[0.75rem]"} ${ESTILO_DO_DIA[d.estado]} ${d.dia === hoje ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : ""}`}
        >
          {d.estado === "ok" ? <Check className="size-4" /> : d.estado === "fora" ? <X className="size-4" /> : i + 1}
        </span>
      ))}
    </div>
  );
}

export function LegendaDasBolinhas() {
  return (
    <p className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.85rem] text-muted">
      <span className="inline-flex items-center gap-1">
        <span className="grid size-4 place-items-center rounded-full bg-good text-white">
          <Check className="size-3" />
        </span>
        dentro da regra
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="grid size-4 place-items-center rounded-full bg-bad text-white">
          <X className="size-3" />
        </span>
        fora da regra
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="size-4 rounded-full border-2 border-dashed border-line" />
        ainda não chegou
      </span>
    </p>
  );
}

const RESPOSTAS: [RespostaAoEncontro, typeof Check, string][] = [
  ["vou", Check, "Vou"],
  ["talvez", CircleHelp, "Talvez"],
  ["nao", X, "Não vou"],
];

/** "Você vai?" do encontro presencial. */
export function VoceVai({ evento, atual }: { evento: SalaDoEvento; atual: RespostaAoEncontro | null }) {
  const [enviando, setEnviando] = useState(false);
  return (
    <div role="group" aria-label="Você vai?" className="grid grid-cols-3 gap-2">
      {RESPOSTAS.map(([r, Icone, rotulo]) => (
        <button
          key={r}
          type="button"
          aria-pressed={atual === r}
          disabled={enviando}
          onClick={async () => {
            setEnviando(true);
            await servicos.eventos.responder(evento.id, r).finally(() => setEnviando(false));
          }}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-2 font-bold aria-pressed:border-primary aria-pressed:bg-primary-soft [&_svg]:size-4"
        >
          <Icone aria-hidden="true" />
          {rotulo}
        </button>
      ))}
    </div>
  );
}

/** Hoje em Brasília, como o servidor conta os dias do desafio. */
export const hojeNoBrasil = (agora: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
