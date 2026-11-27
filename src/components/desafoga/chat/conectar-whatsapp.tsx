"use client";

import { Check, MessageCircle, Unlink, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useConsulta } from "@/hooks/use-consulta";
import { normalizarTelefone, telefoneLegivel } from "@/lib/desafoga/telefone";
import { servicos } from "@/services";
import { Botao } from "../ui/botao";

/** Número do WhatsApp da Luana e código de entrada do sandbox da Twilio, quando configurados. */
const NUMERO_DA_LUANA = process.env.NEXT_PUBLIC_WHATSAPP_NUMERO ?? "";
const CODIGO_DE_ENTRADA = process.env.NEXT_PUBLIC_WHATSAPP_CODIGO ?? "";

/** Botão do cabeçalho do chat que mostra se o WhatsApp está conectado. */
/** `discreto`: menor e sem destaque, para o topo do app no chat do celular. */
export function BotaoWhatsapp({ pessoaId, discreto = false }: { pessoaId: string; discreto?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const numero = useConsulta(`whatsapp:${pessoaId}`, () => servicos.pessoas.whatsapp(pessoaId));
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        aria-label={numero ? "WhatsApp conectado. Trocar número" : "Conectar WhatsApp"}
        className={`inline-flex items-center rounded-full border border-line font-bold hover:border-primary ${
          discreto
            ? "min-h-10 shrink-0 gap-1.5 bg-surface2 px-3 text-[0.8rem] text-muted hover:text-ink desk:min-h-11 desk:text-[0.85rem] desk:text-ink"
            : "min-h-11 gap-2 bg-surface2 px-3 text-[0.85rem]"
        }`}
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        {numero || discreto ? (
          <span>
            {!numero && <span className="hidden desk:inline">Conectar </span>}WhatsApp
          </span>
        ) : (
          "Conectar WhatsApp"
        )}
        {numero && <Check aria-hidden="true" className="size-4 text-good" />}
      </button>
      {aberto && <DialogoWhatsapp pessoaId={pessoaId} atual={numero ?? null} fechar={() => setAberto(false)} />}
    </>
  );
}

type Etapa =
  | { tipo: "numero" }
  | { tipo: "conferir"; telefone: string }
  | { tipo: "codigo"; telefone: string; codigoDeTeste: string | null }
  | { tipo: "pronto"; telefone: string };

const CAMPO = "min-h-12 w-full rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 outline-none campo focus:border-primary";

/**
 * Conectar o WhatsApp: a pessoa informa o número, confere, a Luana manda um
 * código para esse WhatsApp e a pessoa digita o código aqui. Só quem tem o
 * celular na mão liga o número, e sempre à conta de quem pediu.
 */
function DialogoWhatsapp({ pessoaId, atual, fechar }: { pessoaId: string; atual: string | null; fechar: () => void }) {
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "numero" });
  const [numero, setNumero] = useState(atual ? telefoneLegivel(atual) : "");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [fechar]);

  useEffect(() => {
    caixa.current?.querySelector<HTMLElement>("input, [data-foco]")?.focus();
  }, [etapa.tipo]);

  function conferir(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const telefone = normalizarTelefone(numero);
    if (!telefone) return setErro("Número inválido. Use DDD e número, por exemplo (11) 99999-8888.");
    setEtapa({ tipo: "conferir", telefone });
  }

  async function enviarCodigo(telefone: string) {
    setErro("");
    setEnviando(true);
    try {
      const r = await servicos.pessoas.conectarWhatsapp(pessoaId, telefone);
      setCodigo("");
      setEtapa({ tipo: "codigo", telefone: r.telefone, codigoDeTeste: r.codigoDeTeste });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui mandar o código.");
      setEtapa({ tipo: "numero" });
    } finally {
      setEnviando(false);
    }
  }

  async function errei() {
    // O código enviado deixa de valer na hora.
    await servicos.pessoas.desistirDoWhatsapp(pessoaId).catch(() => undefined);
    setErro("");
    setEtapa({ tipo: "numero" });
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      setEtapa({ tipo: "pronto", telefone: await servicos.pessoas.confirmarWhatsapp(pessoaId, codigo) });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui confirmar.");
    } finally {
      setEnviando(false);
    }
  }

  async function desconectar() {
    setEnviando(true);
    await servicos.pessoas.desconectarWhatsapp(pessoaId);
    setEnviando(false);
    fechar();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-scrim p-4" onPointerDown={(e) => e.target === e.currentTarget && fechar()}>
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-whatsapp"
        className="max-h-[92dvh] w-full max-w-[460px] overflow-auto rounded-3xl border border-line bg-bg p-6"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="titulo-whatsapp" className="text-[1.3rem] leading-tight font-bold">
            Conversar com a Luana pelo WhatsApp
          </h2>
          <button type="button" onClick={fechar} aria-label="Fechar" className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface2">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {etapa.tipo === "numero" && (
          <>
            <p className="text-muted">
              O que você contar pelo WhatsApp (compras, faturas, áudios) entra aqui no app. As conversas são separadas: o WhatsApp tem a dele e o app tem a sua.
            </p>
            {atual && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-good-soft px-3 py-2">
                <span className="font-bold text-good">Conectado: {telefoneLegivel(atual)}</span>
                <Botao variante="link" tamanho="pequeno" onClick={desconectar} disabled={enviando}>
                  <Unlink aria-hidden="true" />
                  Desconectar
                </Botao>
              </div>
            )}
            <form onSubmit={conferir} className="mt-4">
              <label className="block">
                <span className="mb-1.5 block font-bold">{atual ? "Trocar para outro número" : "Seu número de WhatsApp"}</span>
                <input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(11) 99999-8888"
                  aria-describedby="whatsapp-ajuda"
                  className={CAMPO}
                />
              </label>
              <p id="whatsapp-ajuda" className="mt-1 text-[0.85rem] text-muted">
                Com DDD. Vamos mandar um código para esse WhatsApp.
              </p>
              {erro && (
                <p role="alert" className="mt-2 font-bold text-bad">
                  {erro}
                </p>
              )}
              <Botao type="submit" bloco className="mt-4">
                Continuar
              </Botao>
            </form>
            <div className="mt-5 rounded-2xl bg-surface p-4 text-[0.95rem]">
              <b className="block">Antes, no seu WhatsApp</b>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                {CODIGO_DE_ENTRADA && (
                  <li>
                    Mande <b>join {CODIGO_DE_ENTRADA}</b> para {NUMERO_DA_LUANA || "o número da Luana"} (é o sandbox da Twilio).
                  </li>
                )}
                <li>
                  Mande um “oi” para a Luana{NUMERO_DA_LUANA && !CODIGO_DE_ENTRADA ? ` (${NUMERO_DA_LUANA})` : ""}. Ela só manda o código para quem já falou com ela.
                </li>
              </ol>
            </div>
          </>
        )}

        {etapa.tipo === "conferir" && (
          <div>
            <p>Confira o número antes de mandarmos o código:</p>
            <p className="my-4 text-center text-[1.6rem] font-bold tracking-wide">
              {telefoneLegivel(etapa.telefone)}
            </p>
            <p className="text-[0.92rem] text-muted">Se o número estiver errado, o código vai para outra pessoa e não vai servir para você.</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Botao variante="secundario" onClick={() => setEtapa({ tipo: "numero" })}>
                Corrigir
              </Botao>
              <Botao data-foco onClick={() => enviarCodigo(etapa.telefone)} disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar código"}
              </Botao>
            </div>
          </div>
        )}

        {etapa.tipo === "codigo" && (
          <form onSubmit={confirmar}>
            <p>
              Mandamos um código para o WhatsApp <b>{telefoneLegivel(etapa.telefone)}</b>. Digite aqui para confirmar que o número é seu.
            </p>
            {etapa.codigoDeTeste && (
              <p className="mt-2 rounded-xl bg-maybe-soft px-3 py-2 text-[0.9rem] text-maybe">
                Ambiente de desenvolvimento sem WhatsApp configurado: o código é <b>{etapa.codigoDeTeste}</b>.
              </p>
            )}
            <label className="mt-4 block">
              <span className="mb-1.5 block font-bold">Código</span>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className={`${CAMPO} text-center text-[1.4rem] font-bold tracking-[0.4em]`}
              />
            </label>
            {erro && (
              <p role="alert" className="mt-2 font-bold text-bad">
                {erro}
              </p>
            )}
            <Botao type="submit" bloco className="mt-4" disabled={enviando || codigo.length !== 6}>
              {enviando ? "Confirmando…" : "Confirmar"}
            </Botao>
            <div className="mt-2 flex flex-wrap justify-between gap-2">
              <Botao variante="link" onClick={errei}>
                Errei o número
              </Botao>
              <Botao variante="link" onClick={() => enviarCodigo(etapa.telefone)} disabled={enviando}>
                Mandar outro código
              </Botao>
            </div>
          </form>
        )}

        {etapa.tipo === "pronto" && (
          <div role="status">
            <p className="rounded-xl bg-good-soft px-3 py-2.5 font-bold text-good">
              Pronto: {telefoneLegivel(etapa.telefone)} está conectado à sua conta.
            </p>
            <p className="mt-3">
              Agora é só conversar com a Luana pelo WhatsApp: “comprei pão 12”, um áudio ou a foto da fatura. A Luana também mandou uma mensagem para esse
              número avisando da conexão; quem tiver o número pode responder “desconectar” a qualquer momento.
            </p>
            <Botao bloco className="mt-4" onClick={fechar}>
              Fechar
            </Botao>
          </div>
        )}
      </div>
    </div>
  );
}
