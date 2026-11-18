"use client";

import { Scale } from "lucide-react";
import Link from "next/link";
import { compromissosDoMes, dinheiroDoMes, situacaoDaMeta, totaisDoMes, type DinheiroDoMes } from "@/lib/finance";
import { reais } from "@/lib/formatar";
import type { DadosDaTela } from "@/hooks/use-pessoa";

/** A conta do mês com os dados da tela (a mesma que o servidor confere ao salvar). */
export function dinheiroDoMesDe(dados: Pick<DadosDaTela, "contas" | "dividas" | "plano" | "metas" | "orcamentos">, agora: Date): DinheiroDoMes {
  const t = totaisDoMes(compromissosDoMes(dados.contas.contas, dados.dividas, dados.plano, dados.contas.pagamentos, agora), dados.contas.renda);
  const ativas = dados.metas.filter((m) => !situacaoDaMeta(m, agora).concluida);
  return dinheiroDoMes({ renda: t.renda, contas: t.contas, parcelas: t.parcelas, metas: ativas, orcamentos: dados.orcamentos });
}

/** Renda − contas − parcelas − metas = o que dá para distribuir nos orçamentos. */
export function SeuMes({ d }: { d: DinheiroDoMes }) {
  if (d.renda === null) {
    return (
      <section className="entrar mb-4 rounded-[20px] border-2 border-dashed border-line bg-surface p-4">
        <p className="flex items-center gap-2 font-bold">
          <Scale aria-hidden="true" className="size-5 text-primary" /> O seu mês fecha?
        </p>
        <p className="mt-1 text-muted">
          Informe quanto entra por mês para o app conferir se os orçamentos, as metas e as dívidas cabem na sua renda.{" "}
          <Link href="/app/contas" className="font-bold text-primary">
            Informar a renda
          </Link>
        </p>
      </section>
    );
  }
  const linhas: [string, number][] = [
    ["Contas fixas", d.contas],
    ["Parcelas das dívidas (plano)", d.parcelas],
    ["Metas", d.metas],
  ];
  const sobra = d.sobra ?? 0;
  const estourou = sobra < 0;
  return (
    <section aria-label="Seu mês" className={`entrar mb-4 rounded-[20px] border bg-surface p-4 desk:px-5 ${estourou ? "border-bad" : "border-line"}`}>
      <h2 className="flex items-center gap-2 text-[1.12rem] font-bold">
        <Scale aria-hidden="true" className="size-5 text-primary" /> Seu mês
      </h2>
      <dl className="mt-2.5 grid gap-1 text-[0.95rem]">
        <div className="flex justify-between">
          <dt>Entra (renda)</dt>
          <dd className="font-bold">{reais(d.renda)}</dd>
        </div>
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex justify-between text-muted">
            <dt>− {rotulo}</dt>
            <dd>{reais(valor)}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between border-t border-line pt-1.5">
          <dt className="font-bold">Para gastar nas categorias</dt>
          <dd className="font-bold">{reais(d.paraOrcamentos ?? 0)}</dd>
        </div>
        <div className="flex justify-between text-muted">
          <dt>− Já distribuído nos orçamentos</dt>
          <dd>{reais(d.orcamentos)}</dd>
        </div>
      </dl>
      <p className={`mt-2.5 rounded-xl px-3.5 py-2.5 font-bold ${estourou ? "bg-bad-soft text-bad" : "bg-good-soft text-good"}`}>
        {estourou
          ? `O mês não fecha: passa ${reais(-sobra)} do que entra. Diminua algum orçamento, uma meta ou o plano das dívidas.`
          : `Ainda pode distribuir ${reais(sobra)} nos orçamentos.`}
      </p>
    </section>
  );
}
