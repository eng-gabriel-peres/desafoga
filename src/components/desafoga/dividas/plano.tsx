"use client";

import { Calculator, Minus, Plus, Send } from "lucide-react";
import { useState } from "react";
import { lerValorEmReais } from "@/lib/dinheiro";
import { simularQuitacao, somaDosMinimos, type Divida, type Estrategia } from "@/lib/finance";
import { NOME_DA_ESTRATEGIA, mesDaqui, meses } from "@/lib/assistente/textos";
import { reais } from "@/lib/formatar";
import type { Plano } from "@/services";
import { AvisoEducativo, Chip, Opcao, Painel, Sub } from "../ui/blocos";
import { Botao, BotaoIcone } from "../ui/botao";
import { GraficoSaldo } from "./grafico-saldo";

const PASSO = 5000;
const ATALHOS = [0, 10000, 20000, 50000];

/** Resultado da simulação: livre em, juros até lá, economia, gráfico e ordem. */
function Resultado({ dividas, valor, estrategia, agora }: { dividas: Divida[]; valor: number; estrategia: Estrategia; agora: Date }) {
  const r = simularQuitacao(dividas, valor, estrategia);
  const soMinimo = simularQuitacao(dividas, somaDosMinimos(dividas), estrategia);
  const economia = Math.max(0, soMinimo.jurosTotal - r.jurosTotal);
  const nome = (id: string) => dividas.find((d) => d.id === id)?.nome ?? id;

  return (
    <div aria-live="polite">
      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface2 p-3.5 text-center">
        <div>
          <dt className="text-[0.82rem] text-muted">Livre das dívidas em</dt>
          <dd className="mt-1 text-[1.2rem] leading-tight font-bold">{r.quitavel ? meses(r.meses) : "mais de 30 anos"}</dd>
          {r.quitavel && <dd className="text-[0.8rem] text-muted">{mesDaqui(agora, r.meses)}</dd>}
        </div>
        <div>
          <dt className="text-[0.82rem] text-muted">Juros até lá</dt>
          <dd className="mt-1 text-[1.2rem] leading-tight font-bold">{reais(r.jurosTotal)}</dd>
        </div>
        <div>
          <dt className="text-[0.82rem] text-muted">Economia contra o mínimo</dt>
          <dd className="mt-1 text-[1.2rem] leading-tight font-bold text-good">{reais(economia)}</dd>
        </div>
      </dl>
      {r.quitavel && <GraficoSaldo linhaDoTempo={r.linhaDoTempo} agora={agora} />}
      {r.ordemDeQuitacao.length > 0 && (
        <>
          <h3 className="mt-4 mb-1 font-bold">Ordem de quitação</h3>
          <ol className="list-none">
            {r.ordemDeQuitacao.map((id, i) => (
              <li key={id} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-[0.85rem] font-bold text-primary">
                  {i + 1}
                </span>
                <span className="flex-1">{nome(id)}</span>
                <span className="text-[0.88rem] text-muted">quitada em {meses(r.quitadaNoMes[id])}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      <AvisoEducativo />
    </div>
  );
}

/** Plano editável da pessoa: valor mensal e estratégia. */
export function PlanoEditavel({
  dividas,
  plano,
  agora,
  aoMudar,
}: {
  dividas: Divida[];
  plano: Plano;
  agora: Date;
  aoMudar: (m: Partial<Pick<Plano, "valorMensal" | "estrategia">>) => void;
}) {
  const minimo = somaDosMinimos(dividas);
  const valor = Math.max(plano.valorMensal, minimo);
  const extra = valor - minimo;
  return (
    <Painel titulo="Plano para sair das dívidas" acao={<Calculator aria-hidden="true" className="size-5 text-muted" />}>
      {plano.valorSugerido !== null && plano.valorSugerido !== valor && (
        <p className="mb-3 rounded-xl bg-primary-soft px-3.5 py-2.5 text-[0.95rem]">
          Sugestão de quem te acompanha: <b>{reais(plano.valorSugerido)}</b> por mês.{" "}
          <button type="button" onClick={() => aoMudar({ valorMensal: plano.valorSugerido ?? valor })} className="min-h-11 font-bold text-primary underline">
            Usar esse valor
          </button>
        </p>
      )}
      <fieldset>
        <legend className="mb-1.5 font-bold">Quanto você consegue pagar por mês, somando todas?</legend>
        <div className="flex items-center gap-3">
          <BotaoIcone aria-label="Diminuir R$ 50" onClick={() => aoMudar({ valorMensal: Math.max(minimo, valor - PASSO) })} disabled={valor <= minimo}>
            <Minus aria-hidden="true" />
          </BotaoIcone>
          <div className="flex-1 text-center">
            <b className="block text-[1.6rem] leading-tight" aria-live="polite">
              {reais(valor)}
            </b>
            <Sub>{extra > 0 ? `${reais(extra)} a mais que o mínimo` : "só o mínimo"}</Sub>
          </div>
          <BotaoIcone aria-label="Aumentar R$ 50" onClick={() => aoMudar({ valorMensal: valor + PASSO })}>
            <Plus aria-hidden="true" />
          </BotaoIcone>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ATALHOS.map((a) => (
            <Chip key={a} pequeno marcado={valor === minimo + a} onClick={() => aoMudar({ valorMensal: minimo + a })}>
              {a ? `+${reais(a).replace(",00", "")}` : "Mínimo"}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div className="mt-4">
        <p id="estrategia" className="mb-1.5 font-bold">
          Por onde começar
        </p>
        <div role="radiogroup" aria-labelledby="estrategia" className="grid gap-2">
          <Opcao marcada={plano.estrategia === "mais-cara"} onClick={() => aoMudar({ estrategia: "mais-cara" })} titulo="Mais cara primeiro" descricao="Paga menos juros" />
          <Opcao marcada={plano.estrategia === "menor"} onClick={() => aoMudar({ estrategia: "menor" })} titulo="Menor primeiro" descricao="Vê resultado mais rápido" />
        </div>
      </div>
      <Resultado dividas={dividas} valor={valor} estrategia={plano.estrategia} agora={agora} />
    </Painel>
  );
}

/** Plano só para leitura (responsável), com "Sugerir valor mensal". */
export function PlanoLeitura({
  dividas,
  plano,
  agora,
  apelido,
  sugerir,
}: {
  dividas: Divida[];
  plano: Plano;
  agora: Date;
  apelido: string;
  sugerir: (valor: number) => Promise<void>;
}) {
  const minimo = somaDosMinimos(dividas);
  const valor = Math.max(plano.valorMensal, minimo);
  const [texto, setTexto] = useState(String(valor / 100).replace(".", ","));
  const [estado, setEstado] = useState<"" | "enviando" | "enviado" | "erro">("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const sugerido = lerValorEmReais(texto);
    if (!sugerido || sugerido < minimo) {
      setEstado("erro");
      return;
    }
    setEstado("enviando");
    await sugerir(sugerido);
    setEstado("enviado");
  }

  return (
    <Painel titulo="Plano para sair das dívidas" acao={<Calculator aria-hidden="true" className="size-5 text-muted" />}>
      <p>
        {apelido} escolheu pagar <b>{reais(valor)}</b> por mês, {NOME_DA_ESTRATEGIA[plano.estrategia]}.
        {plano.valorSugerido !== null && ` Sugestão enviada: ${reais(plano.valorSugerido)}.`}
      </p>
      <form onSubmit={enviar} className="mt-3 flex flex-wrap items-end gap-2.5">
        <label className="min-w-[10rem] flex-1">
          <span className="mb-1 block text-[0.92rem] font-bold">Sugerir valor mensal</span>
          <span className="flex min-h-12 items-center rounded-xl border-2 border-line bg-surface px-3 focus-within:border-primary">
            <span aria-hidden="true" className="font-bold text-muted">
              R$
            </span>
            <input
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setEstado("");
              }}
              inputMode="decimal"
              autoComplete="off"
              aria-describedby="sugestao-ajuda"
              className="w-full border-0 bg-transparent pl-2 font-bold outline-none"
            />
          </span>
        </label>
        <Botao type="submit" variante="secundario" tamanho="pequeno" className="min-h-12" disabled={estado === "enviando"}>
          <Send aria-hidden="true" />
          Sugerir valor mensal
        </Botao>
      </form>
      <p id="sugestao-ajuda" className="mt-1.5 text-[0.85rem] text-muted">
        Mínimo de {reais(minimo)}, a soma das parcelas mínimas.
      </p>
      <div role="status" aria-live="polite">
        {estado === "enviado" && (
          <p className="mt-2.5 rounded-xl bg-good-soft px-3.5 py-2.5 font-bold text-good">
            Sugestão enviada. {apelido} recebe o aviso no app e uma mensagem da Luana.
          </p>
        )}
        {estado === "erro" && <p className="mt-2.5 font-bold text-bad">Escreva um valor de pelo menos {reais(minimo)}.</p>}
      </div>
      <Resultado dividas={dividas} valor={valor} estrategia={plano.estrategia} agora={agora} />
    </Painel>
  );
}
