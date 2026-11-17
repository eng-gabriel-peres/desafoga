"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { servicos, type ResultadoDaSincronizacao } from "@/services";

/** A janela da Pluggy usa iframes e só existe no navegador. */
const PluggyConnect = dynamic(() => import("react-pluggy-connect").then((m) => m.PluggyConnect), { ssr: false });

/**
 * Abre a janela da Pluggy: a pessoa escolhe o banco e entra com o login dele
 * (o Desafoga nunca vê a senha). `itemId` reabre para reconectar um banco.
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
  const [token, setToken] = useState<{ token: string; incluirSandbox: boolean } | null>(null);

  useEffect(() => {
    let ativo = true;
    servicos.banco.tokenDeConexao(pessoaId, itemId).then(
      (t) => ativo && setToken(t),
      (e: unknown) => ativo && aoFalhar(e instanceof Error ? e.message : "Não consegui abrir a conexão com o banco."),
    );
    return () => {
      ativo = false;
    };
    // O token vale 30 minutos: um por abertura da janela.
  }, [pessoaId, itemId, aoFalhar]);

  if (!token) return null;
  // No body: painéis com animação (transform) prenderiam a janela, que é position: fixed.
  return createPortal(
    <PluggyConnect
      key={token.token}
      connectToken={token.token}
      includeSandbox={token.incluirSandbox}
      updateItem={itemId}
      language="pt"
      onSuccess={async ({ item }) => {
        aoLer();
        try {
          aoConectar(await servicos.banco.conectado(pessoaId, item.id));
        } catch (e) {
          aoFalhar(e instanceof Error ? e.message : "Conectei, mas não consegui ler o banco agora.");
        }
      }}
      onError={({ message }) => aoFalhar(message || "O banco recusou a conexão.")}
      onClose={fechar}
      onLoadError={() => aoFalhar("Não consegui abrir a janela da Pluggy. Confira a internet e tente de novo.")}
    />,
    document.body,
  );
}
