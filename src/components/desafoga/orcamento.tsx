"use client";

import { Check, Info, PencilLine, Plus, X } from "lucide-react";
import { useState } from "react";
import type { Categoria, EstadoDoOrcamento, SituacaoDoOrcamento } from "@/lib/finance";
import { explicarOrcamento, reaisCurto } from "@/lib/assistente/textos";
import { lerValorEmReais } from "@/lib/dinheiro";
import { servicos } from "@/services";
import { ICONE_DA_CATEGORIA } from "./categorias";
import { Anel } from "./metas/visual";
import { Botao } from "./ui/botao";

/** Cor dos textos (contraste AA). */
export const COR_DO_ESTADO: Record<EstadoDoOrcamento, string> = {
  tranquilo: "var(--good)",
  atencao: "var(--maybe)",
  estourou: "var(--bad)",
};

/** Cor dos anéis e ícones: no "atenção", um âmbar mais vivo que o do texto. */
export const COR_DO_ANEL: Record<EstadoDoOrcamento, string> = {
  tranquilo: "var(--good)",
  atencao: "var(--e4)",
  estourou: "var(--bad)",
};

const ETIQUETA: Record<EstadoDoOrcamento, [string, string]> = {
  tranquilo: ["Dentro do limite", "bg-good-soft text-good"],
  atencao: ["Atenção", "bg-maybe-soft text-maybe"],
  estourou: ["Passou do limite", "bg-bad-soft text-bad"],
};

export function EtiquetaDoOrcamento({ estado }: { estado: EstadoDoOrcamento }) {
  const [texto, cor] = ETIQUETA[estado];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.8rem] font-bold whitespace-nowrap ${cor}`}>{texto}</span>;
}

/** Quadradinho com o ícone da categoria, na cor do estado do orçamento. */
export function IconeDaCategoria({ categoria, cor }: { categoria: Categoria; cor: string }) {
  const Icone = ICONE_DA_CATEGORIA[categoria];
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-[11px]"
      style={{ color: cor, background: `color-mix(in srgb, ${cor} 14%, var(--surface))` }}
    >
      <Icone className="size-5" />
    </span>
  );
}

const pct = (usado: number) => `${Math.floor(usado * 100)}%`;

/** Linha compacta (tela Hoje, fim do registro de compra): anel pequeno e o aviso em palavras. */
export function LinhaDoOrcamento({ situacao: s, pessoa }: { situacao: SituacaoDoOrcamento; pessoa?: string }) {
  return (
    <li className="flex items-start gap-3 border-b border-line py-3 first:pt-0 last:border-0 last:pb-0">
      <Anel
        fracao={Math.min(1, s.usado)}
        cor={COR_DO_ANEL[s.estado]}
        tamanho={52}
        espessura={7}
        centro={<span className="text-[0.72rem] font-bold">{pct(s.usado)}</span>}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <b>{s.categoria}</b>
          <EtiquetaDoOrcamento estado={s.estado} />
        </div>
        <p className="mt-1 text-[0.92rem] text-muted">{explicarOrcamento(s, pessoa)}</p>
      </div>
    </li>
  );
}

export function ListaDoOrcamento({ situacoes, pessoa }: { situacoes: SituacaoDoOrcamento[]; pessoa?: string }) {
  return (
    <ul>
      {situacoes.map((s) => (
        <LinhaDoOrcamento key={s.categoria} situacao={s} pessoa={pessoa} />
      ))}
    </ul>
  );
}

const emTexto = (c: number) => (c ? (c / 100).toFixed(2).replace(".", ",").replace(/,00$/, "") : "");

/** Campo do limite com atalhos; salvar com 0 tira o orçamento da categoria. */
export function EditorDeLimite({
  pessoaId,
  categoria,
  limite,
  fechar,
}: {
  pessoaId: string;
  categoria: Categoria;
  limite: number;
  fechar: () => void;
}) {
  const [valor, setValor] = useState(emTexto(limite));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const atual = lerValorEmReais(valor) ?? 0;
  const atalhos = limite ? [-5000, 5000, 10000] : [10000, 20000, 30000, 50000];

  async function salvar(novo: number) {
    setSalvando(true);
    try {
      await servicos.orcamentos.salvar(pessoaId, categoria, novo);
      fechar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui salvar.");
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!atual) return setErro("Escreva quanto quer gastar por mês, por exemplo: 600");
        void salvar(atual);
      }}
      className="mt-3.5 border-t border-line pt-3.5"
      noValidate
    >
      <label>
        <span className="mb-1 block font-bold">Quanto quer gastar com {categoria.toLowerCase()} por mês?</span>
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
            placeholder="0"
            className="min-h-13 w-full border-0 bg-transparent pl-2 text-[1.3rem] font-bold outline-none focus-visible:outline-none"
          />
        </span>
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {atalhos.map((d) => {
          const novo = limite ? Math.max(0, atual + d) : d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setValor(emTexto(novo))}
              className="inline-flex min-h-9 items-center rounded-full border-2 border-line bg-surface px-3 text-[0.82rem] font-bold whitespace-nowrap hover:border-primary"
            >
              {limite ? `${d > 0 ? "+" : "−"} ${reaisCurto(Math.abs(d))}` : reaisCurto(d)}
            </button>
          );
        })}
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
          Salvar
        </Botao>
      </div>
      {limite > 0 && (
        <Botao type="button" variante="link" tamanho="pequeno" className="mt-1 text-bad!" onClick={() => salvar(0)} disabled={salvando}>
          <X aria-hidden="true" />
          Parar de acompanhar {categoria.toLowerCase()}
        </Botao>
      )}
    </form>
  );
}

/** Cartão de uma categoria: anel do que foi usado, quanto resta, quanto dá por dia e o aviso. */
export function CartaoDoOrcamento({ pessoaId, situacao: s }: { pessoaId: string; situacao: SituacaoDoOrcamento }) {
  const [editando, setEditando] = useState(false);
  const cor = COR_DO_ESTADO[s.estado];
  const corDoAnel = COR_DO_ANEL[s.estado];
  return (
    <article className="entrar rounded-[20px] border border-line bg-surface p-4">
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <IconeDaCategoria categoria={s.categoria} cor={corDoAnel} />
        <h3 className="min-w-0 flex-1 text-[1.08rem] leading-tight font-bold">{s.categoria}</h3>
        <EtiquetaDoOrcamento estado={s.estado} />
      </header>
      <div className="mt-3.5 flex items-center gap-4.5">
        <Anel
          fracao={Math.min(1, s.usado)}
          cor={corDoAnel}
          tamanho={112}
          espessura={13}
          centro={
            <>
              <b className="text-[1.15rem]">{pct(s.usado)}</b>
              <span className="mt-0.5 text-[0.75rem] text-muted">usado</span>
            </>
          }
        />
        <div className="min-w-0 flex-1">
          <span className="text-[0.92rem] text-muted">{s.estado === "estourou" ? "Passou" : "Restam"}</span>
          <div className="text-[1.6rem] leading-[1.1] font-bold" style={{ color: cor }}>
            {reaisCurto(s.estado === "estourou" ? s.passou : s.restante)}
          </div>
          <p className="mt-1.5 text-[0.92rem]">
            {reaisCurto(s.gasto)} de <b>{reaisCurto(s.limite)}</b>
          </p>
          {s.estado !== "estourou" && s.diasRestantes > 1 && (
            <p className="mt-1 text-[0.92rem]">
              <b>{reaisCurto(s.porDia)}</b> por dia até o fim do mês
            </p>
          )}
        </div>
      </div>
      <p className="mt-3.5 flex gap-2 rounded-xl bg-surface2 px-3 py-2.5 text-[0.92rem]">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" style={{ color: corDoAnel }} />
        {explicarOrcamento(s)}
      </p>
      {editando ? (
        <EditorDeLimite pessoaId={pessoaId} categoria={s.categoria} limite={s.limite} fechar={() => setEditando(false)} />
      ) : (
        <Botao variante="secundario" tamanho="pequeno" bloco className="mt-3" onClick={() => setEditando(true)}>
          <PencilLine aria-hidden="true" />
          Ajustar limite
        </Botao>
      )}
    </article>
  );
}

/** Categorias ainda sem limite: um toque para começar a acompanhar. */
export function SemLimite({ pessoaId, categorias }: { pessoaId: string; categorias: Categoria[] }) {
  const [aberta, setAberta] = useState<Categoria | null>(null);
  if (!categorias.length) return null;
  return (
    <section className="mt-5.5">
      <h2 className="mb-1 text-[1.05rem] font-bold">Sem limite ainda</h2>
      <p className="mb-3 text-[0.92rem] text-muted">Toque numa categoria para definir quanto quer gastar por mês.</p>
      <div className="flex flex-wrap gap-2">
        {categorias.map((c) => {
          const Icone = ICONE_DA_CATEGORIA[c];
          return (
            <button
              key={c}
              type="button"
              aria-pressed={aberta === c}
              onClick={() => setAberta(aberta === c ? null : c)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-line bg-surface px-3.5 font-bold hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary-soft [&_svg]:size-4"
            >
              <Plus aria-hidden="true" />
              <Icone aria-hidden="true" />
              {c}
            </button>
          );
        })}
      </div>
      {aberta && (
        <div className="mt-3 max-w-[480px] rounded-[20px] border border-line bg-surface px-4 pb-4">
          <EditorDeLimite key={aberta} pessoaId={pessoaId} categoria={aberta} limite={0} fechar={() => setAberta(null)} />
        </div>
      )}
    </section>
  );
}
