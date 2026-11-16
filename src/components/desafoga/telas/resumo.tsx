"use client";

import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { usePessoa } from "@/hooks/use-pessoa";
import { GradeDeHumor } from "../rotina";
import {
  divisaoPorNecessidade,
  emocaoDaNota,
  notaDoDia,
  orcamentoDoMes,
  padroesDeCompra,
  resumoDaSemana,
  situacaoDoPaciente,
} from "@/lib/finance";
import { umaCasa } from "@/lib/assistente/textos";
import { reais } from "@/lib/formatar";
import { servicos } from "@/services";
import { ListaDeAvisos } from "../avisos";
import { FaixaDaSemana, ListaDePadroes } from "../emocao";
import { ListaDoOrcamento } from "../orcamento";
import { Carregando, EtiquetaSituacao, Kpi, Painel } from "../ui/blocos";
import { Carinha } from "../ui/carinha";

function ValorComCarinha({ nota, vazio }: { nota: number | null; vazio: string }) {
  if (nota === null) return <>{vazio}</>;
  return (
    <span className="inline-flex items-center gap-2">
      <Carinha emocao={emocaoDaNota(nota)} tamanho="xs" rotulo={false} />
      {umaCasa(nota)}
    </span>
  );
}

/** Para onde foi o dinheiro da semana: necessárias, não necessárias e "não sei". */
function Divisao({ sim, nao, talvez }: { sim: number; nao: number; talvez: number }) {
  const total = sim + nao + talvez || 1;
  const partes = [
    { rotulo: "Necessárias", valor: sim, cor: "bg-good" },
    { rotulo: "Não necessárias", valor: nao, cor: "bg-bad" },
    { rotulo: "Não sei", valor: talvez, cor: "bg-maybe" },
  ];
  return (
    <>
      <div aria-hidden="true" className="my-2.5 flex h-[22px] overflow-hidden rounded-full bg-line">
        {partes.map((p) => (
          <div key={p.rotulo} className={p.cor} style={{ width: `${(p.valor / total) * 100}%` }} />
        ))}
      </div>
      <ul className="grid gap-1.5">
        {partes.map((p) => (
          <li key={p.rotulo} className="flex flex-wrap items-center gap-x-2">
            <i aria-hidden="true" className={`inline-block size-3.5 rounded ${p.cor}`} />
            {p.rotulo}
            <b className="ml-auto">{reais(p.valor)}</b>
          </li>
        ))}
      </ul>
    </>
  );
}

export function TelaResumo({ pessoaId }: { pessoaId: string }) {
  const dados = usePessoa(pessoaId);
  const avisos = useConsulta(`avisos:${pessoaId}`, () => servicos.avisos.daPessoa(pessoaId));
  const agora = useAgora();
  if (!dados || !agora || !avisos) return <Carregando />;

  const { persona, compras, orcamentos } = dados;
  const doMes = orcamentoDoMes(orcamentos, compras, agora);
  const semana = resumoDaSemana(compras, agora);
  const sujeito = `${persona.apelido} estava`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-[1.25rem] font-bold">{persona.nome}</h2>
        <EtiquetaSituacao situacao={situacaoDoPaciente(semana)} />
      </div>
      <p className="-mt-2 text-[0.95rem] text-muted">{persona.perfil}</p>
      <div className="grid grid-cols-2 gap-3 desk:grid-cols-4 desk:gap-4">
        <Kpi rotulo="Nota média da semana" valor={<ValorComCarinha nota={semana.nota} vazio="–" />} />
        <Kpi rotulo="Nota de hoje" valor={<ValorComCarinha nota={notaDoDia(compras, agora)} vazio="Sem compras" />} />
        <Kpi rotulo="Gasto na semana" valor={reais(semana.gasto)} />
        <Kpi rotulo="Marcou como não necessárias" valor={`${semana.naoNecessarias} de ${semana.total}`} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] desk:gap-5">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <Painel titulo="Humor e gasto por dia">
            <FaixaDaSemana dias={semana.dias} agora={agora} sujeito={sujeito} />
          </Painel>
          <Painel titulo="Humor ao longo do dia">
            <GradeDeHumor checkins={dados.rotina.checkins} rotina={dados.rotina.rotina} agora={agora} />
          </Painel>
          <Painel titulo="Para onde foi o dinheiro da semana">
            <Divisao {...divisaoPorNecessidade(semana.compras)} />
          </Painel>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <Painel titulo="Padrões encontrados">
            <ListaDePadroes padroes={padroesDeCompra(compras, agora)} sujeito={sujeito} />
          </Painel>
          <Painel titulo="Avisos recentes">
            <ListaDeAvisos avisos={avisos.slice(0, 5)} agora={agora} />
          </Painel>
          {doMes.length > 0 && (
            <Painel titulo="Orçamento do mês">
              <ListaDoOrcamento situacoes={doMes} pessoa={persona.apelido} />
            </Painel>
          )}

        </div>
      </div>
    </div>
  );
}
