"use client";

import { Check, LogIn, MapPin, Trophy } from "lucide-react";
import Link from "next/link";
import type { SalaDoEvento } from "@/services";
import { Sub } from "../ui/blocos";
import { BotaoLink } from "../ui/botao";
import { Barra } from "../ui/campos";
import { Bolinhas, ConviteDoEvento, EtiquetaDaFase, hojeNoBrasil, IconeDoEvento, LinhasDoEvento, nomeDoTipo, PilhaDeAvatares, quandoDoEvento, regraDoEvento, VoceVai } from "./visual";

function Topo({ evento: e, detalhe }: { evento: SalaDoEvento; detalhe: string }) {
  return (
    <div className="flex items-start gap-3">
      <IconeDoEvento evento={e} />
      <div className="min-w-0 flex-1">
        <h3 className="text-[1.05rem] leading-tight font-bold">{e.nome}</h3>
        <p className="text-[0.88rem] text-muted">{detalhe}</p>
      </div>
      <EtiquetaDaFase evento={e} />
    </div>
  );
}

/** Cartão do evento na lista do profissional. */
export function CartaoDoEvento({ evento: e }: { evento: SalaDoEvento }) {
  const vao = e.participantes.filter((p) => p.resposta === "vou").length;
  const semResposta = e.participantes.filter((p) => !p.resposta).length;
  return (
    <Link href={`/painel/eventos/${e.id}`} className="entrar block rounded-[var(--radius-card)] border border-line bg-surface p-4 hover:border-primary">
      <Topo evento={e} detalhe={nomeDoTipo(e)} />
      <LinhasDoEvento evento={e} />
      <div className="mt-3 flex items-center gap-2">
        <PilhaDeAvatares participantes={e.participantes} />
        <span className="text-[0.88rem] text-muted">
          {e.pessoasNoGrupo} {e.pessoasNoGrupo === 1 ? "pessoa" : "pessoas"}
          {e.participantes.length > e.pessoasNoGrupo && `, ${e.participantes.length - e.pessoasNoGrupo} com convite pendente`}
        </span>
      </div>
      {e.tipo === "desafio" ? (
        <div className="mt-3">
          <Barra fracao={(e.grupo ?? 0) / 100} tom="primaria" />
          <Sub className="mt-1">{e.grupo === null ? "Ainda sem dias para contar" : `O grupo cumpriu ${e.grupo}% dos dias até agora`}</Sub>
        </div>
      ) : (
        <Sub className="mt-2.5">
          {vao} confirmadas, {semResposta} sem resposta
        </Sub>
      )}
    </Link>
  );
}

/** Cartão do evento na lista da pessoa: os próprios dias, a posição e "Você vai?". */
export function CartaoDoMeuEvento({ evento: e, pessoaId, agora }: { evento: SalaDoEvento; pessoaId: string; agora: Date }) {
  const hoje = hojeNoBrasil(agora);
  const meu = e.andamento.find((a) => a.pessoaId === pessoaId);
  const eu = e.participantes.find((p) => p.pessoaId === pessoaId);
  const posicao = e.ranking?.find((r) => r.pessoaId === pessoaId);
  const hojeOk = meu?.dias.find((d) => d.dia === hoje)?.estado;
  if (e.convitePendente) {
    return (
      <article className="entrar rounded-[var(--radius-card)] border-2 border-primary bg-surface p-4">
        <Topo evento={e} detalhe={quandoDoEvento(e)} />
        {e.descricao && <p className="mt-2.5 text-[0.95rem]">{e.descricao}</p>}
        <LinhasDoEvento evento={e} semData />
        <ConviteDoEvento evento={e} />
      </article>
    );
  }
  return (
    <article className="entrar rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <Topo evento={e} detalhe={quandoDoEvento(e)} />
      {e.tipo === "desafio" ? (
        <>
          <p className="mt-2.5 text-[0.92rem]">{regraDoEvento(e)}</p>
          {meu && (
            <div className="mt-2.5">
              <Bolinhas dias={meu.dias} hoje={hoje} />
            </div>
          )}
          {e.situacao.fase === "agora" &&
            (hojeOk === "ok" ? (
              <p className="mt-2 flex items-center gap-1.5 font-bold text-good">
                <Check aria-hidden="true" className="size-4" /> Hoje você está dentro da regra.
              </p>
            ) : hojeOk === "fora" ? (
              <p className="mt-2 font-bold text-maybe">Hoje ficou fora da regra. Amanhã é um novo dia.</p>
            ) : null)}
          {posicao && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.9rem] text-muted">
              <Trophy aria-hidden="true" className="size-4" /> Você está em {posicao.posicao}º de {e.ranking!.length}, com {posicao.pontos} pontos.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-2.5 flex items-start gap-2 text-[0.92rem]">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
            {e.local}
          </p>
          <p className="mt-3 mb-1.5 font-bold">Você vai?</p>
          <VoceVai evento={e} atual={eu?.resposta ?? null} />
        </>
      )}
      <BotaoLink href={`/app/eventos/${e.id}`} bloco tamanho="pequeno" className="mt-3.5">
        <LogIn aria-hidden="true" />
        Entrar no evento
        {e.totalDePosts > 0 && <span className="rounded-full bg-primary-ink/20 px-2 text-[0.8rem]">{e.totalDePosts} no mural</span>}
      </BotaoLink>
    </article>
  );
}
