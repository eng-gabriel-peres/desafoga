"use client";

import { type FormEvent, Fragment, useEffect, useRef, useState } from "react";
import { BOAS_VINDAS } from "@/lib/luana/textos";

interface Mensagem {
  id: number;
  autor: "luana" | "voce";
  texto: string;
}

const ATALHOS = ["Quanto entrou e quanto saiu?", "Qual foi meu maior gasto?", "Quanto consigo guardar?"];
const EXEMPLOS = [
  { rotulo: "Ler fatura de exemplo", arquivo: "/exemplos/fatura-ana.pdf", nome: "fatura-de-exemplo.pdf" },
  { rotulo: "Ler extrato de exemplo", arquivo: "/exemplos/extrato-ana.pdf", nome: "extrato-de-exemplo.pdf" },
];
const TIPOS_ACEITOS = "application/pdf,image/jpeg,image/png,image/webp";
const CHAVE_DO_USUARIO = "luana-usuario";
const MAXIMO_DE_ARQUIVOS = 15;
const TAMANHO_MAXIMO = 4 * 1024 * 1024;
/** Duração máxima de uma mensagem de voz, em segundos. */
const MAXIMO_DE_AUDIO = 120;
const FORMATOS_DE_AUDIO = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

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
  const [progresso, setProgresso] = useState("");
  /** Segundos de gravação em andamento; null quando não está gravando. */
  const [gravando, setGravando] = useState<number | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
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

  /** Envia os arquivos um a um, em ordem; o resumo completo vem com o último. */
  async function enviarArquivos(arquivos: { arquivo: Blob; nome: string }[]) {
    if (ocupada || arquivos.length === 0) return;
    const aceitos = arquivos.slice(0, MAXIMO_DE_ARQUIVOS);
    if (arquivos.length > aceitos.length) {
      acrescentar("luana", [
        `Leio até ${MAXIMO_DE_ARQUIVOS} arquivos por vez. Vou ler os ${MAXIMO_DE_ARQUIVOS} primeiros; mande o resto em seguida.`,
      ]);
    }
    for (const [i, { arquivo, nome }] of aceitos.entries()) {
      acrescentar("voce", [`📎 ${nome}`]);
      if (arquivo.size > TAMANHO_MAXIMO) {
        acrescentar("luana", [`${nome} passa de 4 MB. Mande uma versão menor ou um print da tela.`]);
        continue;
      }
      const ultimo = i === aceitos.length - 1;
      setProgresso(aceitos.length > 1 ? ` (${i + 1} de ${aceitos.length})` : "");
      const corpo = new FormData();
      corpo.append("arquivo", arquivo, nome);
      corpo.append("usuario", usuario());
      if (!ultimo) corpo.append("resumo", "nao");
      await pedir("lendo", () => fetch("/api/fatura", { method: "POST", body: corpo }));
    }
    setProgresso("");
    if (seletor.current) seletor.current.value = "";
  }

  async function enviarAudio(audio: Blob) {
    setOcupada("lendo");
    try {
      const corpo = new FormData();
      corpo.append("audio", audio, "mensagem-de-voz");
      corpo.append("usuario", usuario());
      const r = await fetch("/api/audio", { method: "POST", body: corpo });
      const dados: { transcricao?: string; mensagens?: string[]; erro?: string } = await r.json();
      if (!r.ok || !dados.mensagens) throw new Error(dados.erro ?? String(r.status));
      acrescentar("voce", [dados.transcricao ? `🎤 ${dados.transcricao}` : "🎤 Mensagem de voz"]);
      acrescentar("luana", dados.mensagens);
    } catch (erro) {
      const motivo = erro instanceof Error && erro.message ? ` (${erro.message})` : "";
      acrescentar("voce", ["🎤 Mensagem de voz"]);
      acrescentar("luana", [`Não consegui ouvir agora${motivo}. Tente de novo.`]);
    } finally {
      setOcupada(false);
    }
  }

  function pararGravacao() {
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = null;
    if (gravador.current?.state === "recording") gravador.current.stop();
  }

  async function alternarGravacao() {
    if (gravando !== null) return pararGravacao();
    if (ocupada) return;
    let microfone: MediaStream;
    try {
      microfone = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      acrescentar("luana", ["Não consegui usar o microfone. Libere o acesso no navegador ou escreva a mensagem."]);
      return;
    }
    const formato = FORMATOS_DE_AUDIO.find((f) => MediaRecorder.isTypeSupported(f));
    const novo = new MediaRecorder(microfone, formato ? { mimeType: formato, audioBitsPerSecond: 32000 } : undefined);
    const pedacos: Blob[] = [];
    novo.ondataavailable = (e) => {
      if (e.data.size > 0) pedacos.push(e.data);
    };
    novo.onstop = () => {
      microfone.getTracks().forEach((t) => t.stop());
      gravador.current = null;
      setGravando(null);
      const audio = new Blob(pedacos, { type: (novo.mimeType || "audio/webm").split(";")[0] });
      if (audio.size > 0) void enviarAudio(audio);
    };
    gravador.current = novo;
    novo.start();
    setGravando(0);
    let segundos = 0;
    relogio.current = setInterval(() => {
      segundos += 1;
      setGravando(segundos);
      if (segundos >= MAXIMO_DE_AUDIO) pararGravacao();
    }, 1000);
  }

  async function enviarExemplo(exemplo: (typeof EXEMPLOS)[number]) {
    const r = await fetch(exemplo.arquivo);
    await enviarArquivos([{ arquivo: await r.blob(), nome: exemplo.nome }]);
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
            {ocupada === "lendo" ? `Luana está lendo o arquivo${progresso}…` : "Luana está escrevendo…"}
          </li>
        )}
        <div ref={fim} />
      </ol>

      <div className="flex flex-wrap gap-2 px-4 pb-2">
        {EXEMPLOS.map((e) => (
          <button
            key={e.arquivo}
            type="button"
            disabled={!!ocupada}
            onClick={() => void enviarExemplo(e)}
            className={chip}
          >
            {e.rotulo}
          </button>
        ))}
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
          multiple
          className="sr-only"
          onChange={(e) => {
            const escolhidos = Array.from(e.target.files ?? []);
            void enviarArquivos(escolhidos.map((arquivo) => ({ arquivo, nome: arquivo.name })));
          }}
        />
        <label
          htmlFor="arquivo"
          title="Enviar faturas, extratos ou prints (pode escolher vários de uma vez)"
          className="flex shrink-0 cursor-pointer items-center rounded-full border border-line px-4 py-2 text-sm hover:border-accent hover:text-accent"
        >
          📎 Anexar
        </label>
        <button
          type="button"
          onClick={() => void alternarGravacao()}
          disabled={!!ocupada && gravando === null}
          aria-pressed={gravando !== null}
          title={gravando === null ? "Gravar mensagem de voz" : "Parar e enviar"}
          className={
            gravando === null
              ? "flex shrink-0 items-center rounded-full border border-line px-4 py-2 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
              : "flex shrink-0 items-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent"
          }
        >
          {gravando === null
            ? "🎤 Áudio"
            : `⏹ Enviar ${Math.floor(gravando / 60)}:${String(gravando % 60).padStart(2, "0")}`}
        </button>
        <label htmlFor="mensagem" className="sr-only">
          Mensagem
        </label>
        <input
          id="mensagem"
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          maxLength={1000}
          autoComplete="off"
          placeholder="Ex.: almoço 35, ou posso comprar uma moto?"
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
        Arquivos e áudios enviados são lidos por um modelo de IA do Google e não ficam guardados; os
        gastos lidos ficam. Escreva <em>apagar tudo</em> para remover.
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
