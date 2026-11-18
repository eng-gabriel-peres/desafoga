"use client";

import { CalendarDays, ChevronLeft, Coins, Info, PartyPopper, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { usePessoa } from "@/hooks/use-pessoa";
import { lerValorEmReais } from "@/lib/dinheiro";
import {
  cabeNoMes,
  chaveDoDia,
  dividaMaisCara,
  guardadoNaMeta,
  metaNoMes,
  situacaoDaMeta,
  VEZES_POR_MES,
  opcoesParaPrazo,
  previsaoDeTermino,
  somarPeriodos,
  type CorDaMeta,
  type Frequencia,
  type IconeDaMeta,
  type Meta,
} from "@/lib/finance";
import { NOME_DA_FREQUENCIA, dataLonga, percentual, reaisCurto } from "@/lib/assistente/textos";
import { servicos } from "@/services";
import { COR_DA_META, ICONE_DA_META } from "../metas/visual";
import { dinheiroDoMesDe } from "../mes";
import { useMinhaPessoaId } from "../sessao";
import { Carregando, Painel, Sub } from "../ui/blocos";
import { Botao, BotaoLink } from "../ui/botao";
import { CAMPO } from "../ui/campos";

const ICONES = Object.keys(ICONE_DA_META).slice(0, 8) as IconeDaMeta[];
const FREQUENCIAS: Frequencia[] = ["dia", "semana", "mes"];
const emTexto = (c: number) => (c ? (c / 100).toFixed(2).replace(".", ",").replace(/,00$/, "") : "");
const PLURAL: Record<Frequencia, [string, string]> = { dia: ["dia", "dias"], semana: ["semana", "semanas"], mes: ["mês", "meses"] };

/** Botões de escolha lado a lado, como abas (Tenho uma data / Sei quanto guardar). */
function Segmentos<T extends string>({ opcoes, valor, mudar, rotulo }: { opcoes: [T, React.ReactNode][]; valor: T; mudar: (v: T) => void; rotulo: string }) {
  return (
    <div role="group" aria-label={rotulo} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line bg-surface2 p-1">
      {opcoes.map(([v, conteudo]) => (
        <button
          key={v}
          type="button"
          aria-pressed={valor === v}
          onClick={() => mudar(v)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[9px] px-2 text-[0.9rem] font-bold whitespace-nowrap text-muted aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-[0_0_0_1px_var(--line)] [&_svg]:size-4"
        >
          {conteudo}
        </button>
      ))}
    </div>
  );
}

/** Nova meta ou ajuste: nome, ícone, cor, valor e como chegar lá (data ou valor por período). */
export function TelaFormularioDaMeta({
  metaId,
  fechar,
}: {
  metaId?: string;
  /** Aberto numa janela: fecha em vez de trocar de página. */
  fechar?: () => void;
}) {
  const pessoaId = useMinhaPessoaId();
  const dados = usePessoa(pessoaId);
  const agora = useAgora();
  if (!dados || !agora) return <Carregando />;
  const meta = metaId ? dados.metas.find((m) => m.id === metaId) : null;
  if (metaId && !meta) return <Sub>Essa meta não existe mais.</Sub>;
  const maisCara = dividaMaisCara(dados.dividas);
  // Até quanto por mês esta meta pode tirar sem o mês passar da renda (no lugar do valor atual dela).
  const atual = meta && !situacaoDaMeta(meta, agora).concluida ? metaNoMes(meta) : 0;
  const cabeAte = cabeNoMes(dinheiroDoMesDe(dados, agora), atual, atual).ate;
  return (
    <Formulario
      pessoaId={pessoaId}
      meta={meta ?? null}
      hoje={chaveDoDia(agora)}
      dividaCara={maisCara && maisCara.taxaMensal >= 0.02 ? maisCara : null}
      cabeAte={cabeAte}
      fechar={fechar}
    />
  );
}

function Formulario({
  pessoaId,
  meta,
  hoje,
  dividaCara,
  cabeAte,
  fechar,
}: {
  pessoaId: string;
  meta: Meta | null;
  hoje: string;
  dividaCara: { nome: string; taxaMensal: number } | null;
  /** Valor no mês que cabe na renda para esta meta; null sem renda informada. */
  cabeAte: number | null;
  fechar?: () => void;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(meta?.nome ?? "");
  const [icone, setIcone] = useState<IconeDaMeta>(meta?.icone ?? "piggy-bank");
  const [cor, setCor] = useState<CorDaMeta>(meta?.cor ?? "azul");
  const [alvo, setAlvo] = useState(emTexto(meta?.alvo ?? 0));
  const [inicial, setInicial] = useState(emTexto(meta?.inicial ?? 0));
  const [modo, setModo] = useState<Meta["modo"]>(meta?.modo ?? "prazo");
  const [prazo, setPrazo] = useState(meta?.prazo ?? somarPeriodos(hoje, "mes", 3));
  const [frequencia, setFrequencia] = useState<Frequencia>(meta?.frequencia ?? "semana");
  const [valor, setValor] = useState(emTexto(meta?.modo === "valor" ? meta.valorPorPeriodo : 0));
  const [lembrete, setLembrete] = useState(meta?.lembrete ?? true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  const voltar = meta ? `/app/metas/${meta.id}` : "/app/metas";
  const valorAlvo = lerValorEmReais(alvo) ?? 0;
  const jaTem = meta ? guardadoNaMeta(meta) : (lerValorEmReais(inicial) ?? 0);
  const falta = Math.max(0, valorAlvo - jaTem);
  const prazoValido = Boolean(prazo) && prazo > hoje;
  const opcoes = prazoValido && falta > 0 ? opcoesParaPrazo(falta, prazo, hoje) : null;
  const valorDoPeriodo = lerValorEmReais(valor) ?? 0;
  const termino = modo === "valor" ? previsaoDeTermino(falta, valorDoPeriodo, frequencia, hoje) : null;

  function calculo() {
    if (!(valorAlvo > 0)) return <Sub>Digite o valor da meta para ver o cálculo.</Sub>;
    if (falta <= 0)
      return (
        <p className="flex items-center gap-1.5 font-bold text-good">
          <PartyPopper aria-hidden="true" className="size-5" />
          Você já tem o valor todo. Meta completa!
        </p>
      );
    if (modo === "prazo") {
      if (!opcoes) return <Sub>Escolha uma data no futuro.</Sub>;
      const quantos: Record<Frequencia, number> = { dia: opcoes.dias, semana: opcoes.semanas, mes: opcoes.meses };
      return (
        <>
          <Sub className="mb-2">
            Para juntar {reaisCurto(falta)} até {dataLonga(prazo)}, escolha como prefere guardar:
          </Sub>
          <div role="group" aria-label="Como prefere guardar" className="grid grid-cols-3 gap-2">
            {FREQUENCIAS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={frequencia === f}
                onClick={() => setFrequencia(f)}
                className="flex flex-col items-center gap-0.5 rounded-[14px] border-2 border-line bg-surface px-1.5 py-3 text-center aria-pressed:border-primary aria-pressed:bg-primary-soft"
              >
                <b className="text-[1.1rem]">{reaisCurto(opcoes[f])}</b>
                <span>{NOME_DA_FREQUENCIA[f].por}</span>
                <span className="text-[0.85rem] text-muted">
                  {quantos[f]} {PLURAL[f][quantos[f] === 1 ? 0 : 1]}
                </span>
              </button>
            ))}
          </div>
        </>
      );
    }
    if (!termino) return <Sub>Digite quanto quer guardar {NOME_DA_FREQUENCIA[frequencia].por}.</Sub>;
    return (
      <div className="flex items-center gap-3 rounded-[14px] bg-primary-soft p-3.5">
        <CalendarDays aria-hidden="true" className="size-6.5 shrink-0 text-primary" />
        <div className="flex flex-col">
          <span className="text-[0.92rem] text-muted">Você completa a meta em</span>
          <b className="text-[1.15rem]">{dataLonga(termino.data)}</b>
          <span className="text-[0.92rem] text-muted">
            {termino.periodos} {PLURAL[frequencia][termino.periodos === 1 ? 0 : 1]} guardando {reaisCurto(valorDoPeriodo)} {NOME_DA_FREQUENCIA[frequencia].por}
          </span>
        </div>
      </div>
    );
  }

  async function salvar() {
    setErro("");
    if (!nome.trim()) return setErro("Dê um nome para a meta.");
    if (!(valorAlvo > 0)) return setErro("Digite o valor da meta.");
    let valorPorPeriodo = 0;
    if (modo === "prazo") {
      if (!prazoValido) return setErro("Escolha uma data no futuro.");
      valorPorPeriodo = opcoes ? opcoes[frequencia] : 0;
    } else {
      valorPorPeriodo = valorDoPeriodo;
      if (!(valorPorPeriodo > 0) && falta > 0) return setErro(`Digite quanto quer guardar ${NOME_DA_FREQUENCIA[frequencia].por}.`);
    }
    setSalvando(true);
    try {
      const salva = await servicos.metas.salvar(pessoaId, {
        ...(meta ? { id: meta.id } : {}),
        nome: nome.trim(),
        icone,
        cor,
        alvo: valorAlvo,
        inicial: meta ? meta.inicial : (lerValorEmReais(inicial) ?? 0),
        modo,
        frequencia,
        valorPorPeriodo,
        prazo: modo === "prazo" ? prazo : null,
        lembrete,
      });
      if (fechar) fechar();
      else router.push(`/app/metas/${salva.id}`);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui salvar.");
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!meta) return;
    if (!confirmarRemocao) return setConfirmarRemocao(true);
    setSalvando(true);
    await servicos.metas.remover(pessoaId, meta.id);
    router.push("/app/metas");
  }

  return (
    <>
      {!fechar && (
        <BotaoLink href={voltar} variante="link">
          <ChevronLeft aria-hidden="true" />
          {meta ? "Voltar à meta" : "Voltar às metas"}
        </BotaoLink>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
        noValidate
        className="mt-2 grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-2 desk:gap-5"
      >
        <div className="grid gap-4">
          <Painel titulo={meta ? "Ajustar meta" : "Nova meta"}>
            <div className="grid gap-4">
              <label>
                <span className="mb-1 block font-bold">Nome da meta</span>
                <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} autoComplete="off" placeholder="Ex.: Viagem, reserva, presente" className={CAMPO} />
              </label>
              <fieldset className="min-w-0">
                <legend className="mb-1.5 font-bold">Ícone</legend>
                <div className="grid max-w-[420px] grid-cols-8 gap-1.5">
                  {ICONES.map((i) => {
                    const [Icone, nomeDoIcone] = ICONE_DA_META[i];
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={icone === i}
                        aria-label={`Ícone ${nomeDoIcone}`}
                        onClick={() => setIcone(i)}
                        className="grid aspect-square place-items-center rounded-xl border-2 border-line bg-surface hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary-soft"
                      >
                        <Icone aria-hidden="true" className="size-6" />
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset className="min-w-0">
                <legend className="mb-1.5 font-bold">Cor</legend>
                <div className="flex flex-wrap gap-2.5">
                  {(Object.entries(COR_DA_META) as [CorDaMeta, string][]).map(([k, c]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={cor === k}
                      aria-label={`Cor ${k === "petroleo" ? "petróleo" : k}`}
                      onClick={() => setCor(k)}
                      className="size-11 rounded-full border-[3px] border-surface shadow-[0_0_0_1px_var(--line)] aria-pressed:shadow-[0_0_0_3px_var(--ink)]"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1 block font-bold">Valor da meta (R$)</span>
                  <input value={alvo} onChange={(e) => setAlvo(e.target.value)} inputMode="decimal" placeholder="1.000" className={CAMPO} />
                </label>
                <label>
                  <span className="mb-1 block font-bold">Já tem guardado (R$)</span>
                  <input
                    value={meta ? emTexto(jaTem) : inicial}
                    onChange={(e) => setInicial(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    disabled={Boolean(meta)}
                    className={`${CAMPO} disabled:opacity-60`}
                  />
                </label>
              </div>
            </div>
          </Painel>
          {dividaCara && (
            <p className="flex gap-2 rounded-[14px] bg-primary-soft px-3.5 py-3 text-[0.95rem]">
              <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                Você tem {dividaCara.nome.toLowerCase()} com juros de {percentual(dividaCara.taxaMensal)} ao mês, mais do que uma poupança costuma render. Uma meta
                pequena de reserva ajuda nos imprevistos, mas vale combinar com quem te acompanha quanto guardar e quanto usar para as dívidas.
              </span>
            </p>
          )}
        </div>

        <Painel titulo="Como você quer chegar lá?">
          <Segmentos
            rotulo="Como chegar na meta"
            valor={modo}
            mudar={(m) => {
              setModo(m);
              setErro("");
            }}
            opcoes={[
              [
                "prazo",
                <>
                  <CalendarDays aria-hidden="true" />
                  Tenho uma data
                </>,
              ],
              [
                "valor",
                <>
                  <Coins aria-hidden="true" />
                  Sei quanto guardar
                </>,
              ],
            ]}
          />
          {modo === "prazo" ? (
            <label className="mt-4 block">
              <span className="mb-1 block font-bold">Até quando?</span>
              <input type="date" value={prazo} min={somarPeriodos(hoje, "dia", 1)} onChange={(e) => setPrazo(e.target.value)} className={CAMPO} />
            </label>
          ) : (
            <>
              <div className="mt-4">
                <span className="mb-1 block font-bold">De quanto em quanto tempo?</span>
                <Segmentos
                  rotulo="De quanto em quanto tempo"
                  valor={frequencia}
                  mudar={setFrequencia}
                  opcoes={FREQUENCIAS.map((f) => [f, `Por ${NOME_DA_FREQUENCIA[f].unidade}`])}
                />
              </div>
              <label className="mt-4 block">
                <span className="mb-1 block font-bold">Quanto {NOME_DA_FREQUENCIA[frequencia].por}? (R$)</span>
                <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="10" className={CAMPO} />
              </label>
            </>
          )}
          <div className="mt-4" aria-live="polite">
            {calculo()}
          </div>
          <label className="mt-3.5 flex min-h-11 items-center gap-2.5">
            <input type="checkbox" checked={lembrete} onChange={(e) => setLembrete(e.target.checked)} className="size-5 accent-[var(--primary)]" />
            <span>Me lembrar no WhatsApp nos dias de guardar</span>
          </label>
          {cabeAte !== null && falta > 0 && (() => {
            const porPeriodo = modo === "prazo" ? (opcoes?.[frequencia] ?? 0) : valorDoPeriodo;
            const ate = Math.floor(cabeAte / VEZES_POR_MES[frequencia] / 100) * 100;
            const passa = metaNoMes({ valorPorPeriodo: porPeriodo, frequencia }) > cabeAte;
            return (
              <p className={`text-[0.92rem] ${passa ? "font-bold text-bad" : "text-muted"}`}>
                {ate > 0
                  ? `Pelo que sobra da sua renda no mês, cabe guardar até ${reaisCurto(ate)} ${NOME_DA_FREQUENCIA[frequencia].por}.${passa ? (modo === "prazo" ? " Aumente o prazo." : " Diminua o valor.") : ""}`
                  : "Não sobra nada da renda este mês: reveja os orçamentos ou o plano das dívidas antes de criar uma meta."}
              </p>
            );
          })()}
          {erro && (
            <p role="alert" className="mt-2 font-bold text-bad">
              {erro}
            </p>
          )}
          <Botao type="submit" tamanho="grande" bloco className="mt-4" disabled={salvando}>
            {meta ? "Salvar ajustes" : "Criar meta"}
          </Botao>
          {meta && (
            <Botao type="button" variante="link" className="mt-2 text-bad!" onClick={apagar} disabled={salvando}>
              <Trash2 aria-hidden="true" />
              {confirmarRemocao ? "Toque de novo para apagar a meta e o histórico" : "Apagar meta"}
            </Botao>
          )}
        </Painel>
      </form>
    </>
  );
}
