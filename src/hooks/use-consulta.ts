"use client";

import { useEffect, useRef, useState } from "react";
import { servicos } from "@/services";

/**
 * Busca dados na camada de serviço e busca de novo quando algo muda.
 * Devolve `undefined` enquanto carrega. `chave` identifica a consulta: quando
 * ela muda (outra pessoa, por exemplo), a busca é refeita.
 */
export function useConsulta<T>(chave: string, buscar: () => Promise<T>): T | undefined {
  const [resultado, setResultado] = useState<{ chave: string; dados: T } | null>(null);
  const buscarAtual = useRef(buscar);

  useEffect(() => {
    buscarAtual.current = buscar;
  });

  useEffect(() => {
    let ativa = true;
    const carregar = () =>
      buscarAtual.current().then(
        (dados) => {
          if (ativa) setResultado({ chave, dados });
        },
        // Falha numa recarga (rede, servidor): mantém o que já estava na tela.
        (erro: unknown) => console.warn(`Consulta "${chave}" falhou:`, erro instanceof Error ? erro.message : erro),
      );
    carregar();
    const parar = servicos.aoMudar(carregar);
    return () => {
      ativa = false;
      parar();
    };
  }, [chave]);

  return resultado?.chave === chave ? resultado.dados : undefined;
}
