"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { FluxoDeRegistro } from "./telas/registrar";

const AbrirRegistro = createContext<() => void>(() => {});

/** Abre o registro de compra por cima da tela atual, de qualquer lugar do app. */
export const useAbrirRegistro = () => useContext(AbrirRegistro);

/**
 * Registrar compra sem sair de onde está: no desktop, uma janela no meio da
 * tela; no celular, ocupa a tela por cima e, ao terminar, volta para onde a
 * pessoa estava. Usa <dialog> nativo: Esc fecha, o foco fica dentro e o resto
 * da página não responde enquanto está aberto.
 */
export function ComRegistro({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  /** Cada abertura começa o fluxo do zero. */
  const [vez, setVez] = useState(0);
  const janela = useRef<HTMLDialogElement>(null);

  const abrir = useCallback(() => {
    setVez((v) => v + 1);
    setAberto(true);
  }, []);
  const fechar = useCallback(() => setAberto(false), []);

  useEffect(() => {
    const d = janela.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <AbrirRegistro.Provider value={abrir}>
      {children}
      <dialog
        ref={janela}
        aria-label="Registrar compra"
        onClose={fechar}
        // Clique no fundo escurecido (fora do conteúdo) fecha, como no protótipo.
        onClick={(e) => e.target === e.currentTarget && fechar()}
        className="janela-de-registro m-0 h-dvh max-h-none w-full max-w-none overflow-auto border-0 bg-bg p-0 text-ink backdrop:bg-[var(--scrim)] desk:m-auto desk:h-fit desk:max-h-[calc(100dvh-48px)] desk:w-[min(600px,calc(100%-48px))] desk:rounded-3xl desk:border desk:border-line"
      >
        {aberto && (
          <div className="px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] desk:px-8 desk:pt-6 desk:pb-8">
            <FluxoDeRegistro key={vez} fechar={fechar} />
          </div>
        )}
      </dialog>
    </AbrirRegistro.Provider>
  );
}
