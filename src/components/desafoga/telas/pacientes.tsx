"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { chaveDoDia, emocaoDaNota, resumoDaSemana, situacaoDoPaciente, ultimosDias, type ResumoDaSemana, type Situacao } from "@/lib/finance";
import { umaCasa } from "@/lib/assistente/textos";
import { reais } from "@/lib/formatar";
import { servicos, type Persona } from "@/services";
import { Avatar, Carregando, Etiqueta, EtiquetaSituacao, Kpi, TituloCelular } from "../ui/blocos";
import { Carinha } from "../ui/carinha";

interface Linha {
  persona: Persona;
  semana: ResumoDaSemana;
  situacao: Situacao;
}

const ORDEM: Record<Situacao, number> = { atencao: 0, acompanhar: 1, novo: 2, estavel: 3 };

function NotaDaSemana({ nota }: { nota: number | null }) {
  if (nota === null) return <span className="text-muted">–</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <Carinha emocao={emocaoDaNota(nota)} tamanho="xs" rotulo={false} />
      <b>{umaCasa(nota)}</b>
    </span>
  );
}

function ParaAvaliar({ n }: { n: number }) {
  return n ? <Etiqueta tom="talvez">{n}</Etiqueta> : <Etiqueta tom="boa">Em dia</Etiqueta>;
}

export function TelaPacientes() {
  const agora = useAgora();
  const dados = useConsulta("pacientes", async () => {
    const pessoas = await servicos.pessoas.listar();
    const compras = await Promise.all(pessoas.map((p) => servicos.compras.listar(p.id)));
    const avisos = await servicos.avisos.listar();
    return { pessoas, compras, avisos };
  });
  if (!dados || !agora) return <Carregando />;

  const linhas: Linha[] = dados.pessoas
    .map((persona, i) => {
      const semana = resumoDaSemana(dados.compras[i], agora);
      return { persona, semana, situacao: situacaoDoPaciente(semana) };
    })
    .sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao]);
  const atencao = linhas.filter((l) => l.situacao === "atencao").length;
  const dias = ultimosDias(agora, 7);
  const avisosDaSemana = dados.avisos.filter((a) => a.tipo !== "sugestao" && dias.includes(chaveDoDia(new Date(a.quando)))).length;

  return (
    <>
      <TituloCelular titulo="Pacientes" subtitulo={`${linhas.length} pessoas acompanhadas, ${atencao} precisam de atenção`} />
      <div className="mb-5 grid grid-cols-2 gap-3 desk:grid-cols-4 desk:gap-4">
        <Kpi rotulo="Pacientes acompanhados" valor={linhas.length} />
        <Kpi rotulo="Precisam de atenção" valor={atencao} detalhe="nota baixa ou muitas compras não necessárias" tom={atencao ? "ruim" : undefined} />
        <Kpi rotulo="Compras para avaliar" valor={linhas.reduce((s, l) => s + l.semana.paraAvaliar, 0)} />
        <Kpi rotulo="Avisos nos últimos 7 dias" valor={avisosDaSemana} />
      </div>

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface desk:block">
        <table className="w-full border-collapse">
          <caption className="sr-only">Pacientes e indicadores dos últimos 7 dias</caption>
          <thead>
            <tr className="bg-surface2 text-left text-[0.82rem] text-muted">
              {["Paciente", "Situação", "Nota da semana", "Gasto da semana", "Não necessárias", "Para avaliar"].map((t) => (
                <th key={t} scope="col" className={`border-b border-line px-3.5 py-3 font-bold whitespace-nowrap ${t === "Gasto da semana" ? "text-right" : ""}`}>
                  {t}
                </th>
              ))}
              <th scope="col" className="border-b border-line px-3.5 py-3">
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ persona, semana, situacao }) => (
              <tr key={persona.id} className="hover:bg-surface2 [&>td]:border-b [&>td]:border-line [&>td]:px-3.5 [&>td]:py-3 last:[&>td]:border-0">
                <td>
                  <span className="flex items-center gap-2.5">
                    <Avatar nome={persona.nome} cor={persona.cor} />
                    <span>
                      <Link href={`/painel/${persona.id}`} className="font-bold text-ink hover:text-primary hover:underline">
                        {persona.nome}
                      </Link>
                      <span className="block text-[0.85rem] text-muted">{persona.idade} anos</span>
                    </span>
                  </span>
                </td>
                <td>
                  <EtiquetaSituacao situacao={situacao} />
                </td>
                <td>
                  <NotaDaSemana nota={semana.nota} />
                </td>
                <td className="text-right font-bold whitespace-nowrap">{reais(semana.gasto)}</td>
                <td>
                  {semana.naoNecessarias} de {semana.total}
                </td>
                <td>
                  <ParaAvaliar n={semana.paraAvaliar} />
                </td>
                <td>
                  <Link
                    href={`/painel/${persona.id}`}
                    aria-label={`Abrir resumo de ${persona.nome}`}
                    className="grid size-11 place-items-center rounded-xl text-muted hover:bg-primary-soft hover:text-primary"
                  >
                    <ChevronRight aria-hidden="true" className="size-5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular: cartões */}
      <ul className="grid gap-3 desk:hidden">
        {linhas.map(({ persona, semana, situacao }) => (
          <li key={persona.id}>
            <Link
              href={`/painel/${persona.id}`}
              className="block rounded-2xl border border-line bg-surface p-3.5 text-ink no-underline hover:border-primary"
            >
              <span className="flex items-center gap-3">
                <Avatar nome={persona.nome} cor={persona.cor} tamanho="lg" />
                <span className="min-w-0 flex-1">
                  <b className="block">{persona.nome}</b>
                  <span className="text-[0.88rem] text-muted">{persona.idade} anos</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 text-muted" />
              </span>
              <span className="mt-2.5 block">
                <EtiquetaSituacao situacao={situacao} />
              </span>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[0.92rem]">
                <div>
                  <dt className="text-[0.82rem] text-muted">Nota da semana</dt>
                  <dd>
                    <NotaDaSemana nota={semana.nota} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.82rem] text-muted">Gasto da semana</dt>
                  <dd className="font-bold">{reais(semana.gasto)}</dd>
                </div>
                <div>
                  <dt className="text-[0.82rem] text-muted">Não necessárias</dt>
                  <dd className="font-bold">
                    {semana.naoNecessarias} de {semana.total}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.82rem] text-muted">Para avaliar</dt>
                  <dd>
                    <ParaAvaliar n={semana.paraAvaliar} />
                  </dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
