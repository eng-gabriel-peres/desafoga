"use client";

import { AlarmClock, MessageCircle, Moon, Sun, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { checkInDe, chaveDoDia, jaEHora, NOME_DO_PERIODO, PERIODOS, ultimosDias, type CheckIn, type Emocao, type Periodo, type Rotina } from "@/lib/finance";
import { NOME_DA_EMOCAO, perguntaDoCheckIn } from "@/lib/assistente/textos";
import { servicos } from "@/services";
import { Carinha, COR_DA_EMOCAO, RostoSvg } from "./ui/carinha";
import { Painel } from "./ui/blocos";

export const ICONE_DO_PERIODO: Record<Periodo, LucideIcon> = { manha: AlarmClock, tarde: Sun, noite: Moon };

const EMOCOES: Emocao[] = [1, 2, 3, 4, 5];

/** "Como você está hoje?": os três check-ins do dia, respondidos com uma carinha. */
export function CartaoDeCheckIns({
  pessoaId,
  apelido,
  rotina,
  checkins,
  agora,
}: {
  pessoaId: string;
  apelido: string;
  rotina: Rotina;
  checkins: CheckIn[];
  agora: Date;
}) {
  const [aberto, setAberto] = useState<Periodo | null>(null);
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const hoje = chaveDoDia(agora);

  async function responder(humor: Emocao) {
    if (!aberto) return;
    setEnviando(true);
    setErro("");
    try {
      const r = await servicos.rotina.responder(pessoaId, aberto, humor);
      setResposta(r.resposta);
      setAberto(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui salvar agora.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Painel
      titulo="Como você está hoje?"
      acao={
        <Link href="/app/rotina" className="text-[0.92rem] font-bold text-primary">
          Horários
        </Link>
      }
    >
      <ul className="grid grid-cols-3 gap-2">
        {PERIODOS.map((p) => {
          const Icone = ICONE_DO_PERIODO[p];
          const feito = checkInDe(checkins, hoje, p);
          const ligado = rotina.ligados[p];
          return (
            <li
              key={p}
              className={`flex min-h-[6.5rem] flex-col items-center justify-between gap-1 rounded-2xl border px-1.5 py-2.5 text-center ${
                feito ? "border-transparent bg-surface2" : aberto === p ? "border-primary bg-primary-soft" : "border-line"
              }`}
            >
              <Icone aria-hidden="true" className="size-5 text-muted" />
              <span className="text-[0.85rem] font-bold">{NOME_DO_PERIODO[p]}</span>
              {feito ? (
                <Carinha emocao={feito.humor} tamanho="xs" rotulo={`${NOME_DO_PERIODO[p]}: ${NOME_DA_EMOCAO[feito.humor].toLowerCase()}`} />
              ) : (
                <button
                  type="button"
                  disabled={!ligado}
                  aria-expanded={aberto === p}
                  onClick={() => {
                    setAberto(aberto === p ? null : p);
                    setResposta("");
                  }}
                  className="text-[0.85rem] font-bold text-primary disabled:font-normal disabled:text-muted"
                >
                  {!ligado ? "Desligado" : jaEHora(rotina, p, agora) ? "Responder" : `às ${rotina.horarios[p]}`}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {aberto && (
        <div className="mt-3.5">
          <p id="pergunta-do-checkin" className="mb-2.5 font-bold">
            {perguntaDoCheckIn(apelido, aberto)}
          </p>
          <div role="group" aria-labelledby="pergunta-do-checkin" className="grid grid-cols-5 gap-1.5">
            {EMOCOES.map((e) => (
              <button
                key={e}
                type="button"
                disabled={enviando}
                onClick={() => responder(e)}
                className="flex flex-col items-center gap-1 rounded-xl border-2 border-line bg-surface px-0.5 py-2 text-[0.75rem] font-bold hover:border-primary disabled:opacity-60"
              >
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-full border-2 text-ink"
                  style={{ borderColor: COR_DA_EMOCAO[e], background: `color-mix(in srgb, ${COR_DA_EMOCAO[e]} 28%, var(--surface))` }}
                >
                  <RostoSvg emocao={e} />
                </span>
                {NOME_DA_EMOCAO[e]}
              </button>
            ))}
          </div>
        </div>
      )}
      {erro && (
        <p role="alert" className="mt-2.5 font-bold text-bad">
          {erro}
        </p>
      )}
      {resposta && (
        <p role="status" className="entrar mt-3.5 flex gap-2.5 rounded-2xl bg-primary-soft px-3.5 py-3 text-[0.95rem]">
          <MessageCircle aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-primary" />
          <span>{resposta}</span>
        </p>
      )}
    </Painel>
  );
}

/** Humor nos três horários dos últimos 7 dias (resumo do paciente e tela de rotina). */
export function GradeDeHumor({ checkins, rotina, agora }: { checkins: CheckIn[]; rotina: Rotina; agora: Date }) {
  const dias = ultimosDias(agora, 7);
  const hoje = chaveDoDia(agora);
  const nomeDoDia = (d: string) =>
    d === hoje ? "Hoje" : new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-separate border-spacing-y-1 text-center text-[0.85rem]">
          <caption className="sr-only">Como estava em cada check-in dos últimos 7 dias</caption>
          <thead>
            <tr>
              <th scope="col" className="w-28">
                <span className="sr-only">Horário</span>
              </th>
              {dias.map((d) => (
                <th key={d} scope="col" className={`font-bold capitalize ${d === hoje ? "text-primary" : "text-muted"}`}>
                  {nomeDoDia(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODOS.map((p) => {
              const Icone = ICONE_DO_PERIODO[p];
              return (
                <tr key={p}>
                  <th scope="row" className="text-left font-bold">
                    <span className="flex items-center gap-1.5">
                      <Icone aria-hidden="true" className="size-4 text-muted" />
                      {NOME_DO_PERIODO[p]}
                    </span>
                  </th>
                  {dias.map((d) => {
                    const c = checkInDe(checkins, d, p);
                    return (
                      <td key={d}>
                        {c ? (
                          <Carinha emocao={c.humor} tamanho="xs" rotulo={`${nomeDoDia(d)}, ${NOME_DO_PERIODO[p].toLowerCase()}: ${NOME_DA_EMOCAO[c.humor].toLowerCase()}`} />
                        ) : (
                          <span className="text-muted">
                            <span aria-hidden="true">–</span>
                            <span className="sr-only">sem resposta</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.85rem] text-muted">
        Horários: ao acordar {rotina.horarios.manha}, meio-dia {rotina.horarios.tarde}, à noite {rotina.horarios.noite}.
      </p>
    </>
  );
}
