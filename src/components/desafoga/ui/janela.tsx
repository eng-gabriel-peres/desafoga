"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Janela por cima da tela atual, como a do Registrar compra: no desktop, no
 * meio da tela com o fundo escurecido; no celular, ocupando a tela. Usa
 * <dialog> nativo: Esc fecha e o foco fica dentro enquanto está aberta.
 * O conteúdo (um formulário em <Painel>) aparece sem a moldura do painel.
 */
export function Janela({
  aberta,
  fechar,
  rotulo,
  larga = false,
  children,
}: {
  aberta: boolean;
  fechar: () => void;
  rotulo: string;
  /** Formulários com duas colunas (meta). */
  larga?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) {
      d.showModal();
      // O foco começa na janela (leitor de tela lê o título), não no botão de fechar.
      d.querySelector<HTMLElement>("[data-inicio]")?.focus();
    }
    if (!aberta && d.open) d.close();
  }, [aberta]);

  return (
    <dialog
      ref={ref}
      aria-label={rotulo}
      onClose={fechar}
      onClick={(e) => e.target === e.currentTarget && fechar()}
      className={`janela-de-registro janela m-0 h-dvh max-h-none w-full max-w-none overflow-auto border-0 bg-bg p-0 text-ink backdrop:bg-[var(--scrim)] desk:m-auto desk:h-fit desk:max-h-[calc(100dvh-48px)] desk:rounded-3xl desk:border desk:border-line ${
        larga ? "desk:w-[min(980px,calc(100%-48px))]" : "desk:w-[min(600px,calc(100%-48px))]"
      }`}
    >
      {aberta && (
        <div data-inicio tabIndex={-1} className="relative outline-none px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] desk:px-7 desk:pt-6 desk:pb-7">
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="absolute top-[calc(0.6rem+env(safe-area-inset-top))] right-3 z-10 grid size-10 place-items-center rounded-full text-muted hover:bg-surface2 hover:text-ink desk:top-4 desk:right-4"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
          {children}
        </div>
      )}
    </dialog>
  );
}
