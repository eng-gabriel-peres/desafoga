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
const FATURA_DE_EXEMPLO = "/exemplos/fatura-ana.pdf";
const TIPOS_ACEITOS = "application/pdf,image/jpeg,image/png,image/webp";

interface RespostaDoServidor {
  mensagens: string[];
  persona: string | null;
  analise: unknown;
}

export function Chat() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    { id: 0, autor: "bot", texto: BOAS_VINDAS },
  ]);
  const [persona, setPersona] = useState<string | null>(null);
  // Resultado da fatura lida; fica só no navegador e volta ao servidor a cada mensagem.
  const [analise, setAnalise] = useState<unknown>(null);
  const seletor = useRef<HTMLInputElement>(null);
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
        body: JSON.stringify({ texto: limpo, persona, analise }),
      });
      if (!r.ok) throw new Error(String(r.status));
      receber(await r.json());
    } catch {
      acrescentar("bot", ["Não consegui responder agora. Envie a mensagem de novo."]);
    } finally {
      setEnviando(false);
    }
  }

  function receber(dados: RespostaDoServidor) {
    setPersona(dados.persona);
    setAnalise(dados.analise);
    acrescentar("bot", dados.mensagens);
  }

  async function enviarFatura(arquivo: Blob, nome: string) {
    if (enviando) return;
    acrescentar("voce", [`📎 ${nome}`]);
    setEnviando(true);
    try {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo, nome);
      const r = await fetch("/api/fatura", { method: "POST", body: corpo });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro ?? String(r.status));
      // Se a leitura falhou, mantém o contexto que já existia.
      if (dados.analise) receber(dados);
      else acrescentar("bot", dados.mensagens);
    } catch (erro) {
      const motivo = erro instanceof Error && erro.message ? ` (${erro.message})` : "";
      acrescentar("bot", [`Não consegui receber o arquivo${motivo}. Tente de novo.`]);
    } finally {
      setEnviando(false);
      if (seletor.current) seletor.current.value = "";
    }
  }

  async function enviarExemplo() {
    const r = await fetch(FATURA_DE_EXEMPLO);
    await enviarFatura(await r.blob(), "fatura-ficticia-ana.pdf");
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    void enviar(rascunho);
  }

  const atalhos = persona || analise ? ATALHOS_PERSONA : ATALHOS_INICIO;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold leading-tight">Desafoga</h1>
          <p className="text-sm text-muted">Quanto de juros você paga, e como parar.</p>
        </div>
        <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          Demonstração
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
        {enviando && <li className="self-start px-1 text-sm text-muted">Um instante…</li>}
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
        {!persona && !analise && (
          <button
            type="button"
            disabled={enviando}
            onClick={() => void enviarExemplo()}
            className="rounded-full border border-line px-3 py-1 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Ler fatura de exemplo
          </button>
        )}
      </div>

      <form onSubmit={aoEnviar} className="flex gap-2 border-t border-line px-4 py-3">
        <input
          ref={seletor}
          id="arquivo"
          type="file"
          accept={TIPOS_ACEITOS}
          className="sr-only"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void enviarFatura(arquivo, arquivo.name);
          }}
        />
        <label
          htmlFor="arquivo"
          title="Enviar fatura em PDF ou foto"
          className="flex shrink-0 cursor-pointer items-center rounded-full border border-line px-4 py-2 text-sm hover:border-accent hover:text-accent has-[:focus-visible]:border-accent"
        >
          Fatura
        </label>
        <label htmlFor="mensagem" className="sr-only">
          Mensagem
        </label>
        <input
          id="mensagem"
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          maxLength={1000}
          autoComplete="off"
          placeholder={persona || analise ? "Quanto dá para pagar por mês?" : "Escreva Ana, Carlos ou Marina"}
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
      <p className="px-4 pb-3 text-xs text-muted">
        A fatura enviada é lida por um modelo de IA e não fica guardada. Para testar, prefira a
        fatura de exemplo ou cubra seus dados pessoais.
      </p>
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
