"use client";

import { Link2, Plus, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { percentual } from "@/lib/assistente/textos";
import { lerValorEmReais } from "@/lib/dinheiro";
import { reais } from "@/lib/formatar";
import { servicos, type CampoDaDivida, type Divida, type SugestaoGuardada } from "@/services";
import { Etiqueta, Painel, Sub } from "../ui/blocos";
import { Botao } from "../ui/botao";

const NOME_DA_FONTE: Record<string, string> = {
  pluggy: "do banco",
  contrato: "do contrato",
  registrato: "do Registrato",
  fatura: "da fatura",
  extrato: "do extrato",
};
export const seloDaFonte = (fonte: string | null | undefined) => (fonte ? (NOME_DA_FONTE[fonte] ?? "de documento") : null);

const ROTULO: Record<CampoDaDivida, string> = {
  saldo: "Saldo devedor (R$)",
  taxaMensal: "Juros ao mês (%)",
  parcelaMinima: "Parcela (R$)",
  parcelasRestantes: "Parcelas que faltam",
};

/** Converte o que a pessoa digitou no campo "confira" para o valor guardado. */
export function lerCampo(campo: CampoDaDivida, texto: string): number | null {
  if (!texto.trim()) return null;
  if (campo === "taxaMensal") {
    const n = Number(texto.replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 && n <= 30 ? n / 100 : null;
  }
  if (campo === "parcelasRestantes") {
    const n = Number(texto.replace(/\D/g, ""));
    return n > 0 && n <= 480 ? n : null;
  }
  return lerValorEmReais(texto);
}

/** Campos para conferir ou completar (os que a fonte não trouxe ou trouxe estranhos). */
export function CamposParaConferir({ campos, valores, mudar }: { campos: CampoDaDivida[]; valores: Partial<Record<CampoDaDivida, string>>; mudar: (c: CampoDaDivida, v: string) => void }) {
  if (!campos.length) return null;
  return (
    <div className="mt-2 grid gap-2 rounded-[12px] border-2 border-dashed border-maybe/60 p-2.5">
      <p className="text-[0.85rem] font-bold text-maybe">Confira: o documento não trouxe ou trouxe estranho</p>
      <div className="grid grid-cols-2 gap-2">
        {campos.map((c) => (
          <label key={c} className="grid gap-1 text-[0.85rem]">
            <span>{ROTULO[c]}</span>
            <input
              value={valores[c] ?? ""}
              onChange={(e) => mudar(c, e.target.value)}
              inputMode="decimal"
              className="campo min-h-11 rounded-[10px] border-2 border-line bg-surface px-2.5 outline-none focus:border-primary"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/** Topo de Dívidas: o que o banco e os documentos acharam, para a pessoa adicionar ou dispensar. */
export function SugestoesDeDivida({ pessoaId, sugestoes, dividas }: { pessoaId: string; sugestoes: SugestaoGuardada[]; dividas: Divida[] }) {
  const deDivida = sugestoes.filter((s) => s.tipo === "divida");
  if (!deDivida.length) return null;
  const n = deDivida.length;
  return (
    <Painel titulo={`Achei ${n} ${n === 1 ? "dívida" : "dívidas"}`}>
      <Sub className="mb-1">Vieram do seu banco ou dos documentos que você enviou. Adicione as que forem suas.</Sub>
      <ul className="mt-2 grid items-start gap-3 desk:grid-cols-2 min-[1400px]:grid-cols-3">
        {deDivida.map((s) => (
          <CartaoDaSugestao key={s.chave} pessoaId={pessoaId} s={s} parecida={dividas.find((d) => d.id === s.dados.parecidaCom)} />
        ))}
      </ul>
    </Painel>
  );
}

function CartaoDaSugestao({ pessoaId, s, parecida }: { pessoaId: string; s: SugestaoGuardada; parecida: Divida | undefined }) {
  const d = s.dados;
  const [valores, setValores] = useState<Partial<Record<CampoDaDivida, string>>>({});
  const [dia, setDia] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function adicionar() {
    const correcoes: Partial<Record<CampoDaDivida, number>> = {};
    for (const c of d.confira) {
      const v = valores[c] ? lerCampo(c, valores[c]!) : null;
      if (valores[c] && v === null) return setErro(`Confira o campo "${ROTULO[c]}".`);
      if (v !== null) correcoes[c] = v;
    }
    const vencimento = d.vencimento ?? (dia ? Number(dia) : undefined);
    if (!vencimento || vencimento < 1 || vencimento > 31) return setErro("Diga o dia do mês em que vence.");
    setOcupado(true);
    try {
      await servicos.banco.aceitarSugestao(pessoaId, s.chave, correcoes, d.vencimento ? undefined : vencimento);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui adicionar agora.");
      setOcupado(false);
    }
  }

  return (
    <li className="rounded-[16px] border border-line bg-surface2/40 p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold">{d.nome}</p>
          <p className="text-[0.85rem] text-muted">
            {d.detalhe}
            {d.cet ? ` · CET ${percentual(d.cet)} ao ano` : ""}
          </p>
        </div>
        <Etiqueta tom="primaria">{seloDaFonte(d.fonte)}</Etiqueta>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.9rem]">
        <div>
          <dt className="text-muted">Saldo</dt>
          <dd className="font-bold">{d.confira.includes("saldo") ? "a conferir" : reais(d.saldo)}</dd>
        </div>
        {d.vencido ? (
          <div>
            <dt className="text-muted">Vencido</dt>
            <dd className="font-bold text-bad">{reais(d.vencido)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted">Juros</dt>
          <dd className="font-bold">{d.taxaMensal !== null ? `${percentual(d.taxaMensal)} ao mês` : "a conferir"}</dd>
        </div>
        {(d.parcelaMinima > 0 || d.tipo === "emprestimo" || d.tipo === "parcelamento") && (
        <div>
          <dt className="text-muted">Parcela</dt>
          <dd className="font-bold">
            {d.parcelaMinima ? reais(d.parcelaMinima) : "a conferir"}
            {d.parcelasRestantes ? ` · faltam ${d.parcelasRestantes}` : ""}
          </dd>
        </div>
        )}
      </dl>
      {d.temSeguro && (
        <p className="mt-2 flex items-center gap-1.5 text-[0.88rem] text-maybe">
          <ShieldAlert aria-hidden="true" className="size-4" /> Tem seguro contratado junto. Vale perguntar ao banco se dá para tirar.
        </p>
      )}
      {parecida && (
        <p className="mt-2 rounded-[12px] bg-surface2 p-2.5 text-[0.9rem]">
          Parece com <b>{parecida.nome}</b>, que você já cadastrou.
        </p>
      )}
      <CamposParaConferir campos={d.confira} valores={valores} mudar={(c, v) => setValores((x) => ({ ...x, [c]: v }))} />
      {!d.vencimento && (
        <label className="mt-2 grid max-w-48 gap-1 text-[0.85rem]">
          <span>Vence no dia</span>
          <input value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className="campo min-h-11 rounded-[10px] border-2 border-line bg-surface px-2.5 outline-none focus:border-primary" />
        </label>
      )}
      {erro && (
        <p role="alert" className="mt-2 font-bold text-bad">
          {erro}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {parecida ? (
          <>
            <Botao tamanho="pequeno" disabled={ocupado} onClick={() => servicos.banco.vincularSugestao(pessoaId, s.chave, parecida.id)}>
              <Link2 aria-hidden="true" /> É a mesma: vincular
            </Botao>
            <Botao tamanho="pequeno" variante="secundario" disabled={ocupado} onClick={adicionar}>
              <Plus aria-hidden="true" /> É outra
            </Botao>
          </>
        ) : (
          <Botao tamanho="pequeno" disabled={ocupado} onClick={adicionar}>
            <Plus aria-hidden="true" /> Adicionar
          </Botao>
        )}
        <Botao tamanho="pequeno" variante="secundario" disabled={ocupado} onClick={() => servicos.banco.dispensarSugestao(pessoaId, s.chave)}>
          <X aria-hidden="true" /> Agora não
        </Botao>
      </div>
    </li>
  );
}
