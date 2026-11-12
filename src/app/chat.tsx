"use client";

import { type FormEvent, Fragment, useEffect, useRef, useState } from "react";
import { BOAS_VINDAS } from "@/lib/luana/textos";

interface Mensagem {
  id: number;
  autor: "luana" | "voce";
  texto: string;
}

const ATALHOS = ["Quanto gastei hoje?", "Onde posso economizar?", "Quanto devo guardar por mês?"];
const FATURA_DE_EXEMPLO = "/exemplos/fatura-ana.pdf";
const TIPOS_ACEITOS = "application/pdf,image/jpeg,image/png,image/webp";
const CHAVE_DO_USUARIO = "luana-usuario";

let sessaoSemArmazenamento: string | undefined;

/** Identificador do visitante; separa os gastos de cada navegador. */
function usuario(): string {
  try {
    let id = localStorage.getItem(CHAVE_DO_USUARIO);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CHAVE_DO_USUARIO, id);
    }
    return id;
  } catch {
    // Sem armazenamento (aba privada): vale só até recarregar a página.
    return (sessaoSemArmazenamento ??= crypto.randomUUID());
  }
}

export function Chat() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    { id: 0, autor: "luana", texto: BOAS_VINDAS },
  ]);
  const [rascunho, setRascunho] = useState("");
  const [ocupada, setOcupada] = useState<false | "lendo" | "pensando">(false);
  const fim = useRef<HTMLDivElement>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const proximoId = useRef(1);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, ocupada]);

  function acrescentar(autor: Mensagem["autor"], textos: string[]) {
    const novas = textos.map((texto) => ({ id: proximoId.current++, autor, texto }));
    setMensagens((atuais) => [...atuais, ...novas]);
  }

  async function pedir(estado: "lendo" | "pensando", requisicao: () => Promise<Response>) {
    setOcupada(estado);
    try {
      const r = await requisicao();
      const dados: { mensagens?: string[]; erro?: string } = await r.json();
      if (!r.ok || !dados.mensagens) throw new Error(dados.erro ?? String(r.status));
      acrescentar("luana", dados.mensagens);
    } catch (erro) {
      const motivo = erro instanceof Error && erro.message ? ` (${erro.message})` : "";
      acrescentar("luana", [`Não consegui responder agora${motivo}. Tente de novo.`]);
    } finally {
      setOcupada(false);
    }
  }

  async function enviar(texto: string) {
    const limpo = texto.trim();
    if (!limpo || ocupada) return;
    acrescentar("voce", [limpo]);
    setRascunho("");
    await pedir("pensando", () =>
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: limpo, usuario: usuario() }),
      }),
    );
  }

  async function enviarArquivo(arquivo: Blob, nome: string) {
    if (ocupada) return;
    acrescentar("voce", [`📎 ${nome}`]);
    const corpo = new FormData();
    corpo.append("arquivo", arquivo, nome);
    corpo.append("usuario", usuario());
    await pedir("lendo", () => fetch("/api/fatura", { method: "POST", body: corpo }));
    if (seletor.current) seletor.current.value = "";
  }

  async function enviarExemplo() {
    const r = await fetch(FATURA_DE_EXEMPLO);
    await enviarArquivo(await r.blob(), "fatura-de-exemplo.pdf");
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    void enviar(rascunho);
  }

  const chip =
    "rounded-full border border-line px-3 py-1 text-sm hover:border-accent hover:text-accent disabled:opacity-50";

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-on-accent"
        >
          L
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight">Luana</h1>
          <p className="text-sm text-muted">Seus gastos organizados na conversa.</p>
        </div>
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
            {m.autor === "luana" ? <Formatado texto={m.texto} /> : m.texto}
          </li>
        ))}
        {ocupada && (
          <li className="self-start px-1 text-sm text-muted">
            {ocupada === "lendo" ? "Luana está lendo o arquivo…" : "Luana está escrevendo…"}
          </li>
        )}
        <div ref={fim} />
      </ol>

      <div className="flex flex-wrap gap-2 px-4 pb-2">
        <button type="button" disabled={!!ocupada} onClick={() => void enviarExemplo()} className={chip}>
          Ler fatura de exemplo
        </button>
        {ATALHOS.map((a) => (
          <button key={a} type="button" disabled={!!ocupada} onClick={() => void enviar(a)} className={chip}>
            {a}
          </button>
        ))}
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
            if (arquivo) void enviarArquivo(arquivo, arquivo.name);
          }}
        />
        <label
          htmlFor="arquivo"
          title="Enviar fatura ou print das compras"
          className="flex shrink-0 cursor-pointer items-center rounded-full border border-line px-4 py-2 text-sm hover:border-accent hover:text-accent"
        >
          📎 Anexar
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
          placeholder="Ex.: almoço 35, ou uma pergunta"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!!ocupada || rascunho.trim() === ""}
          className="rounded-full bg-accent px-5 py-2 font-medium text-on-accent disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
      <p className="px-4 pb-3 text-xs text-muted">
        O arquivo enviado é lido por um modelo de IA do Google e não fica guardado; os gastos lidos
        ficam. Escreva <em>apagar tudo</em> para remover.
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
          return <em key={i}>{parte.slice(1, -1)}</em>;
        }
        return <Fragment key={i}>{parte}</Fragment>;
      })}
    </>
  );
}
