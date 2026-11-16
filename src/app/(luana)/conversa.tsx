"use client";

import dynamic from "next/dynamic";

/**
 * O chat só é montado no navegador: ele começa com a conversa guardada em
 * localStorage, que o servidor não conhece.
 */
const Chat = dynamic(() => import("./chat").then((m) => m.Chat), { ssr: false });

export function Conversa() {
  return <Chat />;
}
