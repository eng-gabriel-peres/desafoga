"use client";

import { Check, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useConsulta } from "@/hooks/use-consulta";
import { telefoneLegivel } from "@/lib/desafoga/telefone";
import { servicos } from "@/services";
import { Botao } from "../ui/botao";

/** Número do WhatsApp da Luana e código de entrada do sandbox da Twilio, quando configurados. */
const NUMERO_DA_LUANA = process.env.NEXT_PUBLIC_WHATSAPP_NUMERO ?? "";
const CODIGO_DE_ENTRADA = process.env.NEXT_PUBLIC_WHATSAPP_CODIGO ?? "";

/** Botão do cabeçalho do chat que mostra se o WhatsApp está conectado. */
export function BotaoWhatsapp({ pessoaId }: { pessoaId: string }) {
  const [aberto, setAberto] = useState(false);
  const numero = useConsulta(`whatsapp:${pessoaId}`, () => servicos.pessoas.whatsapp(pessoaId));
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface2 px-3 text-[0.85rem] font-bold hover:border-primary"
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        {numero ? "WhatsApp conectado" : "Conectar WhatsApp"}
        {numero && <Check aria-hidden="true" className="size-4 text-good" />}
      </button>
      {aberto && <DialogoWhatsapp pessoaId={pessoaId} atual={numero ?? null} fechar={() => setAberto(false)} />}
    </>
  );
}

function DialogoWhatsapp({ pessoaId, atual, fechar }: { pessoaId: string; atual: string | null; fechar: () => void }) {
  const [texto, setTexto] = useState(atual ? telefoneLegivel(atual) : "");
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    caixa.current?.querySelector("input")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [fechar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      setSalvo(await servicos.pessoas.conectarWhatsapp(pessoaId, texto));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui salvar o número.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-scrim p-4" onPointerDown={(e) => e.target === e.currentTarget && fechar()}>
      <div ref={caixa} role="dialog" aria-modal="true" aria-labelledby="titulo-whatsapp" className="w-full max-w-[460px] rounded-3xl border border-line bg-bg p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="titulo-whatsapp" className="text-[1.3rem] leading-tight font-bold">
            Conversar com a Luana pelo WhatsApp
          </h2>
          <button type="button" onClick={fechar} aria-label="Fechar" className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface2">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <p className="text-muted">
          O que você contar pelo WhatsApp (compras, faturas, áudios) entra aqui no app. As conversas são separadas: o WhatsApp tem a dele e o app tem a sua.
        </p>
        <form onSubmit={salvar} className="mt-4">
          <label className="block">
            <span className="mb-1.5 block font-bold">Seu número de WhatsApp</span>
            <input
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setSalvo(null);
              }}
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 99999-8888"
              aria-describedby="whatsapp-ajuda"
              className="min-h-12 w-full rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 outline-none focus:border-primary"
            />
          </label>
          <p id="whatsapp-ajuda" className="mt-1 text-[0.85rem] text-muted">
            Com DDD. No cadastro, este é o número que a pessoa informa.
          </p>
          {erro && (
            <p role="alert" className="mt-2 font-bold text-bad">
              {erro}
            </p>
          )}
          <div role="status" aria-live="polite">
            {salvo && <p className="mt-2 rounded-xl bg-good-soft px-3 py-2 font-bold text-good">Pronto: {telefoneLegivel(salvo)} está ligado à sua conta.</p>}
          </div>
          <Botao type="submit" bloco className="mt-4">
            {atual ? "Atualizar número" : "Conectar"}
          </Botao>
        </form>
        <div className="mt-5 rounded-2xl bg-surface p-4 text-[0.95rem]">
          <b className="block">Depois, no seu WhatsApp</b>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
            <li>Salve o número da Luana{NUMERO_DA_LUANA ? `: ${NUMERO_DA_LUANA}` : ""}.</li>
            {CODIGO_DE_ENTRADA && (
              <li>
                Mande <b>join {CODIGO_DE_ENTRADA}</b> uma vez, para liberar a conversa (é o sandbox da Twilio).
              </li>
            )}
            <li>Converse como aqui: “comprei pão 12”, um áudio ou a foto da fatura.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
