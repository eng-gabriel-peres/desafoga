"use client";

import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { usePessoa } from "@/hooks/use-pessoa";
import { lerValorEmReais } from "@/lib/dinheiro";
import { orcamentoDoMes, type Categoria } from "@/lib/finance";
import { servicos } from "@/services";
import { ListaDoOrcamento } from "../orcamento";
import { useMinhaPessoaId } from "../sessao";
import { Carregando, Painel, Sub, TituloCelular, Vazio } from "../ui/blocos";
import { Botao } from "../ui/botao";
import { CampoReais } from "../ui/campos";

const CATEGORIAS: Categoria[] = ["Mercado", "Comida pronta", "Roupa", "Farmácia", "Casa", "Lazer", "Presente", "Outro"];
const emTexto = (c: number | undefined) => (c ? (c / 100).toFixed(2).replace(".", ",").replace(/,00$/, "") : "");

export function TelaOrcamento() {
  const pessoaId = useMinhaPessoaId();
  const dados = usePessoa(pessoaId);
  const agora = useAgora();
  if (!dados || !agora) return <Carregando />;
  const situacoes = orcamentoDoMes(dados.orcamentos, dados.compras, agora);

  return (
    <>
      <TituloCelular titulo="Orçamento" subtitulo="Quanto você quer gastar por categoria no mês" />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] desk:gap-5">
        <Painel titulo="Este mês">
          {situacoes.length ? (
            <ListaDoOrcamento situacoes={situacoes} />
          ) : (
            <Vazio>Defina ao lado quanto quer gastar em cada categoria. Aqui aparece quanto já usou, quanto resta e quanto dá para gastar por dia.</Vazio>
          )}
        </Painel>
        <Limites
          // Recria o formulário quando os limites mudam (ex.: salvos em outra aba).
          key={dados.orcamentos.map((o) => `${o.categoria}:${o.limite}`).join("|")}
          pessoaId={pessoaId}
          limites={Object.fromEntries(dados.orcamentos.map((o) => [o.categoria, o.limite]))}
        />
      </div>
    </>
  );
}

function Limites({ pessoaId, limites }: { pessoaId: string; limites: Partial<Record<Categoria, number>> }) {
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(CATEGORIAS.map((c) => [c, emTexto(limites[c])])));
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem("");
    const mudadas = CATEGORIAS.map((c) => [c, lerValorEmReais(valores[c]) ?? 0] as const).filter(([c, v]) => v !== (limites[c] ?? 0));
    if (!mudadas.length) return setMensagem("Nada mudou.");
    setSalvando(true);
    try {
      for (const [c, v] of mudadas) await servicos.orcamentos.salvar(pessoaId, c, v);
      setMensagem("Limites salvos.");
    } catch (falha) {
      setMensagem(falha instanceof Error ? falha.message : "Não consegui salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Painel titulo="Limites por mês">
      <Sub className="mb-3">Deixe em branco a categoria que você não quer acompanhar.</Sub>
      <form onSubmit={salvar} className="grid gap-3" noValidate>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
          {CATEGORIAS.map((c) => (
            <CampoReais key={c} rotulo={c} value={valores[c]} onChange={(e) => setValores((v) => ({ ...v, [c]: e.target.value }))} />
          ))}
        </div>
        <p role="status" className="min-h-6 font-bold text-muted">
          {mensagem}
        </p>
        <Botao type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar limites"}
        </Botao>
      </form>
    </Painel>
  );
}
