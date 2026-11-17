"use client";

import { useState } from "react";
import type { Divida } from "@/lib/finance";

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
import { useMinhaPessoaId } from "../sessao";
import { Janela } from "../ui/janela";
import { Carregando, Kpi, Painel, Sub, TituloCelular } from "../ui/blocos";
import { Botao, BotaoLink } from "../ui/botao";
import { FormularioDeDivida } from "../dividas/formulario";

/**
 * Dívidas: a mesma visão para a pessoa (plano editável, envio de fatura) e
 * para o responsável (só leitura, com "Sugerir valor mensal").
 */
export function TelaDividas({ pessoaId, area }: { pessoaId: string; area: Area }) {
  const dados = usePessoa(pessoaId);
  const agora = useAgora();
  const [editando, setEditando] = useState<Divida | "nova" | null>(null);
  if (!dados || !agora) return <Carregando />;

  const { persona, dividas, plano, faturas, compras } = dados;
  const daPessoa = area === "pessoa";

  const formulario = daPessoa && (
    <Janela aberta={editando !== null} fechar={() => setEditando(null)} rotulo={editando === "nova" ? "Nova dívida" : "Editar dívida"}>
      {editando && (
        <FormularioDeDivida
          key={editando === "nova" ? "nova" : editando.id}
          pessoaId={pessoaId}
          divida={editando === "nova" ? null : editando}
          fechar={() => setEditando(null)}
        />
      )}
    </Janela>
  );

  if (!dividas.length) {
    return (
      <div className="grid gap-4">
        {daPessoa && <TituloCelular titulo="Dívidas" subtitulo="Quanto suas dívidas custam e como sair delas" />}
        {formulario}
        <Painel titulo={daPessoa ? "Você não tem dívidas cadastradas" : `${persona.apelido} não tem dívidas cadastradas`}>
          <Sub>
            {daPessoa
              ? "Cadastre cartão, cheque especial, empréstimos e parcelados para ver quanto custam e montar o plano para sair deles. Também dá para enviar a fatura."
              : "Quando a pessoa cadastrar as dívidas, o raio-x e o plano aparecem aqui."}
          </Sub>
          {daPessoa && (
            <div className="mt-3 flex flex-wrap gap-2.5">
              <Botao onClick={() => setEditando("nova")}>Adicionar dívida</Botao>
              <BotaoLink href="/app/dividas/fatura" variante="secundario">
                Enviar fatura
              </BotaoLink>
            </div>
          )}
        </Painel>
      </div>
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
  const lista = (
    <ListaDeDividas
      dividas={dividas}
      titulo={daPessoa ? "Suas dívidas" : `Dívidas de ${persona.apelido}`}
      aoAdicionar={daPessoa ? () => setEditando("nova") : undefined}
      aoEditar={daPessoa ? setEditando : undefined}
    />
  );
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
      {formulario}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] desk:gap-5">
        {/* Esquerda: quanto custa e o plano. Direita: as dívidas, o custo emocional e as faturas. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {raioX}
          {kpis}
          {planoPainel}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {lista}
          {custo && <PainelCustoEmocional custo={custo} sujeito={daPessoa ? "você estava" : `${persona.apelido} estava`} />}
          <PainelFaturas faturas={faturas} podeEnviar={daPessoa} />
        </div>
      </div>
    </>
  );
}

/** Dívidas de quem está na sessão (área do app). */
export function TelaMinhasDividas() {
  return <TelaDividas pessoaId={useMinhaPessoaId()} area="pessoa" />;
}
