"use client";

import { Check, Circle, Pencil } from "lucide-react";
import { useState } from "react";
import type { Categoria } from "@/lib/finance";
import { reais } from "@/lib/formatar";
import { servicos, type CompraParcelada } from "@/services";
import { CATEGORIAS } from "../categorias";
import { Etiqueta, Painel, Sub } from "../ui/blocos";
import { Botao } from "../ui/botao";
import { Janela } from "../ui/janela";
import { nomeDaLoja } from "./compras-para-revisar";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
const nomeDoMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
const mesesEntre = (de: string, ate: string) => {
  const [a, m] = de.split("-").map(Number);
  const [b, n] = ate.split("-").map(Number);
  return (b - a) * 12 + (n - m);
};

/** Compras parceladas em Contas: uma linha por compra, com as parcelas pagas e as que faltam. */
export function ComprasParceladas({ pessoaId, parceladas, agora, somenteLeitura }: { pessoaId: string; parceladas: CompraParcelada[]; agora: Date; somenteLeitura?: boolean }) {
  const [editando, setEditando] = useState<CompraParcelada | null>(null);
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const ativas = parceladas.filter((p) => mesesEntre(p.mesDaPrimeira, mesAtual) < p.totalParcelas);
  if (!ativas.length) return null;
  return (
    <Painel titulo="Compras parceladas">
      <ul>
        {ativas.map((p) => {
          // Cobradas: até a parcela deste mês (ou a maior que o banco ou a fatura já mostrou).
          const cobradas = Math.min(p.totalParcelas, Math.max(0, mesesEntre(p.mesDaPrimeira, mesAtual) + 1, ...p.parcelasVistas));
          const ultima = somarMeses(p.mesDaPrimeira, p.totalParcelas - 1);
          const nome = p.nome === p.lojaOriginal ? nomeDaLoja(p.nome) : p.nome;
          return (
            <li key={p.id} className="border-b border-line py-3 last:border-0">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{nome}</p>
                  <p className="text-[0.85rem] text-muted">
                    {nomeDaLoja(p.lojaOriginal)} · comprado {p.compradaEmEstimada ? "por volta de " : "em "}
                    {nomeDoMes(p.compradaEm.slice(0, 7))} · {reais(p.valorTotal)} em {p.totalParcelas}x de {reais(p.valorParcela)}
                  </p>
                  <p className="mt-0.5 text-[0.85rem]">
                    Cobradas {cobradas} · faltam {p.totalParcelas - cobradas} · última na fatura de {nomeDoMes(ultima)}
                  </p>
                </div>
                <Etiqueta tom="neutra">{p.fonte === "pluggy" ? "do banco" : "da fatura"}</Etiqueta>
                {!somenteLeitura && (
                  <button type="button" aria-label={`Renomear ${nome}`} onClick={() => setEditando(p)} className="grid size-9 place-items-center rounded-full hover:bg-surface2">
                    <Pencil aria-hidden="true" className="size-4" />
                  </button>
                )}
              </div>
              <ol aria-label={`Parcelas de ${nome}`} className="mt-2 flex flex-wrap gap-1">
                {Array.from({ length: p.totalParcelas }, (_, i) => {
                  const mes = somarMeses(p.mesDaPrimeira, i);
                  const paga = i < cobradas;
                  return (
                    <li key={i} title={`${i + 1}ª parcela, ${nomeDoMes(mes)}${paga ? ", cobrada" : ""}`} className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.72rem] ${paga ? "bg-good-soft text-good" : "bg-surface2 text-muted"}`}>
                      {paga ? <Check aria-hidden="true" className="size-3" /> : <Circle aria-hidden="true" className="size-2.5" />}
                      {nomeDoMes(mes).slice(0, 3)}
                      <span className="sr-only">{paga ? " cobrada" : " a cobrar"}</span>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ul>
      <Janela aberta={editando !== null} fechar={() => setEditando(null)} rotulo="Renomear compra parcelada">
        {editando && <Renomear key={editando.id} pessoaId={pessoaId} parcelada={editando} fechar={() => setEditando(null)} />}
      </Janela>
    </Painel>
  );
}

function Renomear({ pessoaId, parcelada, fechar }: { pessoaId: string; parcelada: CompraParcelada; fechar: () => void }) {
  const [nome, setNome] = useState(parcelada.nome === parcelada.lojaOriginal ? nomeDaLoja(parcelada.nome) : parcelada.nome);
  const [categoria, setCategoria] = useState<Categoria>(parcelada.categoria);
  const [salvando, setSalvando] = useState(false);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!nome.trim()) return;
        setSalvando(true);
        await servicos.banco.renomearParcelada(pessoaId, parcelada.id, nome.trim(), categoria);
        setSalvando(false);
        fechar();
      }}
    >
      <h2 className="text-[1.3rem] font-bold">Renomear compra parcelada</h2>
      <Sub>Vale para todas as {parcelada.totalParcelas} parcelas, inclusive as que ainda vão chegar.</Sub>
      <label className="grid gap-1.5">
        <span className="font-bold">Nome</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={80}
          className="campo min-h-12 rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 outline-none focus:border-primary"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="font-bold">Tipo</span>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as Categoria)}
          className="campo min-h-12 rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3 outline-none focus:border-primary"
        >
          {CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={fechar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={salvando || !nome.trim()}>
          Salvar
        </Botao>
      </div>
    </form>
  );
}
