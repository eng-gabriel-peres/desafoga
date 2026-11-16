"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { lerValorEmReais } from "@/lib/dinheiro";
import { situacaoDaMeta, type Meta } from "@/lib/finance";
import { reaisCurto } from "@/lib/assistente/textos";
import { servicos } from "@/services";
import { Botao } from "../ui/botao";

const emTexto = (c: number) => (c / 100).toFixed(2).replace(".", ",").replace(/,00$/, "");

/**
 * "Quanto você guardou?": a transferência da conta para a meta é anotada
 * uma vez só e já conta. Atalhos: o valor do plano, 10, 50 e 100.
 */
export function CaixaDeDeposito({
  pessoaId,
  meta,
  fechar,
  aoGuardar,
}: {
  pessoaId: string;
  meta: Meta;
  fechar: () => void;
  aoGuardar: (mensagem: string) => void;
}) {
  const [valor, setValor] = useState(emTexto(meta.valorPorPeriodo));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const atalhos = [...new Set([meta.valorPorPeriodo, 1000, 5000, 10000])].filter((v) => v > 0);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const v = lerValorEmReais(valor);
    if (!v) return setErro("Digite quanto você guardou.");
    setSalvando(true);
    try {
      const depois = await servicos.metas.guardar(pessoaId, meta.id, { valor: v, descricao: "Guardado" });
      const s = situacaoDaMeta(depois, new Date());
      aoGuardar(s.concluida ? `Meta completa: ${meta.nome}!` : `${reaisCurto(v)} guardados em ${meta.nome}. Faltam ${reaisCurto(s.falta)}.`);
      fechar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui guardar.");
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="mt-3.5 border-t border-line pt-3.5" noValidate>
      <label>
        <span className="mb-1 block font-bold">Quanto você guardou?</span>
        <span className="flex items-center rounded-2xl border-2 border-line bg-surface px-4 caixa-de-campo focus-within:border-primary">
          <b aria-hidden="true" className="text-[1.3rem] text-muted">
            R$
          </b>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            aria-label="Valor guardado"
            className="min-h-13 w-full border-0 bg-transparent pl-2 text-[1.3rem] font-bold outline-none focus-visible:outline-none"
          />
        </span>
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {atalhos.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setValor(emTexto(v))}
            className="inline-flex min-h-9 items-center rounded-full border-2 border-line bg-surface px-3 text-[0.82rem] font-bold whitespace-nowrap hover:border-primary"
          >
            {reaisCurto(v)}
          </button>
        ))}
      </div>
      {erro && (
        <p role="alert" className="mt-2 font-bold text-bad">
          {erro}
        </p>
      )}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <Botao type="button" variante="secundario" tamanho="pequeno" onClick={fechar}>
          Cancelar
        </Botao>
        <Botao type="submit" tamanho="pequeno" disabled={salvando}>
          <Check aria-hidden="true" />
          Guardar
        </Botao>
      </div>
    </form>
  );
}
