"use client";

import {
  Calculator,
  ClipboardList,
  HeartHandshake,
  Paperclip,
  Percent,
  PiggyBank,
  ShoppingBag,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef } from "react";

export interface Comando {
  Icone: LucideIcon;
  titulo: string;
  descricao: string;
  /** "enviar": manda o texto; "escrever": deixa no campo para completar; "arquivo": abre o seletor. */
  acao: { tipo: "enviar" | "escrever"; texto: string } | { tipo: "arquivo" };
}

export const COMANDOS: Comando[] = [
  { Icone: ShoppingBag, titulo: "Registrar uma compra", descricao: "Ex.: comprei pão 12", acao: { tipo: "escrever", texto: "comprei " } },
  { Icone: PiggyBank, titulo: "Guardei dinheiro", descricao: "Ex.: guardei 50. Coloca o valor numa meta e mostra quanto falta", acao: { tipo: "escrever", texto: "guardei " } },
  { Icone: TrendingDown, titulo: "E se eu pagar mais?", descricao: "Simula pagar R$ 200 a mais por mês", acao: { tipo: "enviar", texto: "e se eu pagar 200 a mais?" } },
  { Icone: Calculator, titulo: "Meu plano", descricao: "Quando você fica livre das dívidas", acao: { tipo: "enviar", texto: "plano" } },
  { Icone: Percent, titulo: "Juros do mês", descricao: "Juros, IOF e tarifas", acao: { tipo: "enviar", texto: "quanto eu pago de juros?" } },
  { Icone: ClipboardList, titulo: "Resumo de hoje", descricao: "Compras e nota do dia", acao: { tipo: "enviar", texto: "resumo" } },
  { Icone: Paperclip, titulo: "Enviar fatura ou print", descricao: "PDF ou foto da fatura, do extrato ou das compras", acao: { tipo: "arquivo" } },
  { Icone: HeartHandshake, titulo: "Desabafar", descricao: "Conte como você está", acao: { tipo: "escrever", texto: "Hoje eu tô me sentindo " } },
];

/** Menu de comandos que abre acima do campo de mensagem. */
export function MenuDeComandos({ id, fechar, escolher }: { id: string; fechar: () => void; escolher: (c: Comando) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const tituloId = useId();

  useEffect(() => {
    caixa.current?.querySelector<HTMLButtonElement>("button")?.focus();
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
      className="absolute bottom-full left-0 z-30 mb-2 max-h-[60dvh] w-[min(360px,calc(100vw-2rem))] overflow-auto rounded-2xl border border-line bg-surface p-2 shadow-[0_12px_32px_rgb(0_0_0/0.2)]"
    >
      <p id={tituloId} className="px-2.5 pt-1.5 pb-1 text-[0.85rem] font-bold text-muted">
        O que a Luana entende
      </p>
      <ul>
        {COMANDOS.map((c) => (
          <li key={c.titulo}>
            <button
              type="button"
              onClick={() => escolher(c)}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-primary-soft focus-visible:bg-primary-soft"
            >
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <c.Icone className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <b className="block leading-tight">{c.titulo}</b>
                <span className="text-[0.85rem] text-muted">{c.descricao}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
