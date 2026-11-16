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
        aria-label={numero ? "WhatsApp conectado. Trocar número" : "Conectar WhatsApp"}
        className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface2 px-3 text-[0.85rem] font-bold hover:border-primary"
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        {numero ? "WhatsApp" : "Conectar WhatsApp"}
        {numero && <Check aria-hidden="true" className="size-4 text-good" />}
      </button>
      {aberto && <DialogoWhatsapp pessoaId={pessoaId} atual={numero ?? null} fechar={() => setAberto(false)} />}
    </>
  );
}

type Etapa =
  | { tipo: "numero" }
  | { tipo: "codigo"; telefone: string; codigoDeTeste: string | null }
  | { tipo: "pronto"; telefone: string };

const CAMPO = "min-h-12 w-full rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 outline-none focus:border-primary";

/**
 * Conectar o WhatsApp: a pessoa informa o número, a Luana manda um código
 * para esse WhatsApp e a pessoa digita o código aqui. Assim só quem tem o
 * celular na mão liga o número à conta.
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
    caixa.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [etapa.tipo]);

  async function pedirCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const r = await servicos.pessoas.conectarWhatsapp(pessoaId, numero);
      setCodigo("");
      setEtapa({ tipo: "codigo", telefone: r.telefone, codigoDeTeste: r.codigoDeTeste });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui mandar o código.");
    } finally {
      setEnviando(false);
    }
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

        {etapa.tipo === "numero" && (
          <>
            <p className="text-muted">
              O que você contar pelo WhatsApp (compras, faturas, áudios) entra aqui no app. As conversas são separadas: o WhatsApp tem a dele e o app tem a sua.
            </p>
            {atual && <p className="mt-2 font-bold">Conectado agora: {telefoneLegivel(atual)}</p>}
            <form onSubmit={pedirCodigo} className="mt-4">
              <label className="block">
                <span className="mb-1.5 block font-bold">Seu número de WhatsApp</span>
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
              <Botao type="submit" bloco className="mt-4" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar código"}
              </Botao>
            </form>
            {(NUMERO_DA_LUANA || CODIGO_DE_ENTRADA) && (
              <div className="mt-5 rounded-2xl bg-surface p-4 text-[0.95rem]">
                <b className="block">Antes, no seu WhatsApp</b>
                <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                  {NUMERO_DA_LUANA && <li>Salve o número da Luana: {NUMERO_DA_LUANA}.</li>}
                  {CODIGO_DE_ENTRADA && (
                    <li>
                      Mande <b>join {CODIGO_DE_ENTRADA}</b> para ele (é o sandbox da Twilio; sem isso o código não chega).
                    </li>
                  )}
                </ol>
              </div>
            )}
          </>
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
              <Botao variante="link" onClick={() => setEtapa({ tipo: "numero" })}>
                Trocar número
              </Botao>
              <Botao variante="link" onClick={() => pedirCodigo()} disabled={enviando}>
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
            <p className="mt-3">Agora é só conversar com a Luana pelo WhatsApp: “comprei pão 12”, um áudio ou a foto da fatura.</p>
            <Botao bloco className="mt-4" onClick={fechar}>
              Fechar
            </Botao>
          </div>
        )}
      </div>
    </div>
  );
}
