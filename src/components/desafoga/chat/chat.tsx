"use client";

import { Send } from "lucide-react";
import { useEffect, useRef } from "react";
import { hora } from "@/lib/formatar";
import type { Mensagem, RespostaRapida } from "@/services";
import { Carinha } from "../ui/carinha";

/** Avatar da Luana. */
export function AvatarLuana({ tamanho = "md" }: { tamanho?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-primary font-bold text-primary-ink ${tamanho === "sm" ? "size-8 text-[0.85rem]" : "size-[42px]"}`}
    >
      L
    </span>
  );
}

export function Digitando() {
  return (
    <span className="digitando inline-flex gap-1 py-1" role="status" aria-label="Luana está digitando">
      <i className="block size-2 rounded-full bg-muted" />
      <i className="block size-2 rounded-full bg-muted" />
      <i className="block size-2 rounded-full bg-muted" />
    </span>
  );
}

function Bolha({ mensagem }: { mensagem: Mensagem }) {
  const minha = mensagem.de === "pessoa";
  return (
    <li
      className={`max-w-[86%] rounded-2xl px-3 pt-2 pb-1.5 text-[0.98rem] break-words whitespace-pre-wrap shadow-[0_1px_0_rgb(0_0_0/0.06)] ${
        minha ? "self-end rounded-tr-[4px] bg-chat-me" : "self-start rounded-tl-[4px] bg-chat-bot"
      }`}
    >
      <span className="sr-only">{minha ? "Você: " : "Luana: "}</span>
      {mensagem.texto}
      <time dateTime={mensagem.quando} className="mt-0.5 block text-right text-[0.7rem] text-muted">
        {hora(mensagem.quando)}
      </time>
    </li>
  );
}

function BotoesRapidos({ respostas, escolher }: { respostas: RespostaRapida[]; escolher: (texto: string) => void }) {
  return (
    <li className="flex max-w-[96%] flex-wrap gap-1.5 self-start" aria-label="Respostas rápidas">
      {respostas.map((r) => (
        <button
          key={r.rotulo}
          type="button"
          onClick={() => escolher(r.rotulo)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-primary bg-surface px-3.5 font-bold text-primary hover:bg-primary-soft"
        >
          {r.emocao && <Carinha emocao={r.emocao} tamanho="xs" rotulo={false} />}
          {r.rotulo}
        </button>
      ))}
    </li>
  );
}

/** Conversa no estilo do WhatsApp: bolhas, respostas rápidas, digitando e campo de mensagem. */
export function Chat({
  mensagens,
  digitando,
  enviar,
  rascunho,
  setRascunho,
}: {
  mensagens: Mensagem[];
  digitando: boolean;
  enviar: (texto: string) => void;
  rascunho: string;
  setRascunho: (t: string) => void;
}) {
  const lista = useRef<HTMLOListElement>(null);
  const ultima = mensagens.at(-1);
  const ultimaDaLuana = [...mensagens].reverse().find((m) => m.de === "assistente");

  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensagens.length, digitando]);

  function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = rascunho.trim();
    if (!texto || digitando) return;
    enviar(texto);
    setRascunho("");
  }

  return (
    <div className="flex flex-col desk:rounded-[28px] desk:border desk:border-line desk:bg-surface desk:p-2.5">
      <div className="flex items-center gap-3 rounded-t-[18px] border border-b-0 border-line bg-surface px-3.5 py-3">
        <AvatarLuana />
        <div>
          <b className="block">Luana</b>
          <span className="text-[0.85rem] text-muted">Assistente do Desafoga · App e WhatsApp</span>
        </div>
      </div>
      <ol
        ref={lista}
        aria-label="Conversa com a Luana"
        className="flex h-[52dvh] min-h-72 flex-col gap-2 overflow-y-auto rounded-b-[18px] border border-t-0 border-line bg-chat-bg px-2.5 py-3.5 desk:h-[560px]"
      >
        {mensagens.map((m) => (
          <Bolha key={m.id} mensagem={m} />
        ))}
        {digitando && (
          <li className="self-start rounded-2xl rounded-tl-[4px] bg-chat-bot px-3 py-2">
            <Digitando />
          </li>
        )}
        {!digitando && ultima?.de === "assistente" && ultima.respostasRapidas && (
          <BotoesRapidos respostas={ultima.respostasRapidas} escolher={enviar} />
        )}
      </ol>
      {/* Leitores de tela ouvem só a resposta nova, não a conversa toda. */}
      <p className="sr-only" aria-live="polite">
        {!digitando && ultimaDaLuana ? `Luana: ${ultimaDaLuana.texto}` : ""}
      </p>
      <form onSubmit={aoEnviar} className="mt-3 flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Mensagem</span>
          <input
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            placeholder="Escreva uma mensagem"
            autoComplete="off"
            enterKeyHint="send"
            className="min-h-[3.2rem] w-full rounded-full border-2 border-line bg-surface px-4 outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          aria-label="Enviar"
          disabled={digitando}
          className="grid size-[3.2rem] shrink-0 place-items-center rounded-full bg-primary text-primary-ink disabled:opacity-60"
        >
          <Send aria-hidden="true" className="size-5" />
        </button>
      </form>
    </div>
  );
}
