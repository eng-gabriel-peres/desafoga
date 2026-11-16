"use client";

import { useEffect, useState } from "react";
import { buscarArquivo } from "./arquivos-locais";
import { IconeArquivo } from "./icones";

export interface AnexoDaMensagem {
  /** Chave do arquivo guardado neste navegador. */
  chave: string;
  nome: string;
  /** Tipo do arquivo, ex.: image/png. */
  tipo: string;
}

/** Arquivo enviado na conversa: miniatura para imagem, cartão para PDF; abre ao clicar. */
export function Anexo({ anexo }: { anexo: AnexoDaMensagem }) {
  /** undefined enquanto carrega; null quando o arquivo não está mais guardado. */
  const [endereco, setEndereco] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    let criado: string | null = null;
    void buscarArquivo(anexo.chave).then((arquivo) => {
      if (!vivo) return;
      criado = arquivo ? URL.createObjectURL(arquivo) : null;
      setEndereco(criado);
    });
    return () => {
      vivo = false;
      if (criado) URL.revokeObjectURL(criado);
    };
  }, [anexo.chave]);

  if (!endereco) {
    return (
      <span className="flex items-center gap-2">
        <IconeArquivo />
        <span className="min-w-0 break-words">
          {anexo.nome}
          {endereco === null && <span className="block text-xs opacity-80">Não está mais guardado neste navegador.</span>}
        </span>
      </span>
    );
  }

  if (anexo.tipo.startsWith("image/")) {
    return (
      <a href={endereco} target="_blank" rel="noreferrer" title="Abrir imagem" className="block">
        {/* Endereço local (blob:), criado no navegador; não passa pelo otimizador de imagens. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={endereco} alt={anexo.nome} className="max-h-64 w-auto max-w-full rounded-lg" />
        <span className="mt-1 block break-words text-xs opacity-80">{anexo.nome}</span>
      </a>
    );
  }

  return (
    <a
      href={endereco}
      target="_blank"
      rel="noreferrer"
      title="Abrir arquivo"
      className="flex items-center gap-3 rounded-lg bg-black/10 px-3 py-2"
    >
      <IconeArquivo />
      <span className="min-w-0">
        <span className="block break-words font-medium">{anexo.nome}</span>
        <span className="block text-xs opacity-80">PDF · toque para abrir</span>
      </span>
    </a>
  );
}
