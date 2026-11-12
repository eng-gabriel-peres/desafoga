"use client";

import { type FormEvent, Fragment, useEffect, useRef, useState } from "react";
import { BOAS_VINDAS } from "@/lib/luana/textos";
import {
  AvatarDaLuana,
  IconeClipe,
  IconeEnviar,
  IconeFechar,
  IconeLixeira,
  IconeLua,
  IconeMicrofone,
  IconePaleta,
  IconeSol,
} from "./icones";
import { Anexo, type AnexoDaMensagem } from "./anexo";
import { guardarArquivo } from "./arquivos-locais";
import { Painel } from "./painel";

interface Mensagem {
  id: number;
  autor: "luana" | "voce";
  texto: string;
  /** Arquivo enviado nesta mensagem, guardado no navegador. */
  anexo?: AnexoDaMensagem;
}

interface Anexo {
  arquivo: Blob;
  nome: string;
}

const TIPOS_ACEITOS = "application/pdf,image/jpeg,image/png,image/webp";
const CHAVE_DO_USUARIO = "luana-usuario";
const CHAVE_DA_CONVERSA = "luana-conversa";
/** Mensagens guardadas no navegador; as mais antigas saem. */
const MAXIMO_DE_MENSAGENS = 300;
const MAXIMO_DE_ARQUIVOS = 15;
const TAMANHO_MAXIMO = 4 * 1024 * 1024;
/** Duração máxima de uma mensagem de voz, em segundos. */
const MAXIMO_DE_AUDIO = 120;
const FORMATOS_DE_AUDIO = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const CHAVE_DO_TEMA = "luana-tema";
const CHAVE_DA_COR = "luana-cor";
/** Cores do chat; os tons de cada uma, por tema, ficam em globals.css. */
const CORES = [
  { id: "azul", nome: "Azul", amostra: "#3f9fcb" },
  { id: "roxo", nome: "Roxo", amostra: "#9370e0" },
  { id: "verde", nome: "Verde", amostra: "#3faa78" },
  { id: "amarelo", nome: "Amarelo", amostra: "#d4a514" },
  { id: "rosa", nome: "Rosa", amostra: "#dc5f98" },
  { id: "laranja", nome: "Laranja", amostra: "#e07a2c" },
];

function preferencia(chave: string, padrao: string): string {
  try {
    return localStorage.getItem(chave) ?? padrao;
  } catch {
    return padrao;
  }
}

/** Marca o <html> com a preferência e a guarda neste navegador. */
function aplicar(chave: string, atributo: "tema" | "cor", valor: string) {
  document.documentElement.dataset[atributo] = valor;
  try {
    localStorage.setItem(chave, valor);
  } catch {
    // Sem armazenamento: vale até recarregar a página.
  }
}

const INICIO: Mensagem[] = [{ id: 0, autor: "luana", texto: BOAS_VINDAS }];

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

/** Conversa guardada neste navegador, para não se perder ao atualizar a página. */
function conversaGuardada(): Mensagem[] {
  try {
    const bruto: unknown = JSON.parse(localStorage.getItem(CHAVE_DA_CONVERSA) ?? "null");
    if (!Array.isArray(bruto)) return INICIO;
    const validas = bruto.filter(
      (m): m is Mensagem =>
        typeof m?.id === "number" && typeof m?.texto === "string" && (m?.autor === "luana" || m?.autor === "voce"),
    );
    return validas.length > 0 ? validas : INICIO;
  } catch {
    return INICIO;
  }
}

const redondo = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50";

const duracao = (segundos: number) => `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;

export function Chat() {
  const [mensagens, setMensagens] = useState<Mensagem[]>(conversaGuardada);
  const [rascunho, setRascunho] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [ocupada, setOcupada] = useState<false | "lendo" | "pensando">(false);
  const [progresso, setProgresso] = useState("");
  /** Segundos de gravação em andamento; null quando não está gravando. */
  const [gravando, setGravando] = useState<number | null>(null);
  const [tema, setTema] = useState(() => preferencia(CHAVE_DO_TEMA, "escuro"));
  const [cor, setCor] = useState(() => preferencia(CHAVE_DA_COR, "azul"));
  const [escolhendoCor, setEscolhendoCor] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const gravador = useRef<MediaRecorder | null>(null);
  const descartar = useRef(false);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const proximoId = useRef(Math.max(...mensagens.map((m) => m.id)) + 1);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, ocupada]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_DA_CONVERSA, JSON.stringify(mensagens.slice(-MAXIMO_DE_MENSAGENS)));
    } catch {
      // Sem armazenamento ou sem espaço: a conversa segue só na tela.
    }
  }, [mensagens]);

  function acrescentar(autor: Mensagem["autor"], textos: string[]) {
    const novas = textos.map((texto) => ({ id: proximoId.current++, autor, texto }));
    setMensagens((atuais) => [...atuais, ...novas]);
  }

  /** Mostra o arquivo na conversa e o guarda neste navegador para abrir depois. */
  async function acrescentarArquivo(arquivo: Blob, nome: string) {
    const chave = crypto.randomUUID();
    const guardado = await guardarArquivo(chave, arquivo);
    const nova: Mensagem = {
      id: proximoId.current++,
      autor: "voce",
      texto: `📎 ${nome}`,
      ...(guardado ? { anexo: { chave, nome, tipo: arquivo.type } } : {}),
    };
    setMensagens((atuais) => [...atuais, nova]);
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

  async function enviarTexto(texto: string) {
    acrescentar("voce", [texto]);
    await pedir("pensando", () =>
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, usuario: usuario() }),
      }),
    );
  }

  /**
   * Envia os arquivos um a um, em ordem. Sem texto junto, o resumo completo vem
   * com o último; com texto, a resposta ao texto vem depois de todos lidos.
   */
  async function enviarArquivos(arquivos: Anexo[], comTexto: boolean) {
    for (const [i, { arquivo, nome }] of arquivos.entries()) {
      await acrescentarArquivo(arquivo, nome);
      if (arquivo.size > TAMANHO_MAXIMO) {
        acrescentar("luana", [`${nome} passa de 4 MB. Mande uma versão menor ou um print da tela.`]);
        continue;
      }
      const ultimo = i === arquivos.length - 1;
      setProgresso(arquivos.length > 1 ? ` (${i + 1} de ${arquivos.length})` : "");
      const corpo = new FormData();
      corpo.append("arquivo", arquivo, nome);
      corpo.append("usuario", usuario());
      if (!ultimo || comTexto) corpo.append("resumo", "nao");
      await pedir("lendo", () => fetch("/api/fatura", { method: "POST", body: corpo }));
    }
    setProgresso("");
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    const texto = rascunho.trim();
    if (ocupada || (!texto && anexos.length === 0)) return;
    const arquivos = anexos;
    setRascunho("");
    setAnexos([]);
    if (arquivos.length > 0) await enviarArquivos(arquivos, texto !== "");
    if (texto) await enviarTexto(texto);
  }

  function escolherArquivos(escolhidos: File[]) {
    if (seletor.current) seletor.current.value = "";
    if (escolhidos.length === 0) return;
    const todos = [...anexos, ...escolhidos.map((arquivo) => ({ arquivo, nome: arquivo.name }))];
    if (todos.length > MAXIMO_DE_ARQUIVOS) {
      acrescentar("luana", [`Leio até ${MAXIMO_DE_ARQUIVOS} arquivos por vez. Mande o resto em seguida.`]);
    }
    setAnexos(todos.slice(0, MAXIMO_DE_ARQUIVOS));
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

  function pararGravacao(jogarFora = false) {
    descartar.current = jogarFora;
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = null;
    if (gravador.current?.state === "recording") gravador.current.stop();
  }

  async function comecarGravacao() {
    if (ocupada || gravando !== null) return;
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
      if (!descartar.current && audio.size > 0) void enviarAudio(audio);
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

  function alternarTema() {
    const novo = tema === "claro" ? "escuro" : "claro";
    setTema(novo);
    aplicar(CHAVE_DO_TEMA, "tema", novo);
  }

  function escolherCor(id: string) {
    setCor(id);
    aplicar(CHAVE_DA_COR, "cor", id);
  }

  if (painelAberto) return <Painel usuario={usuario()} aoFechar={() => setPainelAberto(false)} />;

  const temOQueEnviar = rascunho.trim() !== "" || anexos.length > 0;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <header className="border-b border-line px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPainelAberto(true)}
            title="Abrir o resumo geral"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left hover:bg-accent-soft"
          >
            <AvatarDaLuana />
            <span className="min-w-0">
              <span className="block text-lg font-semibold leading-tight">Luana</span>
              <span className="block truncate text-sm text-muted">Toque para ver o resumo geral</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setEscolhendoCor((aberto) => !aberto)}
            aria-expanded={escolhendoCor}
            title="Cor do chat"
            aria-label="Cor do chat"
            className={`${redondo} text-muted hover:bg-accent-soft hover:text-accent`}
          >
            <IconePaleta />
          </button>
          <button
            type="button"
            onClick={alternarTema}
            title={tema === "claro" ? "Mudar para o tema escuro" : "Mudar para o tema claro"}
            aria-label={tema === "claro" ? "Mudar para o tema escuro" : "Mudar para o tema claro"}
            className={`${redondo} text-muted hover:bg-accent-soft hover:text-accent`}
          >
            {tema === "claro" ? <IconeLua /> : <IconeSol />}
          </button>
        </div>
        {escolhendoCor && (
          <div className="flex flex-wrap items-center gap-2 px-1 pb-1 pt-2" role="radiogroup" aria-label="Cor do chat">
            {CORES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={cor === c.id}
                onClick={() => escolherCor(c.id)}
                title={c.nome}
                aria-label={c.nome}
                className={`h-8 w-8 rounded-full border-2 ${cor === c.id ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: c.amostra }}
              />
            ))}
          </div>
        )}
      </header>

      <ol className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {mensagens.map((m) => (
          <li
            key={m.id}
            className={
              m.autor === "voce"
                ? "max-w-[85%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-accent px-4 py-2 text-on-accent"
                : "max-w-[85%] self-start whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm bg-surface px-4 py-2"
            }
          >
            {m.anexo ? <Anexo anexo={m.anexo} /> : m.autor === "luana" ? <Formatado texto={m.texto} /> : m.texto}
          </li>
        ))}
        {ocupada && (
          <li className="self-start px-1 text-sm text-muted">
            {ocupada === "lendo" ? `Luana está lendo${progresso}…` : "Luana está escrevendo…"}
          </li>
        )}
        <div ref={fim} />
      </ol>

      {anexos.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-4 pb-2" aria-label="Arquivos a enviar">
          {anexos.map((a, i) => (
            <li
              key={`${a.nome}-${i}`}
              className="flex max-w-full items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-sm"
            >
              <span className="truncate">{a.nome}</span>
              <button
                type="button"
                onClick={() => setAnexos((atuais) => atuais.filter((_, j) => j !== i))}
                aria-label={`Remover ${a.nome}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-line"
              >
                <IconeFechar />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(e) => void aoEnviar(e)} className="flex items-center gap-2 border-t border-line px-3 py-3">
        <input
          ref={seletor}
          id="arquivo"
          type="file"
          accept={TIPOS_ACEITOS}
          multiple
          className="sr-only"
          onChange={(e) => escolherArquivos(Array.from(e.target.files ?? []))}
        />
        {gravando === null ? (
          <>
            <label
              htmlFor="arquivo"
              title="Anexar faturas, extratos ou prints"
              aria-label="Anexar arquivos"
              className={`${redondo} cursor-pointer text-muted hover:bg-accent-soft hover:text-accent`}
            >
              <IconeClipe />
            </label>
            <input
              id="mensagem"
              aria-label="Mensagem"
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              maxLength={1000}
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 outline-none focus:border-accent"
            />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => pararGravacao(true)}
              title="Descartar gravação"
              aria-label="Descartar gravação"
              className={`${redondo} text-muted hover:bg-accent-soft hover:text-accent`}
            >
              <IconeLixeira />
            </button>
            <p className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4" role="status">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />
              Gravando {duracao(gravando)}
            </p>
          </>
        )}
        {gravando !== null ? (
          <button
            type="button"
            onClick={() => pararGravacao()}
            title="Enviar áudio"
            aria-label="Enviar áudio"
            className={`${redondo} bg-accent text-on-accent`}
          >
            <IconeEnviar />
          </button>
        ) : temOQueEnviar ? (
          <button
            type="submit"
            disabled={!!ocupada}
            title="Enviar"
            aria-label="Enviar"
            className={`${redondo} bg-accent text-on-accent`}
          >
            <IconeEnviar />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void comecarGravacao()}
            disabled={!!ocupada}
            title="Gravar mensagem de voz"
            aria-label="Gravar mensagem de voz"
            className={`${redondo} bg-accent text-on-accent`}
          >
            <IconeMicrofone />
          </button>
        )}
      </form>
      <p className="px-4 pb-3 text-xs text-muted">
        Arquivos e áudios são lidos por um modelo de IA do Google e não ficam guardados no servidor; os
        arquivos da conversa ficam só neste navegador, e os gastos lidos ficam. Escreva <em>apagar tudo</em> para remover.
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
