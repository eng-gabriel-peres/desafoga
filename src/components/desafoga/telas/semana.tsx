"use client";

import { useAgora } from "@/hooks/use-agora";
import { usePessoa } from "@/hooks/use-pessoa";
import { comprasPorHorario, divisaoPorNecessidade, padroesDeCompra, resumoDaSemana } from "@/lib/finance";
import { DivisaoDoDinheiro, FaixaDaSemana, HorariosDeCompra, ListaDePadroes } from "../emocao";
import { useMinhaPessoaId } from "../sessao";
import { Carregando, Painel } from "../ui/blocos";

/** Sua semana: como a pessoa estava, quanto gastou, em que horário e para onde foi o dinheiro. */
export function TelaSemana() {
  const pessoaId = useMinhaPessoaId();
  const dados = usePessoa(pessoaId);
  const agora = useAgora();
  if (!dados || !agora) return <Carregando />;

  const { compras } = dados;
  const semana = resumoDaSemana(compras, agora);
  const sujeito = "você estava";

  return (
    <>
      <div className="mb-4 desk:hidden">
        <h1 className="text-[1.7rem] leading-tight font-bold">Sua semana</h1>
        <p className="mt-0.5 text-muted">Os últimos 7 dias</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] desk:gap-5">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <Painel titulo="Como você estava e quanto gastou">
            <FaixaDaSemana dias={semana.dias} agora={agora} sujeito={sujeito} />
          </Painel>
          <Painel titulo="Em que horário você compra">
            <HorariosDeCompra horarios={comprasPorHorario(compras)} />
          </Painel>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <Painel titulo="O que dá para perceber">
            <ListaDePadroes padroes={padroesDeCompra(compras, agora)} sujeito={sujeito} />
          </Painel>
          <Painel titulo="Para onde foi o dinheiro">
            <DivisaoDoDinheiro {...divisaoPorNecessidade(semana.compras)} />
          </Painel>
        </div>
      </div>
    </>
  );
}
