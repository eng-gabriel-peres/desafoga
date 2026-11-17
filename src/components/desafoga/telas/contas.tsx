"use client";

import { Lock, Plus } from "lucide-react";
import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { usePessoa } from "@/hooks/use-pessoa";
import { compromissosDoMes, contasPorCategoria, gruposDeVencimento, totaisDoMes, type ContaFixa } from "@/lib/finance";
import {
  CalendarioDoMes,
  ContasPorCategoria,
  FormularioDeConta,
  LinhaDeVencimento,
  ResumoDasContas,
} from "../contas";
import type { Area } from "../moldura/navegacao";
import { BancosConectados } from "../banco/bancos-conectados";
import { ComprasParceladas } from "../banco/parcelada";
import { useEu, usePessoaDaSessao } from "../sessao";
import { Carregando, Painel, Sub, TituloCelular } from "../ui/blocos";
import { Botao } from "../ui/botao";
import { Janela } from "../ui/janela";

/** Contas do mês: o que a pessoa paga todo mês e quando vence. O profissional vê só leitura, se a pessoa deixou. */
export function TelaContas({ area = "pessoa", pessoaId: doPainel }: { area?: Area; pessoaId?: string }) {
  const minha = usePessoaDaSessao();
  const eu = useEu();
  const pessoaId = doPainel ?? minha ?? "";
  const dados = usePessoa(pessoaId);
  const agora = useAgora();
  const [dia, setDia] = useState<number | null>(null);
  /** null: lista; "nova" ou a conta sendo editada: formulário. */
  const [editando, setEditando] = useState<ContaFixa | "nova" | null>(null);
  if (!dados || !agora) return <Carregando />;

  const somenteLeitura = area === "responsavel";
  const { contas, dividas, plano, persona } = dados;

  if (!contas.compartilhadas) {
    return (
      <Painel>
        <div className="grid justify-items-center gap-2 py-6 text-center">
          <Lock aria-hidden="true" className="size-8 text-muted" />
          <h2 className="text-[1.15rem] font-bold">{persona.apelido} não compartilhou as contas</h2>
          <Sub>A pessoa decide em Rotina e privacidade se quem acompanha pode ver as contas fixas e a renda.</Sub>
        </div>
      </Painel>
    );
  }

  const compromissos = compromissosDoMes(contas.contas, dividas, plano, contas.pagamentos, agora);
  const totais = totaisDoMes(compromissos, contas.renda);
  const visiveis = dia === null ? compromissos : compromissos.filter((c) => c.dia === dia);
  const grupos = gruposDeVencimento(visiveis, agora);
  const contaPorId = new Map(contas.contas.map((c) => [c.id, c]));

  return (
    <>
      {!somenteLeitura && (
        <Janela aberta={editando !== null} fechar={() => setEditando(null)} rotulo={editando === "nova" ? "Nova conta fixa" : "Editar conta fixa"}>
          {editando && (
            <FormularioDeConta
              key={editando === "nova" ? "nova" : editando.id}
              pessoaId={pessoaId}
              conta={editando === "nova" ? null : editando}
              fechar={() => setEditando(null)}
            />
          )}
        </Janela>
      )}
      {!somenteLeitura && <TituloCelular titulo="Contas do mês" subtitulo="O que você paga todo mês e quando vence" />}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] desk:gap-5">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <ResumoDasContas pessoaId={pessoaId} totais={totais} renda={contas.renda} agora={agora} somenteLeitura={somenteLeitura} />
          <Painel
            titulo={dia === null ? "Vencimentos" : `Dia ${dia}`}
            acao={
              !somenteLeitura && (
                <Botao variante="secundario" tamanho="pequeno" onClick={() => setEditando("nova")}>
                  <Plus aria-hidden="true" />
                  Adicionar
                </Botao>
              )
            }
          >
            {grupos.length ? (
              grupos.map((g) => (
                <section key={g.titulo} aria-label={g.titulo} className="mt-1">
                  <h3 className={`mt-2 text-[0.85rem] font-bold tracking-wide uppercase ${g.titulo === "Vencidas" ? "text-bad" : "text-muted"}`}>{g.titulo}</h3>
                  <ul>
                    {g.itens.map((c) => {
                      const conta = c.tipo === "conta" ? contaPorId.get(c.id) : undefined;
                      return (
                        <LinhaDeVencimento
                          key={`${c.tipo}-${c.id}`}
                          pessoaId={pessoaId}
                          c={c}
                          agora={agora}
                          somenteLeitura={somenteLeitura}
                          editar={conta ? () => setEditando(conta) : undefined}
                        />
                      );
                    })}
                  </ul>
                </section>
              ))
            ) : (
              <p className="rounded-[18px] border-2 border-dashed border-line p-5 text-center text-muted">
                {somenteLeitura ? "Nenhuma conta fixa cadastrada." : "Nenhuma conta fixa ainda. Cadastre aluguel, luz, água, internet e o que você paga todo mês."}
              </p>
            )}
          </Painel>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {(!somenteLeitura || dados.banco.conexoes.length > 0) && (
            <BancosConectados pessoaId={pessoaId} dados={dados.banco} demo={eu.demo} agora={agora} somenteLeitura={somenteLeitura} />
          )}
          <ComprasParceladas pessoaId={pessoaId} parceladas={dados.banco.parceladas} agora={agora} somenteLeitura={somenteLeitura} />
          <CalendarioDoMes compromissos={compromissos} agora={agora} dia={dia} escolher={setDia} />
          <ContasPorCategoria grupos={contasPorCategoria(contas.contas)} />
        </div>
      </div>
    </>
  );
}
