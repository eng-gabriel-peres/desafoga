"use client";

import { Plus } from "lucide-react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { servicos, type SalaDoEvento } from "@/services";
import { CartaoDoEvento, CartaoDoMeuEvento } from "../eventos/cartoes";
import { useMinhaPessoaId } from "../sessao";
import { Carregando, Vazio } from "../ui/blocos";
import { BotaoLink } from "../ui/botao";

const GRADE = "grid gap-3 desk:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] desk:gap-4";

/** Eventos de que a pessoa participa. */
export function TelaEventos() {
  const pessoaId = useMinhaPessoaId();
  const lista = useConsulta("eventos", () => servicos.eventos.listar());
  const agora = useAgora();
  if (!lista || !agora) return <Carregando />;
  return (
    <>
      <div className="mb-4 desk:hidden">
        <h1 className="text-[1.7rem] leading-tight font-bold">Eventos</h1>
        <p className="mt-0.5 text-muted">Desafios e encontros de que você participa</p>
      </div>
      {lista.length ? (
        <div className={GRADE}>
          {lista.map((e) => (
            <CartaoDoMeuEvento key={e.id} evento={e} pessoaId={pessoaId} agora={agora} />
          ))}
        </div>
      ) : (
        <Vazio>Você ainda não está em nenhum evento.</Vazio>
      )}
    </>
  );
}

/** Eventos do profissional: os ativos e os encerrados. */
export function TelaEventosDoProfissional() {
  const lista = useConsulta("eventos", () => servicos.eventos.listar());
  if (!lista) return <Carregando />;
  const ativos = lista.filter((e) => e.situacao.fase !== "fim");
  const encerrados = lista.filter((e) => e.situacao.fase === "fim");
  const grade = (l: SalaDoEvento[]) => (
    <div className={GRADE}>
      {l.map((e) => (
        <CartaoDoEvento key={e.id} evento={e} />
      ))}
    </div>
  );
  return (
    <>
      <div className="mb-4 desk:hidden">
        <h1 className="text-[1.7rem] leading-tight font-bold">Eventos</h1>
        <p className="mt-0.5 text-muted">Desafios em grupo e encontros presenciais</p>
      </div>
      <BotaoLink href="/painel/eventos/novo" className="mb-4">
        <Plus aria-hidden="true" />
        Criar evento
      </BotaoLink>
      {ativos.length ? grade(ativos) : <Vazio>Nenhum evento ativo. Crie um desafio em grupo ou um encontro presencial.</Vazio>}
      {encerrados.length > 0 && (
        <>
          <h2 className="mt-6 mb-2.5 text-[1.12rem] font-bold">Encerrados</h2>
          {grade(encerrados)}
        </>
      )}
    </>
  );
}
