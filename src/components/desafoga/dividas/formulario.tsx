"use client";

import { Banknote, Check, CreditCard, Landmark, Receipt, Trash2, Wallet, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { lerPercentual, lerValorEmReais } from "@/lib/dinheiro";
import type { Divida, TipoDivida } from "@/lib/finance";
import { servicos } from "@/services";
import { Painel, Sub } from "../ui/blocos";
import { Botao } from "../ui/botao";

const TIPOS: [TipoDivida, string, LucideIcon][] = [
  ["cartao", "Cartão", CreditCard],
  ["cheque", "Cheque especial", Landmark],
  ["emprestimo", "Empréstimo", Banknote],
  ["parcelamento", "Parcelado", Receipt],
  ["outra", "Outra", Wallet],
];

const CAMPO = "min-h-12 w-full rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 outline-none campo focus:border-primary";
const reaisEmTexto = (c: number) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");

/** Adicionar ou editar uma dívida. Os valores são convertidos pelo código, nunca adivinhados. */
export function FormularioDeDivida({ pessoaId, divida, fechar }: { pessoaId: string; divida: Divida | null; fechar: () => void }) {
  const [tipo, setTipo] = useState<TipoDivida>(divida?.tipo ?? "cartao");
  const [nome, setNome] = useState(divida?.nome ?? "");
  const [detalhe, setDetalhe] = useState(divida?.detalhe ?? "");
  const [saldo, setSaldo] = useState(reaisEmTexto(divida?.saldo ?? 0));
  const [taxa, setTaxa] = useState(divida ? String(Math.round(divida.taxaMensal * 1000) / 10).replace(".", ",") : "");
  const [minima, setMinima] = useState(reaisEmTexto(divida?.parcelaMinima ?? 0));
  const [vencimento, setVencimento] = useState(divida ? String(divida.vencimento) : "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const valorSaldo = lerValorEmReais(saldo);
    const valorTaxa = lerPercentual(taxa);
    const valorMinima = lerValorEmReais(minima) ?? 0;
    const dia = Number.parseInt(vencimento, 10);
    if (!nome.trim()) return setErro("Dê um nome para a dívida, por exemplo: Cartão do banco.");
    if (!valorSaldo) return setErro("Escreva quanto você deve hoje (saldo devedor).");
    if (valorTaxa === null || valorTaxa > 0.5) return setErro("Escreva os juros ao mês, por exemplo 14,2. Está na fatura ou no contrato como “juros ao mês” ou “CET”.");
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) return setErro("Escreva o dia do vencimento, de 1 a 31.");
    setSalvando(true);
    try {
      await servicos.dividas.salvar(pessoaId, {
        ...(divida ? { id: divida.id } : {}),
        tipo,
        nome: nome.trim(),
        detalhe: detalhe.trim(),
        saldo: valorSaldo,
        taxaMensal: valorTaxa,
        parcelaMinima: valorMinima,
        vencimento: dia,
      });
      fechar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui salvar.");
      setSalvando(false);
    }
  }

  async function remover() {
    if (!divida) return;
    setSalvando(true);
    await servicos.dividas.remover(pessoaId, divida.id);
    fechar();
  }

  return (
    <Painel titulo={divida ? "Editar dívida" : "Nova dívida"}>
      <form onSubmit={salvar} className="grid gap-3" noValidate>
        <fieldset className="min-w-0">
          <legend className="mb-1.5 font-bold">Tipo</legend>
          <div role="radiogroup" aria-label="Tipo de dívida" className="grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-2">
            {TIPOS.map(([valor, rotulo, Icone]) => {
              const marcado = tipo === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={marcado}
                  onClick={() => setTipo(valor)}
                  className="relative flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-1 py-2 text-center text-[0.78rem] leading-tight font-bold hover:border-primary aria-checked:border-primary aria-checked:bg-primary-soft"
                >
                  {marcado && (
                    <span aria-hidden="true" className="absolute top-1 right-1 grid size-[18px] place-items-center rounded-full bg-primary text-primary-ink">
                      <Check className="size-3" />
                    </span>
                  )}
                  <Icone aria-hidden="true" className={`size-5 ${marcado ? "text-primary" : "text-muted"}`} />
                  {rotulo}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label>
          <span className="mb-1 block font-bold">Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Cartão do banco" autoComplete="off" className={CAMPO} />
        </label>
        <label>
          <span className="mb-1 block font-bold">Detalhe (opcional)</span>
          <input value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="Ex.: final 4417, no rotativo" autoComplete="off" className={CAMPO} />
        </label>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
          <label>
            <span className="mb-1 block font-bold">Quanto deve hoje</span>
            <span className="flex items-center rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 caixa-de-campo focus-within:border-primary">
              <span aria-hidden="true" className="font-bold text-muted">R$</span>
              <input value={saldo} onChange={(e) => setSaldo(e.target.value)} inputMode="decimal" placeholder="0,00" className="min-h-11 w-full border-0 bg-transparent pl-2 outline-none" />
            </span>
          </label>
          <label>
            <span className="mb-1 block font-bold">Juros ao mês</span>
            <span className="flex items-center rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 caixa-de-campo focus-within:border-primary">
              <input value={taxa} onChange={(e) => setTaxa(e.target.value)} inputMode="decimal" placeholder="Ex.: 14,2" className="min-h-11 w-full border-0 bg-transparent outline-none" />
              <span aria-hidden="true" className="font-bold text-muted">%</span>
            </span>
          </label>
          <label>
            <span className="mb-1 block font-bold">Parcela mínima</span>
            <span className="flex items-center rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 caixa-de-campo focus-within:border-primary">
              <span aria-hidden="true" className="font-bold text-muted">R$</span>
              <input value={minima} onChange={(e) => setMinima(e.target.value)} inputMode="decimal" placeholder="0,00" className="min-h-11 w-full border-0 bg-transparent pl-2 outline-none" />
            </span>
          </label>
          <label>
            <span className="mb-1 block font-bold">Vence todo dia</span>
            <input value={vencimento} onChange={(e) => setVencimento(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="10" className={CAMPO} />
          </label>
        </div>
        <Sub>A taxa aparece na fatura ou no contrato como “juros ao mês” ou “CET”.</Sub>
        {erro && (
          <p role="alert" className="font-bold text-bad">
            {erro}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <Botao type="button" variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        </div>
        {divida && (
          <Botao type="button" variante="link" className="justify-self-start text-bad!" onClick={remover} disabled={salvando}>
            <Trash2 aria-hidden="true" />
            Remover esta dívida
          </Botao>
        )}
      </form>
    </Painel>
  );
}
