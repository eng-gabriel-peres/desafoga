"use client";

import { ChevronRight, Plus, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { usePessoa } from "@/hooks/use-pessoa";
import {
  chaveDoDia,
  comEmocao,
  comprasDoDia,
  compromissosDoMes,
  totaisDoMes,
  encargosDasFaturas,
  jurosMensaisTotais,
  notaMedia,
  comprasPorHorario,
  divisaoPorNecessidade,
  orcamentoDoMes,
  padroesDeCompra,
  resumoDaSemana,
  somaDosValores,
} from "@/lib/finance";
import { dataPorExtenso, reais } from "@/lib/formatar";
import { DivisaoDoDinheiro, FaixaDaSemana, HorariosDeCompra, LinhaDeCompra, ListaDePadroes, NotaDoDia } from "../emocao";
import { MetasEmMiniatura } from "../metas/miniaturas";
import { andamento, CartaoDaConquista } from "../conquistas/cartao";
import { servicos } from "@/services";
import { ListaDoOrcamento } from "../orcamento";
import { ProximasContas } from "../contas";
import { ResumoDoDinheiro } from "../dinheiro";
import { gastosAvulsosDoBanco } from "../banco/avulsos";
import { ComprasParaRevisar } from "../banco/compras-para-revisar";
import { CartaoDeCheckIns } from "../rotina";
import { useMinhaPessoaId } from "../sessao";
import { Carregando, Painel, Sub, Vazio } from "../ui/blocos";
import { useAbrirRegistro } from "../registro";
import { Botao } from "../ui/botao";

export function TelaHoje() {
  const abrirRegistro = useAbrirRegistro();
  const pessoaId = useMinhaPessoaId();
  const dados = usePessoa(pessoaId);
  const conquistas = useConsulta(`conquistas:${pessoaId}`, () => servicos.conquistas.listar(pessoaId));
  const dinheiro = useConsulta(`dinheiro:${pessoaId}`, () => servicos.dinheiro.ver(pessoaId));
  const agora = useAgora();
  if (!dados || !agora) return <Carregando />;

  const { persona, compras, dividas, faturas, orcamentos, metas, plano, contas, rotina, banco } = dados;
  const compromissos = compromissosDoMes(contas.contas, dividas, plano, contas.pagamentos, agora);
  const checkIns = <CartaoDeCheckIns pessoaId={pessoaId} apelido={persona.apelido} rotina={rotina.rotina} checkins={rotina.checkins} agora={agora} />;
  const proximasContas = <ProximasContas compromissos={compromissos} totais={totaisDoMes(compromissos, contas.renda)} agora={agora} />;
  const seuDinheiro = dinheiro && (
    <Painel titulo="Seu dinheiro" acao={<Link href="/app/contas" className="text-[0.92rem] font-bold text-primary">Ver tudo</Link>}>
      <ResumoDoDinheiro d={dinheiro} agora={agora} comLink compacto />
    </Painel>
  );
  const doMes = orcamentoDoMes(orcamentos, compras, agora, gastosAvulsosDoBanco(banco));
  const paraRevisar = <ComprasParaRevisar pessoaId={pessoaId} banco={banco} agora={agora} />;
  const deHoje = comprasDoDia(compras, chaveDoDia(agora)).reverse();
  const semana = resumoDaSemana(compras, agora);
  const encargos = encargosDasFaturas(faturas).total || jurosMensaisTotais(dividas);

  // "Quase lá": a conquista em aberto mais perto de ser alcançada.
  const proxima = (conquistas ?? [])
    .map((c) => ({ c, a: andamento(c, compras, agora) }))
    .filter(({ a }) => !a.completa)
    .sort((x, y) => y.a.feito / y.c.alvo - x.a.feito / x.c.alvo)[0];
  const quaseLa = proxima && (
    <section aria-labelledby="quase-la">
      <h2 id="quase-la" className="mb-2.5 text-[1.12rem] font-bold">
        Quase lá
      </h2>
      <CartaoDaConquista conquista={proxima.c} compras={compras} agora={agora} />
    </section>
  );

  const registrar = (
    <Botao tamanho="grande" bloco onClick={() => abrirRegistro()}>
      <Plus aria-hidden="true" />
      Registrar compra
    </Botao>
  );

  const atalhoDividas = dividas.length > 0 && (
    <Link
      href="/app/dividas"
      className="flex items-center gap-3.5 rounded-[var(--radius-card)] border border-line bg-surface p-4 no-underline hover:border-primary"
    >
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-bad-soft text-bad">
        <TrendingDown className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block">{reais(encargos)} em juros e tarifas este mês</b>
        <span className="text-[0.92rem] text-muted">Veja o raio-x e o seu plano para sair das dívidas</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 text-muted" />
    </Link>
  );

  const verOrcamento = (
    <Link href="/app/orcamento" className="text-[0.92rem] font-bold text-primary">
      {doMes.length ? "Ver tudo" : "Definir"}
    </Link>
  );
  // As categorias mais usadas primeiro: é onde o aviso ajuda.
  const painelOrcamento = (
    <Painel titulo="Orçamento do mês" acao={verOrcamento}>
      {doMes.length ? (
        <ListaDoOrcamento situacoes={doMes.slice(0, 2)} />
      ) : (
        <Sub>Defina quanto quer gastar em cada categoria. A Luana avisa quanto resta e quanto dá para gastar por dia.</Sub>
      )}
    </Painel>
  );

  const atalhoMetas = metas.length > 0 && <MetasEmMiniatura metas={metas} agora={agora} />;

  const listaDeHoje = deHoje.length ? (
    <Painel titulo="Compras de hoje" acao={<Sub>Total {reais(somaDosValores(deHoje))}</Sub>}>
      <ul>
        {deHoje.map((c) => (
          <LinhaDeCompra key={c.id} compra={c} />
        ))}
      </ul>
    </Painel>
  ) : (
    <Vazio>Nenhuma compra hoje. Quando comprar algo, toque em Registrar compra ou mande uma mensagem para a Luana.</Vazio>
  );

  return (
    <>
      <div className="mb-4 desk:hidden">
        <h1 className="text-[1.7rem] leading-tight font-bold">Oi, {persona.apelido}</h1>
        <p className="mt-0.5 text-muted">{dataPorExtenso(agora)}</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] desk:gap-5">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <NotaDoDia nota={notaMedia(deHoje)} quantidade={comEmocao(deHoje).length} sujeito="você estava" />
          {paraRevisar}
          <div className="grid gap-4 desk:hidden">
            {registrar}
            {checkIns}
            {seuDinheiro}
            {proximasContas}
            {painelOrcamento}
            {atalhoMetas}
            {atalhoDividas}
          </div>
          {listaDeHoje}
          <div className="desk:hidden">{quaseLa}</div>
          <Painel titulo="Sua semana" className="hidden desk:block">
            <FaixaDaSemana dias={semana.dias} agora={agora} sujeito="você estava" />
          </Painel>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <Painel titulo="Comprou algo agora?" className="hidden desk:block">
            <Sub className="mb-3.5">Leva menos de 30 segundos. Também dá para mandar para a Luana pelo WhatsApp.</Sub>
            {registrar}
          </Painel>
          <div className="hidden desk:block">{checkIns}</div>
          <div className="hidden desk:block">{seuDinheiro}</div>
          <div className="hidden desk:block">{proximasContas}</div>
          <div className="hidden desk:block">{painelOrcamento}</div>
          <div className="hidden desk:block">{atalhoMetas}</div>
          <div className="hidden desk:block">{atalhoDividas}</div>
          <div className="hidden desk:block">{quaseLa}</div>
          <Painel titulo="O que dá para perceber">
            <ListaDePadroes padroes={padroesDeCompra(compras, agora)} sujeito="você estava" />
          </Painel>
          <Painel titulo="Em que horário você compra">
            <HorariosDeCompra horarios={comprasPorHorario(compras)} />
          </Painel>
          <Painel titulo="Para onde foi o dinheiro da semana">
            <DivisaoDoDinheiro {...divisaoPorNecessidade(semana.compras)} />
          </Painel>
        </div>
      </div>
    </>
  );
}
