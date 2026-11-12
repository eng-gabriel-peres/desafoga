"use client";

import { type FormEvent, Fragment, useEffect, useRef, useState } from "react";
import { BOAS_VINDAS } from "@/lib/conversa/textos";

interface Mensagem {
  id: number;
  autor: "bot" | "voce";
  texto: string;
}

const ATALHOS_INICIO = ["Ana", "Carlos", "Marina"];
const ATALHOS_PERSONA = ["E se eu pagar 200 a mais?", "Trocar"];

export function Chat() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    { id: 0, autor: "bot", texto: BOAS_VINDAS },
  ]);
  const [persona, setPersona] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const proximoId = useRef(1);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens]);

  function acrescentar(autor: Mensagem["autor"], textos: string[]) {
    const novas = textos.map((texto) => ({ id: proximoId.current++, autor, texto }));
    setMensagens((atuais) => [...atuais, ...novas]);
  }

  async function enviar(texto: string) {
    const limpo = texto.trim();
    if (!limpo || enviando) return;
    acrescentar("voce", [limpo]);
    setRascunho("");
    setEnviando(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: limpo, persona }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const dados: { mensagens: string[]; persona: string | null } = await r.json();
      setPersona(dados.persona);
      acrescentar("bot", dados.mensagens);
    } catch {
      acrescentar("bot", ["Não consegui responder agora. Envie a mensagem de novo."]);
    } finally {
      setEnviando(false);
    }
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    void enviar(rascunho);
  }

  const atalhos = persona ? ATALHOS_PERSONA : ATALHOS_INICIO;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold leading-tight">Desafoga</h1>
          <p className="text-sm text-muted">Quanto de juros você paga, e como parar.</p>
        </div>
        <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          Dados fictícios
        </span>
      </header>

      <ol className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {mensagens.map((m) => (
          <li
            key={m.id}
            className={
              m.autor === "voce"
                ? "max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent px-4 py-2 text-on-accent"
                : "max-w-[85%] self-start whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-surface px-4 py-2"
            }
          >
            <Formatado texto={m.texto} />
          </li>
        ))}
        {enviando && <li className="self-start px-1 text-sm text-muted">Calculando…</li>}
        <div ref={fim} />
      </ol>

      <div className="flex flex-wrap gap-2 px-4 pb-2">
        {atalhos.map((a) => (
          <button
            key={a}
            type="button"
            disabled={enviando}
            onClick={() => void enviar(a)}
            className="rounded-full border border-line px-3 py-1 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {a}
          </button>
        ))}
      </div>

      <form onSubmit={aoEnviar} className="flex gap-2 border-t border-line px-4 py-3">
        <label htmlFor="mensagem" className="sr-only">
          Mensagem
        </label>
        <input
          id="mensagem"
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          maxLength={1000}
          autoComplete="off"
          placeholder={persona ? "Quanto dá para pagar por mês?" : "Escreva Ana, Carlos ou Marina"}
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={enviando || rascunho.trim() === ""}
          className="rounded-full bg-accent px-5 py-2 font-medium text-on-accent disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

/** Mostra *negrito* e _itálico_ do jeito que o WhatsApp mostraria. */
function Formatado({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return (
    <>
      {partes.map((parte, i) => {
        if (parte.length > 2 && parte.startsWith("*") && parte.endsWith("*")) {
          return <strong key={i}>{parte.slice(1, -1)}</strong>;
        }
        if (parte.length > 2 && parte.startsWith("_") && parte.endsWith("_")) {
          return (
            <em key={i} className="text-sm text-muted">
              {parte.slice(1, -1)}
            </em>
          );
        }
        return <Fragment key={i}>{parte}</Fragment>;
      })}
    </>
  );
}
