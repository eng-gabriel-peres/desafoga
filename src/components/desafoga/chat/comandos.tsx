"use client";

import {
  ArrowLeft,
  Calculator,
  ChevronRight,
  ClipboardList,
  HeartHandshake,
  Paperclip,
  Percent,
  PiggyBank,
  ShoppingBag,
  TrendingDown,
  Zap,
  type LucideIcon,
  CalendarCheck,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface Comando {
  Icone: LucideIcon;
  titulo: string;
  descricao: string;
  /** "enviar": manda o texto; "escrever": deixa no campo para completar; "arquivo": abre o seletor. */
  acao: { tipo: "enviar" | "escrever"; texto: string } | { tipo: "arquivo" };
}

/** Mandar um arquivo: fica fora da lista de atalhos, como o "Documento" do WhatsApp. */
export const ENVIAR_ARQUIVO: Comando = {
  Icone: Paperclip,
  titulo: "Enviar arquivo",
  descricao: "PDF ou foto da fatura, do extrato ou das compras",
  acao: { tipo: "arquivo" },
};

export const COMANDOS: Comando[] = [
  { Icone: ShoppingBag, titulo: "Registrar uma compra", descricao: "Ex.: comprei pão 12", acao: { tipo: "escrever", texto: "comprei " } },
  { Icone: PiggyBank, titulo: "Guardei dinheiro", descricao: "Ex.: guardei 50. Coloca o valor numa meta e mostra quanto falta", acao: { tipo: "escrever", texto: "guardei " } },
  { Icone: CalendarCheck, titulo: "Paguei uma conta", descricao: "Ex.: paguei luz 87,50. Marca a conta do mês como paga", acao: { tipo: "escrever", texto: "paguei " } },
  { Icone: TrendingDown, titulo: "E se eu pagar mais?", descricao: "Simula pagar R$ 200 a mais por mês", acao: { tipo: "enviar", texto: "e se eu pagar 200 a mais?" } },
  { Icone: Calculator, titulo: "Meu plano", descricao: "Quando você fica livre das dívidas", acao: { tipo: "enviar", texto: "plano" } },
  { Icone: Percent, titulo: "Juros do mês", descricao: "Juros, IOF e tarifas", acao: { tipo: "enviar", texto: "quanto eu pago de juros?" } },
  { Icone: ClipboardList, titulo: "Resumo de hoje", descricao: "Compras e nota do dia", acao: { tipo: "enviar", texto: "resumo" } },
  { Icone: HeartHandshake, titulo: "Desabafar", descricao: "Conte como você está", acao: { tipo: "escrever", texto: "Hoje eu tô me sentindo " } },
];

function Item({ Icone, titulo, descricao, onClick, seta = false }: { Icone: LucideIcon; titulo: string; descricao: string; onClick: () => void; seta?: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-primary-soft focus-visible:bg-primary-soft"
      >
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <Icone className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block leading-tight">{titulo}</b>
          <span className="text-[0.85rem] text-muted">{descricao}</span>
        </span>
        {seta && <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />}
      </button>
    </li>
  );
}

/**
 * Menu do "+" ao lado do campo, como no WhatsApp: primeiro só duas opções
 * (enviar arquivo e atalhos); os atalhos abrem a lista do que a Luana faz.
 */
export function MenuDeComandos({ id, fechar, escolher }: { id: string; fechar: () => void; escolher: (c: Comando) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const [atalhos, setAtalhos] = useState(false);

  useEffect(() => {
    caixa.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [atalhos]);

  useEffect(() => {
    const fecharFora = (e: PointerEvent) => {
      const alvo = e.target as HTMLElement;
      if (!caixa.current?.contains(alvo) && !alvo.closest("[data-abre-comandos]")) fechar();
    };
    const fecharEsc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("pointerdown", fecharFora);
    document.addEventListener("keydown", fecharEsc);
    return () => {
      document.removeEventListener("pointerdown", fecharFora);
      document.removeEventListener("keydown", fecharEsc);
    };
  }, [fechar]);

  return (
    <div
      ref={caixa}
      id={id}
      role="dialog"
      aria-labelledby={tituloId}
      className="surgir-de-baixo absolute bottom-full left-0 z-30 mb-2 max-h-[60dvh] w-[min(360px,calc(100vw-2rem))] overflow-auto rounded-2xl border border-line bg-surface p-2 shadow-[0_12px_32px_rgb(0_0_0/0.2)]"
    >
      {atalhos ? (
        <>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAtalhos(false)}
              aria-label="Voltar"
              className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface2 hover:text-ink"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </button>
            <p id={tituloId} className="font-bold">
              Atalhos
            </p>
          </div>
          <ul>
            {COMANDOS.map((c) => (
              <Item key={c.titulo} Icone={c.Icone} titulo={c.titulo} descricao={c.descricao} onClick={() => escolher(c)} />
            ))}
          </ul>
        </>
      ) : (
        <>
          <p id={tituloId} className="sr-only">
            Mais opções
          </p>
          <ul>
            <Item Icone={ENVIAR_ARQUIVO.Icone} titulo={ENVIAR_ARQUIVO.titulo} descricao={ENVIAR_ARQUIVO.descricao} onClick={() => escolher(ENVIAR_ARQUIVO)} />
            <Item Icone={Zap} titulo="Atalhos" descricao="O que a Luana sabe fazer" onClick={() => setAtalhos(true)} seta />
          </ul>
        </>
      )}
    </div>
  );
}
