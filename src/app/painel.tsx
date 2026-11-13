"use client";

import { useEffect, useState } from "react";
import { formatarReais } from "@/lib/dinheiro";
import { NOME_DA_CATEGORIA } from "@/lib/luana/lancamentos";
import type { UsoDeHoje } from "@/lib/limite";
import type { MesDoPainel, Painel as DadosDoPainel } from "@/lib/luana/painel";
import { dataCurta, nomeDoMes } from "@/lib/luana/textos";
import { IconeVoltar } from "./icones";

type Dados = DadosDoPainel & { uso?: UsoDeHoje | null };

const NOME_DO_TIPO: Record<string, string> = {
  fatura_cartao: "Fatura de cartão",
  extrato_conta: "Extrato de conta",
  print_de_compras: "Print de compras",
  comprovante: "Comprovante",
  outro: "Documento",
};

/** Resumo geral: meses, categorias abertas por item e documentos enviados. */
export function Painel({ usuario, aoFechar }: { usuario: string; aoFechar: () => void }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/painel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const corpo: Dados = await r.json();
        if (vivo) setDados(corpo);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [usuario]);

  const vazio =
    dados &&
    dados.meses.length === 0 &&
    dados.documentos.length === 0 &&
    !dados.orcamento &&
    !dados.rendaMensal &&
    !dados.reserva;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center gap-2 border-b border-line px-2 py-3">
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Voltar para a conversa"
          title="Voltar para a conversa"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-accent-soft hover:text-accent"
        >
          <IconeVoltar />
        </button>
        <h1 className="text-lg font-semibold">Resumo geral</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {falhou && <p className="text-muted">Não consegui carregar o resumo agora. Volte e tente de novo.</p>}
        {!falhou && !dados && <p className="text-muted">Carregando…</p>}
        {vazio && (
          <p className="text-muted">
            Ainda não tenho nada anotado. Mande uma fatura, um extrato, escreva um gasto ou diga _prefiro contar_ na conversa.
          </p>
        )}

        {dados?.uso && <Uso uso={dados.uso} />}

        {dados && !vazio && (
          <div className="flex flex-col gap-6">
            {(dados.rendaMensal || dados.contasInformadas || dados.saldoEmConta !== null || dados.reserva) && (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {dados.rendaMensal && <Numero rotulo="Renda que você me disse" valor={dados.rendaMensal} />}
                {dados.contasInformadas && <Numero rotulo="Contas mensais que você citou" valor={dados.contasInformadas} />}
                {dados.saldoEmConta !== null && <Numero rotulo="Saldo em conta" valor={dados.saldoEmConta} />}
                {dados.reserva ? <Numero rotulo="Guardado à parte" valor={dados.reserva} /> : null}
              </dl>
            )}

            {dados.orcamento && <Orcamento orcamento={dados.orcamento} />}

            {dados.meses.map((m) => (
              <Mes key={m.referencia} mes={m} />
            ))}

            {dados.documentos.length > 0 && (
              <section>
                <h2 className="mb-2 text-base font-semibold">Documentos enviados</h2>
                <ul className="flex flex-col gap-2">
                  {dados.documentos.map((d, i) => (
                    <li key={i} className="rounded-xl bg-surface px-4 py-3 text-sm">
                      <p className="font-medium">
                        {NOME_DO_TIPO[d.tipo] ?? "Documento"}
                        {d.emissor ? ` · ${d.emissor}` : ""}
                      </p>
                      <p className="text-muted">
                        Recebido em {dataCurta(d.recebidoEm)} · {d.lancamentos}{" "}
                        {d.lancamentos === 1 ? "lançamento" : "lançamentos"}
                        {d.de && d.ate ? ` · de ${dataCurta(d.de)} a ${dataCurta(d.ate)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">
                  Os arquivos em si não ficam guardados, só os lançamentos lidos.
                </p>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Uso do dia: o da pessoa, o do site e como a cota gratuita da IA está respondendo. */
function Uso({ uso }: { uso: UsoDeHoje }) {
  const linhas = [
    { rotulo: "Mensagens", ...uso.voce.texto },
    { rotulo: "Arquivos", ...uso.voce.arquivo },
    { rotulo: "Áudios", ...uso.voce.audio },
    { rotulo: "Site inteiro", ...uso.site },
  ];
  return (
    <section className="mb-6 rounded-xl bg-surface px-4 py-3">
      <h2 className="text-base font-semibold">Uso de hoje</h2>
      <p className="mb-3 text-xs text-muted">Nível gratuito. Os limites zeram à meia-noite.</p>
      <ul className="flex flex-col gap-2">
        {linhas.map((l) => (
          <li key={l.rotulo}>
            <span className="flex justify-between text-sm">
              <span>{l.rotulo}</span>
              <span className="tabular-nums text-muted">
                {l.usados} de {l.limite}
              </span>
            </span>
            <span className="mt-1 block h-1.5 rounded-full bg-line" aria-hidden>
              <span
                className="block h-1.5 rounded-full bg-accent"
                style={{ width: `${Math.min(100, Math.round((l.usados / l.limite) * 100))}%` }}
              />
            </span>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-semibold">Cota gratuita da IA (Gemini)</h3>
      {uso.ia.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma leitura feita hoje.</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1 text-sm">
          {uso.ia.map((m) => (
            <li key={m.modelo} className="flex flex-wrap justify-between gap-x-3">
              <span>{m.modelo}</span>
              <span className="tabular-nums text-muted">
                {m.ok} {m.ok === 1 ? "resposta" : "respostas"}
                {m.semCota > 0 && ` · ${m.semCota} sem cota`}
                {m.falha > 0 && ` · ${m.falha} ${m.falha === 1 ? "falha" : "falhas"}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">
        O Google não informa quanto resta da cota gratuita. Aqui aparece o que aconteceu hoje: quando um
        modelo responde &quot;sem cota&quot;, a Luana passa para o seguinte.
      </p>
    </section>
  );
}

/** O mês contado de cabeça: previsto contra o que já foi anotado. */
function Orcamento({ orcamento }: { orcamento: NonNullable<DadosDoPainel["orcamento"]> }) {
  return (
    <section>
      <h2 className="text-base font-semibold">Previsto para {nomeDoMes(orcamento.referencia)}</h2>
      <p className="mb-2 text-xs text-muted">
        Valores que você me contou, sem conferir em extrato. O que você anota vai abatendo do previsto.
      </p>
      <dl className="mb-3 grid grid-cols-2 gap-3">
        <Numero rotulo="Deve sair no mês" valor={orcamento.esperado} />
        {orcamento.sobra !== null && (
          <Numero
            rotulo={orcamento.sobra >= 0 ? "Sobra prevista" : "Falta"}
            valor={Math.abs(orcamento.sobra)}
            destaque
          />
        )}
      </dl>
      <ul className="flex flex-col gap-2">
        {orcamento.linhas.map((l) => {
          const passou = l.realizado > l.previsto;
          return (
            <li key={l.grupo} className="rounded-xl bg-surface px-4 py-3">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 font-medium">
                  {l.itens.length === 1 ? l.itens[0].descricao : l.nome}
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatarReais(l.realizado)} <span className="text-muted">de {formatarReais(l.previsto)}</span>
                </span>
              </span>
              <span className="mt-2 block h-1.5 rounded-full bg-line" aria-hidden>
                <span
                  className="block h-1.5 rounded-full bg-accent"
                  style={{ width: `${Math.min(100, Math.round((l.realizado / l.previsto) * 100))}%` }}
                />
              </span>
              <span className="mt-1 block text-xs text-muted">
                {l.itens.length > 1 && `${l.itens.map((i) => `${i.descricao} ${formatarReais(i.valor)}`).join(" · ")}. `}
                {passou
                  ? `Passou ${formatarReais(l.realizado - l.previsto)} do previsto.`
                  : `Restam ${formatarReais(l.previsto - l.realizado)}.`}
              </span>
            </li>
          );
        })}
      </ul>
      {(orcamento.foraDoPlano > 0 || orcamento.encargos > 0) && (
        <p className="mt-2 text-sm text-muted">
          {orcamento.foraDoPlano > 0 && `Gastos fora do previsto: ${formatarReais(orcamento.foraDoPlano)}. `}
          {orcamento.encargos > 0 && `Juros, IOF e tarifas: ${formatarReais(orcamento.encargos)}.`}
        </p>
      )}
    </section>
  );
}

function Numero({ rotulo, valor, destaque = false }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className="rounded-xl bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${destaque ? "text-accent" : ""}`}>{formatarReais(valor)}</dd>
    </div>
  );
}

function Mes({ mes }: { mes: MesDoPainel }) {
  const nome = nomeDoMes(mes.referencia);
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold first-letter:uppercase">{nome}</h2>
      <dl className="mb-3 grid grid-cols-3 gap-3">
        <Numero rotulo="Entrou" valor={mes.entradas} />
        <Numero rotulo="Saiu" valor={mes.gastos + mes.encargos} />
        {mes.saldo === null ? (
          <div className="rounded-xl bg-surface px-4 py-3">
            <dt className="text-xs text-muted">Sobrou</dt>
            <dd className="text-sm text-muted">sem entradas anotadas</dd>
          </div>
        ) : (
          <Numero rotulo={mes.saldo >= 0 ? "Sobrou" : "Faltou"} valor={Math.abs(mes.saldo)} destaque />
        )}
      </dl>

      {mes.categorias.length > 0 && (
        <ul className="flex flex-col gap-2">
          {mes.categorias.map((c) => (
            <li key={c.categoria}>
              <details className="rounded-xl bg-surface px-4 py-3">
                <summary className="cursor-pointer list-none">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{NOME_DA_CATEGORIA[c.categoria]}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatarReais(c.total)} <span className="text-sm text-muted">({c.percentual}%)</span>
                    </span>
                  </span>
                  <span className="mt-2 block h-1.5 rounded-full bg-line" aria-hidden>
                    <span
                      className="block h-1.5 rounded-full bg-accent"
                      style={{ width: `${Math.max(c.percentual, 2)}%` }}
                    />
                  </span>
                </summary>
                <ul className="mt-3 flex flex-col gap-1 text-sm">
                  {c.itens.map((item) => (
                    <li key={item.descricao} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {item.descricao}
                        {item.quantidade > 1 ? <span className="text-muted"> ×{item.quantidade}</span> : null}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatarReais(item.total)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}

      {(mes.encargos > 0 || mes.faturasPagas > 0) && (
        <p className="mt-2 text-sm text-muted">
          {mes.encargos > 0 && `Juros, IOF e tarifas: ${formatarReais(mes.encargos)}. `}
          {mes.faturasPagas > 0 &&
            `Fatura de cartão paga pela conta: ${formatarReais(mes.faturasPagas)} (fora das saídas, para não contar duas vezes).`}
        </p>
      )}
    </section>
  );
}
