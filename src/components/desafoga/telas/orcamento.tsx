"use client";

import { CalendarDays } from "lucide-react";
import { useAgora } from "@/hooks/use-agora";
import { usePessoa } from "@/hooks/use-pessoa";
import { orcamentoDoMes, resumoDoOrcamento } from "@/lib/finance";
import { reaisCurto } from "@/lib/assistente/textos";
import { CATEGORIAS } from "../categorias";
import { Anel } from "../metas/visual";
import { CartaoDoOrcamento, COR_DO_ANEL, SemLimite } from "../orcamento";
import { useMinhaPessoaId } from "../sessao";
import { Carregando, TituloCelular } from "../ui/blocos";

export function TelaOrcamento() {
  const pessoaId = useMinhaPessoaId();
  const dados = usePessoa(pessoaId);
  const agora = useAgora();
  if (!dados || !agora) return <Carregando />;

  const situacoes = orcamentoDoMes(dados.orcamentos, dados.compras, agora);
  const resumo = resumoDoOrcamento(situacoes, agora);
  const semLimite = CATEGORIAS.filter((c) => !situacoes.some((s) => s.categoria === c));
  const mes = agora.toLocaleDateString("pt-BR", { month: "long" });
  const estadoGeral = resumo.usado >= 1 ? "estourou" : resumo.usado >= 0.8 ? "atencao" : "tranquilo";

  return (
    <>
      <TituloCelular titulo="Orçamento" subtitulo="Quanto você quer gastar por categoria no mês" />
      {situacoes.length > 0 && (
        <section
          aria-label={`Resumo de ${mes}`}
          className="entrar mb-4 flex flex-wrap items-center gap-4.5 rounded-[20px] border border-line bg-surface p-4 desk:flex-nowrap desk:gap-6 desk:px-5"
        >
          <Anel
            fracao={Math.min(1, resumo.usado)}
            cor={COR_DO_ANEL[estadoGeral]}
            tamanho={96}
            espessura={12}
            centro={
              <>
                <b className="text-[1.05rem]">{Math.floor(resumo.usado * 100)}%</b>
                <span className="text-[0.72rem] text-muted">usado</span>
              </>
            }
          />
          <div className="min-w-0 flex-1">
            <span className="text-[0.92rem] text-muted">Em {mes} você já usou</span>
            <p className="text-[1.5rem] leading-tight font-bold">
              {reaisCurto(resumo.gasto)} <span className="text-[1rem] font-normal text-muted">de {reaisCurto(resumo.limite)}</span>
            </p>
          </div>
          <div className="flex w-full items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3 desk:w-auto">
            <CalendarDays aria-hidden="true" className="size-6 shrink-0 text-primary" />
            <div>
              <span className="block text-[0.85rem] text-muted">Pode gastar por dia</span>
              <b className="text-[1.25rem]">{reaisCurto(resumo.porDia)}</b>
              <span className="block text-[0.85rem] text-muted">
                {resumo.diasRestantes === 1 ? "hoje é o último dia" : `nos próximos ${resumo.diasRestantes} dias`}
              </span>
            </div>
          </div>
        </section>
      )}

      {situacoes.length ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 desk:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] desk:gap-4.5">
          {situacoes.map((s) => (
            <CartaoDoOrcamento key={s.categoria} pessoaId={pessoaId} situacao={s} />
          ))}
        </div>
      ) : (
        <div className="rounded-[18px] border-2 border-dashed border-line p-5 text-center text-muted">
          Defina quanto quer gastar em cada categoria. Aqui aparece quanto já usou, quanto resta e quanto dá para gastar por dia até o fim do mês.
        </div>
      )}
      <SemLimite pessoaId={pessoaId} categorias={semLimite} />
    </>
  );
}
