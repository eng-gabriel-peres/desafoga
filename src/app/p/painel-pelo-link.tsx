"use client";

import dynamic from "next/dynamic";

/**
 * Painel aberto pelo link que a Luana manda no WhatsApp. Só é montado no
 * navegador: o código do link fica depois do #, que o servidor não recebe.
 */
const Conteudo = dynamic(() => import("./conteudo").then((m) => m.Conteudo), { ssr: false });

export function PainelPeloLink() {
  return <Conteudo />;
}
