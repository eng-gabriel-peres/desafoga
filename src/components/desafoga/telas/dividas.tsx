"use client";

import { useAgora } from "@/hooks/use-agora";
import { usePessoa } from "@/hooks/use-pessoa";
import {
  custoEmocional,
  dividaMaisCara,
  encargosDasFaturas,
  jurosMensaisTotais,
  projecaoSoMinimo,
  saldoTotal,
  simularQuitacao,
  somaDosMinimos,
} from "@/lib/finance";
import { mesDaqui, meses, percentual } from "@/lib/assistente/textos";
import { reais } from "@/lib/formatar";
import { servicos } from "@/services";
import { ListaDeDividas, PainelCustoEmocional, PainelFaturas, RaioX } from "../dividas/paineis";
import { PlanoEditavel, PlanoLeitura } from "../dividas/plano";
import type { Area } from "../moldura/navegacao";
import { Carregando, Kpi, Painel, Sub, TituloCelular } from "../ui/blocos";
import { BotaoLink } from "../ui/botao";

/**
 * Dívidas: a mesma visão para a pessoa (plano editável, envio de fatura) e
 * para o responsável (só leitura, com "Sugerir valor mensal").
 */
export function TelaDividas({ pessoaId, area }: { pessoaId: string; area: Area }) {
  const dados = usePessoa(pessoaId);
  const agora = useAgora();
  if (!dados || !agora) return <Carregando />;

  const { persona, dividas, plano, faturas, compras } = dados;
  const daPessoa = area === "pessoa";

  if (!dividas.length) {
    return (
      <>
        {daPessoa && <TituloCelular titulo="Dívidas" subtitulo="Quanto suas dívidas custam e como sair delas" />}
        <Painel titulo={daPessoa ? "Você não tem dívidas cadastradas" : `${persona.apelido} não tem dívidas cadastradas`}>
          <Sub>Envie uma fatura para ver quanto as dívidas custam.</Sub>
          {daPessoa && (
            <BotaoLink href="/app/dividas/fatura" className="mt-3">
              Enviar fatura
            </BotaoLink>
          )}
        </Painel>
      </>
    );
  }

  const custo = custoEmocional(faturas, compras);
  const maisCara = dividaMaisCara(dividas);
  const doPlano = simularQuitacao(dividas, Math.max(plano.valorMensal, somaDosMinimos(dividas)), plano.estrategia);

  const raioX = (
    <RaioX
      encargos={encargosDasFaturas(faturas)}
      estimativa={jurosMensaisTotais(dividas)}
      jurosEm12Meses={projecaoSoMinimo(dividas).jurosTotal}
      sujeito={daPessoa ? "você pagou" : `${persona.apelido} pagou`}
      dono={daPessoa ? "suas dívidas geram" : `as dívidas de ${persona.apelido} geram`}
    />
  );
  const lista = <ListaDeDividas dividas={dividas} titulo={daPessoa ? "Suas dívidas" : `Dívidas de ${persona.apelido}`} />;
  const planoPainel = daPessoa ? (
    <PlanoEditavel dividas={dividas} plano={plano} agora={agora} aoMudar={(m) => servicos.dividas.salvarPlano(pessoaId, m)} />
  ) : (
    <PlanoLeitura
      key={pessoaId}
      dividas={dividas}
      plano={plano}
      agora={agora}
      apelido={persona.apelido}
      sugerir={(v) => servicos.dividas.sugerirValor(pessoaId, v)}
    />
  );
  const kpis = !daPessoa && (
    <div className="grid grid-cols-2 gap-3 desk:gap-4">
      <Kpi rotulo="Total devido" valor={reais(saldoTotal(dividas))} />
      <Kpi rotulo="Juros por mês hoje" valor={reais(jurosMensaisTotais(dividas))} tom="ruim" />
      <Kpi rotulo="Mais cara" valor={maisCara ? percentual(maisCara.taxaMensal) : "–"} detalhe={maisCara?.nome} />
      <Kpi
        rotulo="Livre em"
        valor={doPlano.quitavel ? meses(doPlano.meses) : "–"}
        detalhe={doPlano.quitavel ? mesDaqui(agora, doPlano.meses) : undefined}
      />
    </div>
  );

  return (
    <>
      {daPessoa && <TituloCelular titulo="Dívidas" subtitulo="Quanto suas dívidas custam e como sair delas" />}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] desk:gap-5">
        <div className="grid gap-4">
          {raioX}
          {kpis}
          {daPessoa ? (
            <>
              {planoPainel}
              {lista}
            </>
          ) : (
            <>
              {lista}
              {planoPainel}
            </>
          )}
        </div>
        <div className="grid gap-4">
          {custo && <PainelCustoEmocional custo={custo} sujeito={daPessoa ? "você estava" : `${persona.apelido} estava`} />}
          <PainelFaturas faturas={faturas} podeEnviar={daPessoa} />
        </div>
      </div>
    </>
  );
}
