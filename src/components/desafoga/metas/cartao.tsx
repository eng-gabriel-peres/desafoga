"use client";

import { Heart, PartyPopper, Plus } from "lucide-react";
import { useState } from "react";
import { situacaoDaMeta, type Meta } from "@/lib/finance";
import { NOME_DA_FREQUENCIA, dataLonga, reaisCurto } from "@/lib/assistente/textos";
import { BotaoLink, Botao } from "../ui/botao";
import { CaixaDeDeposito } from "./deposito";
import { Anel, EtiquetaDoRitmo, IconeDaMetaBadge, corDaMeta } from "./visual";

/** Cartão da meta: anel, quanto guardou, quanto falta, o plano e quando termina. */
export function CartaoDaMeta({
  pessoaId,
  meta,
  agora,
  detalhe,
  incentivar,
  aoGuardar,
}: {
  pessoaId: string;
  meta: Meta;
  agora: Date;
  /** Link da tela de detalhes. */
  detalhe: string;
  /** Só para o profissional: manda um incentivo em vez de guardar. */
  incentivar?: () => void;
  aoGuardar: (mensagem: string) => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [animar, setAnimar] = useState(false);
  const s = situacaoDaMeta(meta, agora);
  const cor = corDaMeta(meta.cor, s.concluida);

  return (
    <article
      className={`rounded-[20px] border bg-surface p-4 ${s.concluida ? "border-[color-mix(in_srgb,var(--good)_45%,var(--line))]" : "border-line"}`}
    >
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <IconeDaMetaBadge icone={meta.icone} cor={cor} />
        <h3 className="min-w-0 flex-[1_1_calc(100%-50px)] text-[1.08rem] leading-tight font-bold desk:flex-1">{meta.nome}</h3>
        <span className="ml-[46px] desk:ml-0">
          <EtiquetaDoRitmo situacao={s} />
        </span>
      </header>

      <div className="mt-3.5 flex items-center gap-4.5">
        <Anel
          fracao={s.fracao}
          cor={cor}
          tamanho={124}
          espessura={15}
          animar={animar}
          centro={
            <>
              <b className="text-[1.15rem]">{reaisCurto(meta.alvo)}</b>
              <span className="mt-0.5 text-[0.75rem] text-muted">{s.concluida ? "concluída" : "meta"}</span>
            </>
          }
        />
        <div className="min-w-0 flex-1">
          <div className="text-[1.6rem] leading-[1.1] font-bold" style={{ color: cor }}>
            {reaisCurto(s.guardado)}
          </div>
          <span className="text-[0.92rem] text-muted">{Math.floor(s.fracao * 100)}% guardado</span>
          {s.concluida ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.92rem]">
              <PartyPopper aria-hidden="true" className="size-4 text-good" />
              Parabéns, meta completa!
            </p>
          ) : (
            <>
              <p className="mt-1.5 text-[0.92rem]">
                Faltam <b>{reaisCurto(s.falta)}</b>
              </p>
              <p className="mt-1.5 text-[0.92rem]">
                {reaisCurto(meta.valorPorPeriodo)} {NOME_DA_FREQUENCIA[meta.frequencia].por}
              </p>
              <p className="mt-1.5 text-[0.92rem] text-muted">
                {s.previsao && `Termina em ${dataLonga(s.previsao.data)}`}
                {s.depoisDoPrazo && <span className="text-bad"> (depois do prazo)</span>}
              </p>
            </>
          )}
        </div>
      </div>

      {guardando ? (
        <CaixaDeDeposito
          pessoaId={pessoaId}
          meta={meta}
          fechar={() => setGuardando(false)}
          aoGuardar={(m) => {
            setAnimar(true);
            aoGuardar(m);
          }}
        />
      ) : (
        <div className="mt-3.5 grid auto-cols-fr grid-flow-col gap-2.5">
          {incentivar ? (
            <Botao variante="secundario" tamanho="pequeno" onClick={incentivar}>
              <Heart aria-hidden="true" />
              Mandar incentivo
            </Botao>
          ) : (
            !s.concluida && (
              <Botao tamanho="pequeno" onClick={() => setGuardando(true)}>
                <Plus aria-hidden="true" />
                Guardar dinheiro
              </Botao>
            )
          )}
          <BotaoLink href={detalhe} variante="secundario" tamanho="pequeno">
            Detalhes
          </BotaoLink>
        </div>
      )}
    </article>
  );
}
