"use client";

import { ChevronRight, Plus, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useAgora } from "@/hooks/use-agora";
import { usePessoa } from "@/hooks/use-pessoa";
import {
  chaveDoDia,
  comprasDoDia,
  encargosDasFaturas,
  jurosMensaisTotais,
  notaMedia,
  padroesDeCompra,
  resumoDaSemana,
  somaDosValores,
} from "@/lib/finance";
import { dataPorExtenso, reais } from "@/lib/formatar";
import { FaixaDaSemana, LinhaDeCompra, ListaDePadroes, NotaDoDia } from "../emocao";
import { useMinhaPessoaId } from "../sessao";
import { Carregando, Painel, Sub, Vazio } from "../ui/blocos";
import { BotaoLink } from "../ui/botao";

export function TelaHoje() {
  const pessoaId = useMinhaPessoaId();
  const dados = usePessoa(pessoaId);
  const agora = useAgora();
  if (!dados || !agora) return <Carregando />;

  const { persona, compras, dividas, faturas } = dados;
  const deHoje = comprasDoDia(compras, chaveDoDia(agora)).reverse();
  const semana = resumoDaSemana(compras, agora);
  const encargos = encargosDasFaturas(faturas).total || jurosMensaisTotais(dividas);

  const registrar = (
    <BotaoLink href="/app/registrar" tamanho="grande" bloco>
      <Plus aria-hidden="true" />
      Registrar compra
    </BotaoLink>
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
          <NotaDoDia nota={notaMedia(deHoje)} quantidade={deHoje.length} sujeito="você estava" />
          <div className="grid gap-4 desk:hidden">
            {registrar}
            {atalhoDividas}
          </div>
          {listaDeHoje}
          <Painel titulo="Sua semana" className="hidden desk:block">
            <FaixaDaSemana dias={semana.dias} agora={agora} sujeito="você estava" />
          </Painel>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <Painel titulo="Comprou algo agora?" className="hidden desk:block">
            <Sub className="mb-3.5">Leva menos de 30 segundos. Também dá para mandar para a Luana pelo WhatsApp.</Sub>
            {registrar}
          </Painel>
          <div className="hidden desk:block">{atalhoDividas}</div>
          <Painel titulo="O que dá para perceber">
            <ListaDePadroes padroes={padroesDeCompra(compras, agora)} sujeito="você estava" />
          </Painel>
        </div>
      </div>
    </>
  );
}
