"use client";

import { Check, ChevronDown, ChevronLeft, FileText, LoaderCircle, Lock, ScanLine, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { chaveDaDescricao } from "@/lib/banco/classificar";
import { separarFatura, type Emocao, type Fatura, type Lancamento, type Necessidade } from "@/lib/finance";
import { NOME_DA_EMOCAO, NOME_DA_NECESSIDADE } from "@/lib/assistente/textos";
import { descricaoLegivel, reais } from "@/lib/formatar";
import { servicos, type Classificacao } from "@/services";
import { useMinhaPessoaId } from "../sessao";
import { usePessoa } from "@/hooks/use-pessoa";
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
  /** Cartão conectado a que a fatura pertence ("" = nenhum). */
  const [cartao, setCartao] = useState("");
  /** Ids das assinaturas que a pessoa quer como conta fixa mensal. */
  const [mensais, setMensais] = useState<string[]>([]);
  const dados = usePessoa(pessoaId);
  const cartoes = (dados?.banco.conexoes ?? []).flatMap((c) => c.contas.filter((x) => x.tipo === "cartao").map((x) => ({ id: x.id, nome: `${x.nome} · ${c.banco}` })));
  const contasFixas = new Set((dados?.contas.contas ?? []).map((c) => chaveDaConta(c.nome, c.valor)));

  // Ao sair da tela, o fluxo volta ao começo.
  useLayoutEffect(
    () => () => {
      setEstado({ etapa: "envio" });
      setClassificacoes({});
      setMensais([]);
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
    await servicos.faturas.salvar(pessoaId, fatura, classificacoes, cartao || null, mensais);
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
      <div className="mt-2 grid grid-cols-1 gap-4">
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
          {(fatura.total || fatura.vencimento || fatura.pagamentoMinimo || fatura.taxaRotativoMensal) && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[0.92rem] desk:grid-cols-4">
              {fatura.total ? <Numero rotulo="Total" valor={reais(fatura.total)} /> : null}
              {fatura.vencimento ? <Numero rotulo="Vence" valor={new Date(`${fatura.vencimento}T12:00:00`).toLocaleDateString("pt-BR")} /> : null}
              {fatura.pagamentoMinimo ? <Numero rotulo="Mínimo" valor={reais(fatura.pagamentoMinimo)} /> : null}
              {fatura.taxaRotativoMensal ? <Numero rotulo="Juros do rotativo" valor={`${(fatura.taxaRotativoMensal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% ao mês`} /> : null}
            </dl>
          )}
          <Encargos lista={s.encargos} />
        </section>

        {s.assinaturas.length > 0 && (
          <Assinaturas
            lista={s.assinaturas}
            noCartao={fatura.tipo === "fatura"}
            jaFixas={contasFixas}
            marcadas={mensais}
            aoMudar={(id, sim) => setMensais((m) => (sim ? [...m, id] : m.filter((x) => x !== id)))}
          />
        )}

        {fatura.tipo === "fatura" && cartoes.length > 0 && (
          <Painel titulo="Esta fatura é de um cartão conectado?">
            <Sub className="mb-2">Se for, a fatura que veio do banco vale e esta só completa o que faltar. Assim nada conta duas vezes.</Sub>
            <select
              value={cartao}
              onChange={(e) => setCartao(e.target.value)}
              aria-label="Cartão conectado desta fatura"
              className="campo min-h-12 w-full rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3 outline-none focus:border-primary"
            >
              <option value="">Não, é de outro cartão</option>
              {cartoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Painel>
        )}

        {s.novas.length > 0 && <ComprasNovas lista={s.novas} classificacoes={classificacoes} aoClassificar={classificar} />}

        {s.jaRegistradas.length > 0 && (
          <Painel>
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-bold [&::-webkit-details-marker]:hidden">
                <Check aria-hidden="true" className="size-5 text-good" />
                <span className="flex-1">
                  {s.jaRegistradas.length === 1 ? "1 compra já registrada por você" : `${s.jaRegistradas.length} compras já registradas por você`}
                </span>
                <ChevronDown aria-hidden="true" className="size-5 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-1">
                {s.jaRegistradas.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                    <span className="flex-1">{descricaoLegivel(l.descricao)}</span>
                    <b>{reais(l.valor)}</b>
                  </li>
                ))}
              </ul>
            </details>
          </Painel>
        )}

        {/* Fica sempre à vista: ninguém precisa descer a lista inteira para salvar. Acima da barra de abas no celular. */}
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 desk:bottom-4">
          <Botao tamanho="grande" bloco className="text-[1.05rem]! whitespace-nowrap shadow-[0_8px_24px_rgb(0_0_0/0.28)]" onClick={() => salvar(fatura)} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar e atualizar meu raio-x"}
          </Botao>
        </div>
      </div>
    </div>
  );
}

/** Juros, IOF e tarifas somados por tipo: "IOF diário parcelado · 5×  R$ 2,29". */
function Encargos({ lista }: { lista: Lancamento[] }) {
  const [todos, setTodos] = useState(false);
  const grupos = new Map<string, { nome: string; valor: number; vezes: number }>();
  for (const l of lista) {
    const chave = chaveDaDescricao(l.descricao);
    const g = grupos.get(chave) ?? { nome: descricaoLegivel(l.descricao), valor: 0, vezes: 0 };
    g.valor += l.valor;
    g.vezes++;
    grupos.set(chave, g);
  }
  const ordenados = [...grupos.values()].sort((a, b) => b.valor - a.valor);
  if (!ordenados.length) return null;
  const visiveis = todos ? ordenados : ordenados.slice(0, MAXIMO_DE_ENCARGOS);
  return (
    <>
      <ul className="mt-3 grid gap-1.5 text-[0.92rem]">
        {visiveis.map((g) => (
          <li key={g.nome} className="flex items-center justify-between gap-3 rounded-[12px] bg-surface px-3 py-2">
            <span className="min-w-0">
              {g.nome}
              {g.vezes > 1 && <span className="text-muted"> · {g.vezes}×</span>}
            </span>
            <b className="shrink-0">{reais(g.valor)}</b>
          </li>
        ))}
      </ul>
      {ordenados.length > visiveis.length && (
        <Botao variante="link" className="mt-1" onClick={() => setTodos(true)}>
          Ver os outros {ordenados.length - visiveis.length}
        </Botao>
      )}
    </>
  );
}

const MAXIMO_DE_ENCARGOS = 4;

/** Cada assinatura pode virar conta fixa mensal; nenhuma vira sem a pessoa marcar. */
function Assinaturas({
  lista,
  noCartao,
  jaFixas,
  marcadas,
  aoMudar,
}: {
  lista: Lancamento[];
  noCartao: boolean;
  jaFixas: Set<string>;
  marcadas: string[];
  aoMudar: (id: string, mensal: boolean) => void;
}) {
  const total = lista.reduce((t, l) => t + l.valor, 0);
  return (
    <Painel titulo={`Assinaturas encontradas · ${reais(total)}`}>
      <Sub className="mb-1">
        Marque as que você paga todo mês. Elas entram em Contas como assinatura
        {noCartao ? " e, como já vêm na fatura do cartão, não contam duas vezes." : "."}
      </Sub>
      <ul>
        {lista.map((l) => {
          const nome = descricaoLegivel(l.descricao);
          const jaE = jaFixas.has(chaveDaConta(nome, l.valor));
          return (
            <li key={l.id} className="border-b border-line last:border-0">
              <label className={`flex min-h-12 items-center gap-3 py-2 ${jaE ? "" : "cursor-pointer"}`}>
                {jaE ? (
                  <Check aria-hidden="true" className="size-5 shrink-0 text-good" />
                ) : (
                  <input
                    type="checkbox"
                    checked={marcadas.includes(l.id)}
                    onChange={(e) => aoMudar(l.id, e.target.checked)}
                    className="size-5 shrink-0 accent-[var(--primary)]"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{nome}</span>
                  {jaE && <span className="text-[0.82rem] text-muted">já está em Contas</span>}
                </span>
                <b className="shrink-0">{reais(l.valor)}</b>
              </label>
            </li>
          );
        })}
      </ul>
    </Painel>
  );
}

/** Mesmo nome e valor: a assinatura já é conta fixa. Igual ao que o servidor confere. */
const chaveDaConta = (nome: string, valor: number) => `${chaveDaDescricao(nome)}:${valor}`;

const POR_VEZ = 10;

/**
 * Compras novas: um resumo e, se a pessoa quiser, uma lista curta (maiores
 * primeiro, uma linha por compra). Tocar abre as carinhas daquela compra.
 * Tudo opcional: dá para salvar sem responder nenhuma.
 */
function ComprasNovas({
  lista,
  classificacoes,
  aoClassificar,
}: {
  lista: Lancamento[];
  classificacoes: Record<string, Classificacao>;
  aoClassificar: (id: string, m: Classificacao) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [quantas, setQuantas] = useState(POR_VEZ);
  const [atual, setAtual] = useState<string | null>(null);
  const ordenadas = [...lista].sort((a, b) => b.valor - a.valor);
  const visiveis = ordenadas.slice(0, quantas);
  const total = lista.reduce((t, l) => t + l.valor, 0);
  const respondidas = lista.filter((l) => classificacoes[l.id]?.emocao || classificacoes[l.id]?.necessidade).length;

  function responder(id: string, m: Classificacao) {
    aoClassificar(id, m);
    const junta = { ...classificacoes[id], ...m };
    if (!junta.emocao || !junta.necessidade) return;
    // Respondeu as duas: abre a próxima ainda sem resposta.
    const i = visiveis.findIndex((l) => l.id === id);
    const proxima = visiveis.slice(i + 1).find((l) => !classificacoes[l.id]?.emocao && !classificacoes[l.id]?.necessidade);
    setAtual(proxima?.id ?? null);
  }

  return (
    <Painel titulo={`Compras novas (${lista.length})`}>
      <p>
        Somam <b>{reais(total)}</b>
        {respondidas > 0 && <span className="text-muted"> · {respondidas} com resposta</span>}
      </p>
      <Sub className="mt-0.5">Lembra como estava em alguma? É opcional: dá para salvar sem responder.</Sub>
      {!aberta ? (
        <Botao variante="secundario" bloco className="mt-3" onClick={() => setAberta(true)}>
          Contar como eu estava
          <ChevronDown aria-hidden="true" />
        </Botao>
      ) : (
        <>
          <ul className="mt-2">
            {visiveis.map((l) => {
              const nome = descricaoLegivel(l.descricao);
              const c = classificacoes[l.id] ?? {};
              const expandida = atual === l.id;
              return (
                <li key={l.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    aria-expanded={expandida}
                    onClick={() => setAtual(expandida ? null : l.id)}
                    className="flex min-h-12 w-full items-center gap-3 py-2 text-left"
                  >
                    {c.emocao ? (
                      <span
                        aria-label={NOME_DA_EMOCAO[c.emocao]}
                        className="grid size-7 shrink-0 place-items-center rounded-full border-2 text-ink [&_svg]:size-4"
                        style={{ borderColor: COR_DA_EMOCAO[c.emocao], background: `color-mix(in srgb, ${COR_DA_EMOCAO[c.emocao]} 28%, var(--surface))` }}
                      >
                        <RostoSvg emocao={c.emocao} />
                      </span>
                    ) : (
                      <span aria-hidden="true" className="size-7 shrink-0 rounded-full border-2 border-dashed border-line" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{nome}</span>
                      {(l.parcela && l.totalParcelas) || c.necessidade ? (
                        <span className="block text-[0.82rem] text-muted">
                          {[l.parcela && l.totalParcelas ? `Parcela ${l.parcela} de ${l.totalParcelas}` : null, c.necessidade ? NOME_DA_NECESSIDADE[c.necessidade] : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </span>
                    <b className="shrink-0">{reais(l.valor)}</b>
                    <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-muted transition-transform ${expandida ? "rotate-180" : ""}`} />
                  </button>
                  {expandida && (
                    <div className="pb-3">
                      {l.parcela && l.totalParcelas && (
                        <p className="text-[0.85rem] text-muted">O que você responder vale para a compra inteira ({reais(l.valor * l.totalParcelas)}).</p>
                      )}
                      <ClassificarCompra nome={nome} valor={c} aoMudar={(m) => responder(l.id, m)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {ordenadas.length > quantas && (
            <Botao variante="secundario" bloco className="mt-2" onClick={() => setQuantas((q) => q + POR_VEZ)}>
              Ver mais {Math.min(POR_VEZ, ordenadas.length - quantas)} (faltam {ordenadas.length - quantas})
            </Botao>
          )}
        </>
      )}
    </Painel>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-[12px] bg-surface px-3 py-2">
      <dt className="text-[0.8rem] text-muted">{rotulo}</dt>
      <dd className="font-bold">{valor}</dd>
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
