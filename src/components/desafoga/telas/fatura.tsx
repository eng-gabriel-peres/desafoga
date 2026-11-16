"use client";

import { Check, ChevronLeft, FileText, LoaderCircle, Lock, ScanLine, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { separarFatura, type Emocao, type Fatura, type Necessidade } from "@/lib/finance";
import { NOME_DA_EMOCAO, NOME_DA_NECESSIDADE } from "@/lib/assistente/textos";
import { descricaoLegivel, reais } from "@/lib/formatar";
import { servicos, type Classificacao } from "@/services";
import { useMinhaPessoaId } from "../sessao";
import { Painel, Sub, TituloCelular } from "../ui/blocos";
import { Botao } from "../ui/botao";
import { COR_DA_EMOCAO, RostoSvg } from "../ui/carinha";

const ETAPAS_DE_LEITURA = ["Lendo os lançamentos", "Separando juros, IOF e tarifas", "Conferindo com suas compras"];
const TEMPO_POR_ETAPA = 900;

type Estado =
  | { etapa: "envio"; erro?: string }
  | { etapa: "lendo"; arquivo: string; feitas: number }
  | { etapa: "resultado"; fatura: Fatura; deExemplo: boolean };

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function TelaFatura() {
  const pessoaId = useMinhaPessoaId();
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ etapa: "envio" });
  const [classificacoes, setClassificacoes] = useState<Record<string, Classificacao>>({});
  const [salvando, setSalvando] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  // Ao sair da tela, o fluxo volta ao começo.
  useLayoutEffect(
    () => () => {
      setEstado({ etapa: "envio" });
      setClassificacoes({});
    },
    [],
  );

  async function ler(arquivo: File | null) {
    const nome = arquivo?.name ?? "a fatura de exemplo";
    setEstado({ etapa: "lendo", arquivo: nome, feitas: 0 });
    const leitura = servicos.faturas.ler(pessoaId, arquivo);
    // A animação anda enquanto a IA lê; a última etapa espera a leitura terminar.
    for (let i = 1; i < ETAPAS_DE_LEITURA.length; i++) {
      await espera(TEMPO_POR_ETAPA);
      setEstado({ etapa: "lendo", arquivo: nome, feitas: i });
    }
    try {
      const { fatura, deExemplo } = await leitura;
      setEstado({ etapa: "lendo", arquivo: nome, feitas: ETAPAS_DE_LEITURA.length });
      await espera(TEMPO_POR_ETAPA / 2);
      setEstado({ etapa: "resultado", fatura, deExemplo });
    } catch (e) {
      setEstado({ etapa: "envio", erro: e instanceof Error ? e.message : "Não consegui ler o arquivo. Tente de novo." });
    }
  }

  async function salvar(fatura: Fatura) {
    setSalvando(true);
    await servicos.faturas.salvar(pessoaId, fatura, classificacoes);
    setSalvando(false);
    router.push("/app/dividas");
  }

  const voltar = (
    <Botao variante="link" onClick={() => router.push("/app/dividas")}>
      <ChevronLeft aria-hidden="true" />
      Voltar às dívidas
    </Botao>
  );

  if (estado.etapa === "envio") {
    return (
      <div className="mx-auto max-w-[720px]">
        {voltar}
        <TituloCelular titulo="Enviar fatura" />
        <Painel titulo="Enviar fatura ou extrato" className="mt-2">
          <Sub>A Luana lê os lançamentos, separa compras, juros e tarifas e confere com as compras que você já registrou.</Sub>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              ler(e.dataTransfer.files[0] ?? null);
            }}
            className={`mt-4 flex min-h-44 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card)] border-2 border-dashed p-5 text-center caixa-de-campo focus-within:border-primary hover:border-primary ${arrastando ? "border-primary bg-primary-soft" : "border-line bg-surface2"}`}
          >
            <input
              type="file"
              accept=".pdf,application/pdf,image/*"
              className="sr-only"
              onChange={(e) => ler(e.target.files?.[0] ?? null)}
            />
            <Upload aria-hidden="true" className="size-8 text-primary" />
            <b className="text-[1.1rem]">Escolher PDF ou foto</b>
            <span className="text-[0.92rem] text-muted">Fatura do cartão ou extrato da conta. Também dá para arrastar o arquivo aqui.</span>
          </label>
          <Botao variante="secundario" bloco className="mt-3" onClick={() => ler(null)}>
            <FileText aria-hidden="true" />
            Usar a fatura de exemplo
          </Botao>
          <p className="mt-3 flex items-start gap-2 text-[0.88rem] text-muted">
            <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            A Luana lê o arquivo e guarda só os lançamentos; o arquivo em si não fica salvo.
          </p>
          {estado.erro && (
            <p role="alert" className="mt-3 font-bold text-bad">
              {estado.erro}
            </p>
          )}
        </Painel>
      </div>
    );
  }

  if (estado.etapa === "lendo") {
    return (
      <div className="mx-auto max-w-[720px]">
        {voltar}
        <Painel titulo={`Lendo ${estado.arquivo}…`} className="mt-2">
          <ol className="grid gap-2.5" aria-live="polite">
            {ETAPAS_DE_LEITURA.map((texto, i) => {
              const feita = i < estado.feitas;
              const agora = i === estado.feitas;
              return (
                <li
                  key={texto}
                  className={`flex min-h-12 items-center gap-3 rounded-xl border px-3.5 ${feita ? "border-good/40 bg-good-soft" : agora ? "border-primary bg-primary-soft" : "border-line text-muted"}`}
                >
                  {feita ? (
                    <Check aria-hidden="true" className="size-5 text-good" />
                  ) : (
                    <LoaderCircle aria-hidden="true" className={`size-5 ${agora ? "animate-spin text-primary" : ""}`} />
                  )}
                  <span className={agora || feita ? "font-bold" : ""}>{texto}</span>
                  <span className="sr-only">{feita ? ", feito" : agora ? ", em andamento" : ", aguardando"}</span>
                </li>
              );
            })}
          </ol>
        </Painel>
      </div>
    );
  }

  const { fatura, deExemplo } = estado;
  const s = separarFatura(fatura);
  const classificar = (id: string, m: Classificacao) => setClassificacoes((c) => ({ ...c, [id]: { ...c[id], ...m } }));

  return (
    <div className="mx-auto max-w-[720px]">
      {voltar}
      <div className="mt-2 grid gap-4">
        <section
          aria-label="Resultado da leitura"
          className="rounded-[var(--radius-card)] border-2 border-bad/40 p-[1.1rem]"
          style={{ background: "linear-gradient(135deg, var(--bad-soft), var(--surface) 70%)" }}
        >
          <p className="flex items-center gap-2 font-bold text-bad">
            <ScanLine aria-hidden="true" className="size-5" />
            {fatura.origem}
          </p>
          {deExemplo && (
            <p className="mt-1 text-[0.88rem] text-muted">Demonstração sem IA: este é um extrato de exemplo, lido no lugar do arquivo.</p>
          )}
          <p className="mt-2 text-[1.25rem]">
            Encontramos <b className="text-[1.5rem]">{reais(s.totalEncargos)}</b> em juros, IOF e tarifas.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2 text-[0.9rem]">
            {s.encargos.map((l) => (
              <li key={l.id} className="rounded-full border border-line bg-surface px-3 py-1">
                {descricaoLegivel(l.descricao)}: {reais(l.valor)}
              </li>
            ))}
          </ul>
        </section>

        {s.novas.length > 0 && (
          <Painel titulo={`Compras novas (${s.novas.length})`}>
            <Sub className="mb-1.5">Lembra como estava na hora? Se não lembrar, pode pular.</Sub>
            <ul>
              {s.novas.map((l) => (
                <li key={l.id} className="border-b border-line py-3 last:border-0">
                  <div className="flex justify-between gap-3">
                    <b>{descricaoLegivel(l.descricao)}</b>
                    <b>{reais(l.valor)}</b>
                  </div>
                  <ClassificarCompra
                    nome={descricaoLegivel(l.descricao)}
                    valor={classificacoes[l.id] ?? {}}
                    aoMudar={(m) => classificar(l.id, m)}
                  />
                </li>
              ))}
            </ul>
          </Painel>
        )}

        {s.jaRegistradas.length > 0 && (
          <Painel titulo={`Já registradas por você (${s.jaRegistradas.length})`}>
            <ul>
              {s.jaRegistradas.map((l) => (
                <li key={l.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                  <span className="flex-1">{descricaoLegivel(l.descricao)}</span>
                  <b>{reais(l.valor)}</b>
                  <Check aria-label="Já registrada" className="size-5 text-good" />
                </li>
              ))}
            </ul>
          </Painel>
        )}

        {s.assinaturas.length > 0 && (
          <Painel titulo="Assinaturas encontradas">
            <ul>
              {s.assinaturas.map((l) => (
                <li key={l.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                  <span className="flex-1">{descricaoLegivel(l.descricao)}</span>
                  <b>{reais(l.valor)} por mês</b>
                </li>
              ))}
            </ul>
          </Painel>
        )}

        <Botao tamanho="grande" bloco onClick={() => salvar(fatura)} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar e atualizar meu raio-x"}
        </Botao>
      </div>
    </div>
  );
}

/** Carinhas pequenas e Necessária / Não necessária / Não sei para uma compra da fatura. */
function ClassificarCompra({ nome, valor, aoMudar }: { nome: string; valor: Classificacao; aoMudar: (m: Classificacao) => void }) {
  return (
    <div className="mt-2 grid gap-2">
      <div role="radiogroup" aria-label={`Como você estava ao comprar ${nome}`} className="flex gap-1.5">
        {([1, 2, 3, 4, 5] as Emocao[]).map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={valor.emocao === e}
            aria-label={NOME_DA_EMOCAO[e]}
            onClick={() => aoMudar({ emocao: e })}
            className="grid size-11 place-items-center rounded-full border-2 text-ink opacity-70 hover:opacity-100 aria-checked:opacity-100 aria-checked:ring-3 aria-checked:ring-primary aria-checked:ring-offset-2 aria-checked:ring-offset-surface"
            style={{ borderColor: COR_DA_EMOCAO[e], background: `color-mix(in srgb, ${COR_DA_EMOCAO[e]} 28%, var(--surface))` }}
          >
            <RostoSvg emocao={e} />
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label={`${nome} era necessária?`} className="flex flex-wrap gap-1.5">
        {(["sim", "nao", "talvez"] as Necessidade[]).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={valor.necessidade === n}
            onClick={() => aoMudar({ necessidade: n })}
            className="min-h-11 rounded-[10px] border-2 border-line bg-surface px-3 text-[0.88rem] font-bold hover:border-primary aria-checked:border-primary aria-checked:bg-primary-soft"
          >
            {NOME_DA_NECESSIDADE[n]}
          </button>
        ))}
      </div>
    </div>
  );
}
