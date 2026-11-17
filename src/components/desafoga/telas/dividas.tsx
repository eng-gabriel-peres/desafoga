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
import { useEu, useMinhaPessoaId } from "../sessao";
import { CamposParaConferir, lerCampo, SugestoesDeDivida } from "../banco/sugestoes-de-divida";
import { EnviarDocumento } from "../dividas/enviar-documento";
import type { CampoDaDivida } from "@/services";
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
  const [enviando, setEnviando] = useState<"registrato" | "contrato" | null>(null);
  const [conferindo, setConferindo] = useState<Divida | null>(null);
  const eu = useEu();
  if (!dados || !agora) return <Carregando />;

  const { persona, dividas, plano, faturas, compras, banco } = dados;
  const daPessoa = area === "pessoa";

  const sugestoes = daPessoa && <SugestoesDeDivida pessoaId={pessoaId} sugestoes={banco.sugestoes} dividas={dividas} />;
  const registrato = daPessoa && (
    <Painel titulo="Não lembra de todas?">
      <Sub>
        O{" "}
        <a href="https://registrato.bcb.gov.br" target="_blank" rel="noreferrer" className="font-bold text-primary">
          Registrato do Banco Central
        </a>{" "}
        mostra todos os seus empréstimos, em todos os bancos (entra com a conta gov.br). Envie o relatório aqui, ou o contrato e o print do empréstimo, que a gente monta as dívidas para você conferir.
      </Sub>
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao tamanho="pequeno" onClick={() => setEnviando("registrato")}>
          Enviar Registrato
        </Botao>
        <Botao tamanho="pequeno" variante="secundario" onClick={() => setEnviando("contrato")}>
          Enviar contrato ou print
        </Botao>
      </div>
      <EnviarDocumento pessoaId={pessoaId} tipo={enviando ?? "registrato"} aberta={enviando !== null} fechar={() => setEnviando(null)} demo={eu.demo} />
    </Painel>
  );
  const conferir = daPessoa && (
    <Janela aberta={conferindo !== null} fechar={() => setConferindo(null)} rotulo="Conferir dívida">
      {conferindo && <ConferirDivida key={conferindo.id} pessoaId={pessoaId} divida={conferindo} fechar={() => setConferindo(null)} />}
    </Janela>
  );

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
        {sugestoes}
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
        {registrato}
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
      aoConferir={daPessoa ? setConferindo : undefined}
      aoDesvincular={daPessoa ? (d) => servicos.banco.desvincularDivida(pessoaId, d.id) : undefined}
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
      {conferir}
      {sugestoes && <div className="mb-4">{sugestoes}</div>}
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
          {registrato}
        </div>
      </div>
    </>
  );
}

/** Dívidas de quem está na sessão (área do app). */
export function TelaMinhasDividas() {
  return <TelaDividas pessoaId={useMinhaPessoaId()} area="pessoa" />;
}

/** A pessoa completa ou corrige o que a fonte não trouxe: vale sobre o que ela disser depois. */
function ConferirDivida({ pessoaId, divida, fechar }: { pessoaId: string; divida: Divida; fechar: () => void }) {
  // Os campos que faltam; se não falta nada, a pessoa pode corrigir qualquer um.
  const campos: CampoDaDivida[] = divida.confira?.length ? (divida.confira as CampoDaDivida[]) : ["saldo", "taxaMensal", "parcelaMinima", "parcelasRestantes"];
  const [valores, setValores] = useState<Partial<Record<CampoDaDivida, string>>>({});
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const prontos: [CampoDaDivida, number][] = [];
        for (const c of campos) {
          if (!valores[c]) continue;
          const v = lerCampo(c, valores[c]!);
          if (v === null) return setErro("Confira os valores digitados.");
          prontos.push([c, v]);
        }
        if (!prontos.length) return setErro("Preencha pelo menos um campo.");
        setSalvando(true);
        try {
          for (const [c, v] of prontos) await servicos.banco.corrigirDivida(pessoaId, divida.id, c, v);
          fechar();
        } catch (e) {
          setErro(e instanceof Error ? e.message : "Não consegui salvar agora.");
        } finally {
          setSalvando(false);
        }
      }}
    >
      <h2 className="text-[1.3rem] font-bold">Conferir {divida.nome}</h2>
      <Sub>O que você preencher aqui vale mesmo quando o banco ou outro documento atualizar a dívida. Deixe em branco o que estiver certo.</Sub>
      <CamposParaConferir
        campos={campos}
        valores={valores}
        mudar={(c, v) => setValores((x) => ({ ...x, [c]: v }))}
        titulo={divida.confira?.length ? undefined : "Corrija o que estiver diferente do seu contrato"}
      />
      {erro && (
        <p role="alert" className="font-bold text-bad">
          {erro}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={fechar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={salvando}>
          Salvar
        </Botao>
      </div>
    </form>
  );
}
