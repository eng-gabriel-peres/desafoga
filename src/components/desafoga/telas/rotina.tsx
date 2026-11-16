"use client";

import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { usePessoa } from "@/hooks/use-pessoa";
import { NOME_DO_PERIODO, PERIODOS, type Periodo } from "@/lib/finance";
import { servicos } from "@/services";
import { GradeDeHumor, ICONE_DO_PERIODO } from "../rotina";
import { useMinhaPessoaId, useEu } from "../sessao";
import { Carregando, Painel, Sub, TituloCelular } from "../ui/blocos";
import { CAMPO } from "../ui/campos";

const DESCRICAO: Record<Periodo, [string, string]> = {
  manha: ["Quando acordo", "Pergunta como você acordou."],
  tarde: ["Meio-dia", "Pergunta como está o dia."],
  noite: ["À noite", "Pergunta como você está se sentindo."],
};

/** Interruptor liga/desliga acessível (role="switch"). */
function Interruptor({ ligado, mudar, rotulo }: { ligado: boolean; mudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={() => mudar(!ligado)}
      className="relative h-8 w-14 shrink-0 rounded-full bg-line transition-colors aria-checked:bg-primary"
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 left-1 size-6 rounded-full bg-surface shadow transition-transform ${ligado ? "translate-x-6" : ""}`}
      />
    </button>
  );
}

function Linha({ titulo, descricao, children, extra }: { titulo: string; descricao: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-line py-3.5 last:border-0">
      <div className="min-w-0 flex-1">
        <b className="block">{titulo}</b>
        <Sub>{descricao}</Sub>
        {extra}
      </div>
      {children}
    </div>
  );
}

/** Rotina e privacidade: os horários dos check-ins e o que quem acompanha pode ver. */
export function TelaRotina() {
  const pessoaId = useMinhaPessoaId();
  const eu = useEu();
  const dados = usePessoa(pessoaId);
  const agora = useAgora();
  const [salvo, setSalvo] = useState("");
  if (!dados || !agora) return <Carregando />;

  const { rotina, checkins } = dados.rotina;
  const responsavel = eu.acompanhantes?.[0]?.nome ?? "Quem te acompanha";
  const salvar = async (m: Parameters<typeof servicos.rotina.salvar>[1], recado = "Salvo.") => {
    await servicos.rotina.salvar(pessoaId, m);
    setSalvo(recado);
  };

  return (
    <>
      <TituloCelular titulo="Rotina e privacidade" subtitulo="Seus horários e o que quem te acompanha vê" />
      <p role="status" className="sr-only">
        {salvo}
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-2 desk:gap-5">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <Painel titulo="Seus horários">
            <Sub className="mb-1">A Luana pergunta como você está nesses horários. Você também responde pelo cartão da tela Hoje.</Sub>
            {PERIODOS.map((p) => {
              const Icone = ICONE_DO_PERIODO[p];
              const [titulo, descricao] = DESCRICAO[p];
              return (
                <Linha
                  key={p}
                  titulo={titulo}
                  descricao={descricao}
                  extra={
                    <label className="mt-2 flex items-center gap-2">
                      <Icone aria-hidden="true" className="size-4.5 text-muted" />
                      <span className="sr-only">Horário {NOME_DO_PERIODO[p].toLowerCase()}</span>
                      <input
                        type="time"
                        className={`${CAMPO} w-36 min-h-11!`}
                        defaultValue={rotina.horarios[p]}
                        disabled={!rotina.ligados[p]}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (/^\d{2}:\d{2}$/.test(v) && v !== rotina.horarios[p]) void salvar({ horarios: { [p]: v } }, `Horário salvo: ${v}.`);
                        }}
                      />
                    </label>
                  }
                >
                  <Interruptor ligado={rotina.ligados[p]} rotulo={`Check-in ${NOME_DO_PERIODO[p].toLowerCase()}`} mudar={(v) => salvar({ ligados: { [p]: v } })} />
                </Linha>
              );
            })}
          </Painel>
          <Painel titulo="Privacidade">
            <Linha titulo="Avisar quem me acompanha quando eu responder triste" descricao={`${responsavel} recebe um aviso se você responder 1 ou 2 num check-in.`}>
              <Interruptor ligado={rotina.avisarQuandoTriste} rotulo="Avisar quando responder triste" mudar={(v) => salvar({ avisarQuandoTriste: v })} />
            </Linha>
            <Linha titulo="Quem me acompanha pode ver minhas contas" descricao="Se desligar, não veem as contas fixas nem a renda.">
              <Interruptor ligado={rotina.compartilharContas} rotulo="Compartilhar contas" mudar={(v) => salvar({ compartilharContas: v })} />
            </Linha>
          </Painel>
        </div>
        <Painel titulo="Sua semana nos check-ins">
          <GradeDeHumor checkins={checkins} rotina={rotina} agora={agora} />
        </Painel>
      </div>
    </>
  );
}
