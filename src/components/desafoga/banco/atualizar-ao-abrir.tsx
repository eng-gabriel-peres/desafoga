"use client";

import { useEffect } from "react";
import { servicos } from "@/services";

const UMA_HORA = 60 * 60 * 1000;
const CHAVE = "desafoga:bancos-atualizados";

/**
 * Ao abrir o app, pede dados novos aos bancos conectados (uma vez por sessão
 * do navegador, e só se a última leitura passou de uma hora). Sem tela.
 */
export function AtualizarBancosAoAbrir({ pessoaId }: { pessoaId: string }) {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(CHAVE)) return;
      sessionStorage.setItem(CHAVE, "1");
    } catch {
      // Sem sessionStorage (janela privada): atualiza mesmo assim.
    }
    servicos.banco
      .listar(pessoaId)
      .then(async (dados) => {
        const agora = Date.now();
        for (const c of dados.conexoes) {
          const ultima = c.ultimaSincronizacao ? Date.parse(c.ultimaSincronizacao) : 0;
          if (c.pluggyItemId && c.status !== "reconectar" && agora - ultima > UMA_HORA) await servicos.banco.atualizar(pessoaId, c.id);
        }
      })
      .catch(() => {
        // Falha ao atualizar não atrapalha o app: o botão "Atualizar" continua lá.
      });
  }, [pessoaId]);
  return null;
}
