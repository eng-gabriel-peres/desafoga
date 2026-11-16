"use client";

import { Check, ChevronLeft, CircleHelp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { lerValorEmReais } from "@/lib/dinheiro";
import { chaveDoDia, comprasDoDia, notaMedia, type Categoria, type Emocao, type Necessidade } from "@/lib/finance";
import { NOME_DA_EMOCAO } from "@/lib/assistente/textos";
import { reais } from "@/lib/formatar";
import { servicos } from "@/services";
import { CATEGORIAS, ICONE_DA_CATEGORIA } from "../categorias";
import { NotaDoDia } from "../emocao";
import { PESSOA_DA_DEMO } from "../moldura/navegacao";
import { Botao } from "../ui/botao";
import { Carinha, COR_DA_EMOCAO } from "../ui/carinha";

interface Rascunho {
  item: string;
  valorTexto: string;
  categoria: Categoria | null;
  emocao: Emocao | null;
}

const VAZIO: Rascunho = { item: "", valorTexto: "", categoria: null, emocao: null };

export function TelaRegistrar() {
  const router = useRouter();
  const [passo, setPasso] = useState<1 | 2 | 3 | 4>(1);
  const [rascunho, setRascunho] = useState<Rascunho>(VAZIO);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salva, setSalva] = useState<{ item: string; valor: number } | null>(null);

  const reiniciar = () => {
    setPasso(1);
    setRascunho(VAZIO);
    setErro("");
    setSalva(null);
  };
  // O Next guarda a tela ao navegar; ao sair, o fluxo volta ao começo.
  useLayoutEffect(() => () => reiniciar(), []);

  const mudar = (m: Partial<Rascunho>) => setRascunho((r) => ({ ...r, ...m }));

  function continuar() {
    const valor = lerValorEmReais(rascunho.valorTexto);
    if (!rascunho.item.trim()) return setErro("Escreva o que você comprou.");
    if (!valor) return setErro("Escreva quanto custou, por exemplo: 49,90.");
    if (!rascunho.categoria) return setErro("Escolha o tipo de compra.");
    setErro("");
    setPasso(2);
  }

  async function concluir(necessidade: Necessidade) {
    const valor = lerValorEmReais(rascunho.valorTexto);
    if (!valor || !rascunho.categoria || !rascunho.emocao || salvando) return;
    setSalvando(true);
    const item = rascunho.item.trim().charAt(0).toUpperCase() + rascunho.item.trim().slice(1);
    await servicos.compras.registrar(PESSOA_DA_DEMO, {
      item,
      valor,
      categoria: rascunho.categoria,
      emocao: rascunho.emocao,
      necessidade,
      via: "app",
    });
    setSalvando(false);
    setSalva({ item, valor });
    setPasso(4);
  }

  if (passo === 4 && salva) {
    return <Concluido item={salva.item} valor={salva.valor} outra={reiniciar} sair={() => router.push("/app/hoje")} />;
  }

  const voltar = () => (passo === 1 ? router.push("/app/hoje") : setPasso((p) => (p - 1) as 1 | 2 | 3));

  return (
    <div className="mx-auto max-w-[620px]">
      <Botao variante="link" onClick={voltar}>
        <ChevronLeft aria-hidden="true" />
        {passo === 1 ? "Cancelar" : "Voltar"}
      </Botao>
      <div className="mt-1 mb-4.5 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={passo} aria-label={`Passo ${passo} de 3`}>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= passo ? "bg-primary" : "bg-line"}`} />
        ))}
      </div>

      {passo === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            continuar();
          }}
          noValidate
        >
          <h1 className="mb-1.5 text-[1.6rem] leading-tight font-bold">O que você comprou?</h1>
          <label className="mt-4 block">
            <span className="mb-1.5 block font-bold">Nome da compra</span>
            <input
              value={rascunho.item}
              onChange={(e) => mudar({ item: e.target.value })}
              placeholder="Ex.: tênis, mercado, lanche"
              autoComplete="off"
              enterKeyHint="next"
              className="min-h-14 w-full rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 text-[1.15rem] outline-none focus:border-primary desk:min-h-12 desk:text-[1.05rem]"
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block font-bold">Quanto custou?</span>
            <span className="flex items-center rounded-2xl border-2 border-line bg-surface px-4 focus-within:border-primary">
              <b aria-hidden="true" className="text-[1.6rem] text-muted">
                R$
              </b>
              <input
                value={rascunho.valorTexto}
                onChange={(e) => mudar({ valorTexto: e.target.value })}
                inputMode="decimal"
                placeholder="0,00"
                autoComplete="off"
                aria-label="Valor em reais"
                className="min-h-[4.2rem] w-full border-0 bg-transparent pl-2.5 text-[2.2rem] font-bold outline-none"
              />
            </span>
          </label>
          <fieldset className="mt-4 min-w-0">
            <legend className="mb-1.5 font-bold">Tipo de compra</legend>
            <div role="radiogroup" aria-label="Tipo de compra" className="grid grid-cols-4 gap-2">
              {CATEGORIAS.map((c) => {
                const Icone = ICONE_DA_CATEGORIA[c];
                const marcada = rascunho.categoria === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={marcada}
                    onClick={() => mudar({ categoria: c })}
                    className="relative flex min-h-[4.1rem] flex-col items-center justify-center gap-1.5 rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-1 py-2 text-center text-[0.78rem] leading-tight font-bold hover:border-primary aria-checked:border-primary aria-checked:bg-primary-soft"
                  >
                    {marcada && (
                      <span aria-hidden="true" className="absolute top-1 right-1 grid size-[18px] place-items-center rounded-full bg-primary text-primary-ink">
                        <Check className="size-3" />
                      </span>
                    )}
                    <Icone aria-hidden="true" className={`size-6 ${marcada ? "text-primary" : "text-muted"}`} />
                    {c}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {erro && (
            <p role="alert" className="mt-3 font-bold text-bad">
              {erro}
            </p>
          )}
          <Botao type="submit" tamanho="grande" bloco className="mt-5">
            Continuar
          </Botao>
        </form>
      )}

      {passo === 2 && (
        <section aria-labelledby="pergunta-emocao">
          <h1 id="pergunta-emocao" className="mb-1.5 text-[1.6rem] leading-tight font-bold">
            Como você estava na hora da compra?
          </h1>
          <p className="text-muted">Toque na carinha mais parecida com o que sentia.</p>
          <div role="radiogroup" aria-labelledby="pergunta-emocao" className="mt-4.5 grid grid-cols-5 gap-1.5">
            {([1, 2, 3, 4, 5] as Emocao[]).map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={rascunho.emocao === e}
                onClick={() => {
                  mudar({ emocao: e });
                  setPasso(3);
                }}
                className="flex flex-col items-center gap-2 rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-0.5 py-3 text-center text-[0.74rem] leading-tight font-bold hover:border-primary hover:bg-primary-soft aria-checked:border-primary aria-checked:bg-primary-soft"
              >
                <Carinha emocao={e} rotulo={false} />
                {NOME_DA_EMOCAO[e]}
              </button>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="mt-3 h-2 rounded"
            style={{ background: `linear-gradient(90deg, ${[1, 2, 3, 4, 5].map((e) => COR_DA_EMOCAO[e as Emocao]).join(",")})` }}
          />
          <div aria-hidden="true" className="mt-1 flex justify-between text-[0.78rem] text-muted">
            <span>Mais triste</span>
            <span>Mais feliz</span>
          </div>
        </section>
      )}

      {passo === 3 && (
        <section aria-labelledby="pergunta-necessidade">
          <h1 id="pergunta-necessidade" className="mb-1.5 text-[1.6rem] leading-tight font-bold">
            Essa compra era necessária?
          </h1>
          <p className="text-muted">Responda com sinceridade. Não existe resposta errada.</p>
          <div className="mt-4 grid gap-2.5">
            <OpcaoNecessidade icone={<Check />} cor="bg-good-soft text-good" texto="Sim, era necessária" onClick={() => concluir("sim")} desativada={salvando} />
            <OpcaoNecessidade icone={<X />} cor="bg-bad-soft text-bad" texto="Não era necessária" onClick={() => concluir("nao")} desativada={salvando} />
            <OpcaoNecessidade icone={<CircleHelp />} cor="bg-maybe-soft text-maybe" texto="Não sei" onClick={() => concluir("talvez")} desativada={salvando} />
          </div>
        </section>
      )}
    </div>
  );
}

function OpcaoNecessidade({
  icone,
  cor,
  texto,
  onClick,
  desativada,
}: {
  icone: React.ReactNode;
  cor: string;
  texto: string;
  onClick: () => void;
  desativada: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desativada}
      className="flex min-h-[4.5rem] items-center gap-3.5 rounded-[var(--radius-card)] border-2 border-line bg-surface px-4 text-left text-[1.15rem] font-bold hover:border-primary disabled:opacity-60 desk:min-h-[3.9rem]"
    >
      <span aria-hidden="true" className={`grid size-12 shrink-0 place-items-center rounded-full [&_svg]:size-6 ${cor}`}>
        {icone}
      </span>
      {texto}
    </button>
  );
}

/** Fim do fluxo: confirmação e a nota do dia já atualizada. */
function Concluido({ item, valor, outra, sair }: { item: string; valor: number; outra: () => void; sair: () => void }) {
  const agora = useAgora();
  const compras = useConsulta(`compras:${PESSOA_DA_DEMO}`, () => servicos.compras.listar(PESSOA_DA_DEMO));
  const deHoje = compras && agora ? comprasDoDia(compras, chaveDoDia(agora)) : [];
  return (
    <div className="mx-auto max-w-[620px]">
      <div aria-hidden="true" className="mx-auto mt-2.5 mb-3.5 grid size-24 place-items-center rounded-full bg-good-soft text-good">
        <Check className="size-12" />
      </div>
      <h1 className="text-center text-[1.6rem] font-bold" role="status">
        Compra registrada
      </h1>
      <p className="mb-4.5 text-center text-muted">
        {item}, {reais(valor)}
      </p>
      {compras && <NotaDoDia nota={notaMedia(deHoje)} quantidade={deHoje.length} sujeito="você estava" />}
      <div className="mt-4.5 grid grid-cols-2 gap-2.5">
        <Botao variante="secundario" onClick={outra}>
          Registrar outra
        </Botao>
        <Botao onClick={sair}>Concluir</Botao>
      </div>
    </div>
  );
}
