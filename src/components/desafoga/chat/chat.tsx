"use client";

import { ArrowLeft, Mic, Plus, Send, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { chaveDoDia } from "@/lib/finance";
import { hora, nomeDoDia } from "@/lib/formatar";
import type { Mensagem, RespostaRapida } from "@/services";
import { Simbolo } from "../marca";
import { Carinha } from "../ui/carinha";
import { MenuDeComandos, type Comando } from "./comandos";
import { useGravador } from "./use-gravador";

const TIPOS_ACEITOS = "application/pdf,image/jpeg,image/png,image/webp";

/** Avatar da Luana: o símbolo do Desafoga. */
export function AvatarLuana({ tamanho = "md" }: { tamanho?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      // Ícone de chat do manual da marca: o símbolo branco e dourado sobre o azul da marca, nos dois temas.
      className={`grid shrink-0 place-items-center rounded-full bg-[#2350c8] ${tamanho === "sm" ? "size-8" : "size-[42px]"}`}
    >
      <Simbolo linha="#ffffff" className="size-[78%] translate-x-[-4%]" />
    </span>
  );
}

export function Digitando({ rotulo = "Luana está digitando" }: { rotulo?: string }) {
  return (
    <span className="digitando inline-flex gap-1 py-1" role="status" aria-label={rotulo}>
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
      className={`max-w-[85%] rounded-2xl px-3 pt-2 pb-1.5 text-[0.98rem] break-words whitespace-pre-wrap shadow-[0_1px_0_rgb(0_0_0/0.08)] desk:max-w-[min(70%,640px)] ${
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

function Separador({ texto }: { texto: string }) {
  return (
    <li aria-hidden="true" className="my-1 self-center rounded-lg bg-surface px-3 py-1 text-[0.78rem] font-bold text-muted shadow-[0_1px_0_rgb(0_0_0/0.06)]">
      {texto}
    </li>
  );
}

export type Ocupada = false | "digitando" | "lendo" | "ouvindo";

interface ChatProps {
  mensagens: Mensagem[];
  /** O que aparece enquanto a Luana responde: digitando, lendo um arquivo ou ouvindo um áudio. */
  ocupada: Ocupada;
  enviar: (texto: string) => void;
  enviarArquivo: (arquivo: File) => void;
  enviarAudio: (audio: Blob) => void;
  aviso: (texto: string) => void;
  cabecalho?: React.ReactNode;
  /** No celular a conversa ocupa a tela toda, sem o menu do app: este é o caminho de volta. */
  voltarPara?: string;
}

/** Conversa no estilo do WhatsApp, ocupando a tela: bolhas, comandos, anexo e áudio. */
export function Chat({ mensagens, ocupada, enviar, enviarArquivo, enviarAudio, aviso, cabecalho, voltarPara }: ChatProps) {
  const [rascunho, setRascunho] = useState("");
  const [comandos, setComandos] = useState(false);
  const lista = useRef<HTMLOListElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const idDoMenu = useId();
  const agora = useAgora();
  const gravador = useGravador(enviarAudio, aviso);
  const ultima = mensagens.at(-1);
  const ultimaDaLuana = [...mensagens].reverse().find((m) => m.de === "assistente");

  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensagens.length, ocupada]);

  // A caixa cresce para baixo com o texto, como no WhatsApp; depois de umas linhas ela rola por dentro.
  useLayoutEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [rascunho]);

  /** Enter envia; Shift+Enter quebra a linha. */
  function aoTeclar(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  }

  function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = rascunho.trim();
    if (!texto || ocupada) return;
    enviar(texto);
    setRascunho("");
  }

  function escolherComando(c: Comando) {
    setComandos(false);
    if (c.acao.tipo === "arquivo") return seletor.current?.click();
    if (c.acao.tipo === "enviar") return ocupada ? undefined : enviar(c.acao.texto);
    setRascunho(c.acao.texto);
    requestAnimationFrame(() => campo.current?.focus());
  }

  const segundos = gravador.segundos;
  const tempo = segundos === null ? "" : `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
  const status = ocupada === "lendo" ? "lendo o arquivo…" : ocupada === "ouvindo" ? "ouvindo o áudio…" : ocupada ? "digitando…" : "online";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-chat-bg">
      <div className="flex items-center gap-2.5 border-b border-line bg-surface py-2 pr-3 pl-1.5 pt-[calc(0.5rem+env(safe-area-inset-top))] desk:gap-3 desk:px-3.5 desk:py-2.5">
        {voltarPara && (
          <Link
            href={voltarPara}
            aria-label="Voltar para o início"
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink no-underline hover:bg-surface2 desk:hidden"
          >
            <ArrowLeft aria-hidden="true" className="size-6" />
          </Link>
        )}
        <AvatarLuana />
        <div className="min-w-0">
          <b className="block leading-tight">Luana</b>
          <span className={`text-[0.85rem] ${ocupada ? "text-primary" : "text-muted"}`}>{status}</span>
        </div>
        {cabecalho && <div className="ml-auto">{cabecalho}</div>}
      </div>

      <ol ref={lista} aria-label="Conversa com a Luana" className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-4 desk:px-6">
        {mensagens.map((m, i) => {
          const dia = chaveDoDia(new Date(m.quando));
          const novoDia = i === 0 || chaveDoDia(new Date(mensagens[i - 1].quando)) !== dia;
          return (
            <Fragment key={m.id}>
              {novoDia && agora && <Separador texto={nomeDoDia(dia, agora)} />}
              <Bolha mensagem={m} />
            </Fragment>
          );
        })}
        {ocupada && (
          <li className="self-start rounded-2xl rounded-tl-[4px] bg-chat-bot px-3 py-2">
            <Digitando rotulo={`Luana está ${status}`} />
          </li>
        )}
        {!ocupada && ultima?.de === "assistente" && ultima.respostasRapidas && (
          <BotoesRapidos respostas={ultima.respostasRapidas} escolher={enviar} />
        )}
      </ol>
      {/* Leitores de tela ouvem só a resposta nova. */}
      <p className="sr-only" aria-live="polite">
        {!ocupada && ultimaDaLuana ? `Luana: ${ultimaDaLuana.texto}` : ""}
      </p>

      <form onSubmit={aoEnviar} className="relative flex items-end gap-2 px-2.5 pt-1 pb-[calc(0.625rem+env(safe-area-inset-bottom))] desk:px-4 desk:pb-4">
        {comandos && <MenuDeComandos id={idDoMenu} fechar={() => setComandos(false)} escolher={escolherComando} />}
        <button
          type="button"
          data-abre-comandos
          onClick={() => setComandos((a) => !a)}
          aria-label="Enviar arquivo ou ver atalhos"
          aria-expanded={comandos}
          aria-controls={idDoMenu}
          className="group grid size-12 shrink-0 place-items-center rounded-full bg-surface text-primary shadow-[0_1px_2px_rgb(0_0_0/0.12)] hover:bg-primary-soft aria-expanded:bg-primary aria-expanded:text-primary-ink"
        >
          <Plus aria-hidden="true" className="size-6 transition-transform group-aria-expanded:rotate-45" />
        </button>

        {segundos !== null ? (
          <div role="status" className="flex min-h-12 flex-1 items-center gap-3 rounded-full bg-surface px-4 shadow-[0_1px_2px_rgb(0_0_0/0.12)]">
            <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-bad" />
            <span className="flex-1 font-bold">Gravando {tempo}</span>
            <button type="button" onClick={() => gravador.parar(true)} aria-label="Descartar áudio" className="grid size-11 place-items-center rounded-full text-muted hover:text-bad">
              <Trash2 aria-hidden="true" className="size-5" />
            </button>
          </div>
        ) : (
          <div className="flex min-h-12 min-w-0 flex-1 items-end caixa-de-campo rounded-3xl border-2 border-transparent bg-surface px-4 shadow-[0_1px_2px_rgb(0_0_0/0.12)] focus-within:border-primary">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Mensagem</span>
              <textarea
                ref={campo}
                rows={1}
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                onKeyDown={aoTeclar}
                placeholder="Mensagem"
                autoComplete="off"
                enterKeyHint="send"
                className="block max-h-36 w-full resize-none border-0 bg-transparent py-[11px] leading-snug break-words outline-none"
              />
            </label>
          </div>
        )}
        <input
          ref={seletor}
          type="file"
          accept={TIPOS_ACEITOS}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            e.target.value = "";
            if (arquivo) enviarArquivo(arquivo);
          }}
        />

        {segundos !== null ? (
          <button type="button" onClick={() => gravador.parar()} aria-label="Parar e enviar áudio" className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-ink">
            <Square aria-hidden="true" className="size-4 fill-current" />
          </button>
        ) : rascunho.trim() ? (
          <button type="submit" aria-label="Enviar" disabled={!!ocupada} className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-ink disabled:opacity-60">
            <Send aria-hidden="true" className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => gravador.comecar()}
            disabled={!!ocupada}
            aria-label="Gravar mensagem de voz"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-ink disabled:opacity-60"
          >
            <Mic aria-hidden="true" className="size-5" />
          </button>
        )}
      </form>
    </div>
  );
}
