"use client";

import { useEffect, useRef } from "react";
import { servicos, type ResultadoDaSincronizacao } from "@/services";

/**
 * Abre a janela da Pluggy: a pessoa escolhe o banco e entra com o login dele
 * (o Desafoga nunca vê a senha). `itemId` reabre para reconectar um banco.
 *
 * Usa o SDK da Pluggy direto (e não o componente React) para abrir uma
 * janela só: o modo de desenvolvimento do React monta os componentes duas
 * vezes, e o componente deles não fecha a primeira.
 */
export function JanelaDaPluggy({
  pessoaId,
  itemId,
  aoLer,
  aoConectar,
  aoFalhar,
  fechar,
}: {
  pessoaId: string;
  itemId?: string;
  /** A pessoa terminou na janela; o Desafoga começa a ler o banco. */
  aoLer: () => void;
  aoConectar: (r: ResultadoDaSincronizacao) => void;
  aoFalhar: (mensagem: string) => void;
  fechar: () => void;
}) {
  // As funções mudam a cada render; a janela usa sempre as mais novas sem reabrir.
  const avisos = useRef({ aoLer, aoConectar, aoFalhar, fechar });
  useEffect(() => {
    avisos.current = { aoLer, aoConectar, aoFalhar, fechar };
  });

  useEffect(() => {
    let cancelada = false;
    let janela: { destroy(): Promise<void> } | null = null;
    (async () => {
      try {
        const [{ token, incluirSandbox }, { PluggyConnect }] = await Promise.all([
          servicos.banco.tokenDeConexao(pessoaId, itemId),
          import("pluggy-connect-sdk"),
        ]);
        if (cancelada) return;
        const pluggy = new PluggyConnect({
          connectToken: token,
          includeSandbox: incluirSandbox,
          updateItem: itemId,
          language: "pt",
          onSuccess: async ({ item }) => {
            avisos.current.aoLer();
            try {
              avisos.current.aoConectar(await servicos.banco.conectado(pessoaId, item.id));
            } catch (e) {
              avisos.current.aoFalhar(e instanceof Error ? e.message : "Conectei, mas não consegui ler o banco agora.");
            }
          },
          onError: ({ message }) => avisos.current.aoFalhar(message || "O banco recusou a conexão."),
          onClose: () => avisos.current.fechar(),
        });
        janela = pluggy;
        await pluggy.init();
      } catch (e) {
        if (!cancelada) avisos.current.aoFalhar(e instanceof Error ? e.message : "Não consegui abrir a conexão com o banco.");
      }
    })();
    return () => {
      cancelada = true;
      janela?.destroy().catch(() => undefined);
    };
  }, [pessoaId, itemId]);

  return null;
}
