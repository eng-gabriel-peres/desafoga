"use client";

import { Bot, Check, EyeOff, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { TONS } from "@/lib/assistente/textos";
import { chaveDoDia } from "@/lib/finance";
import { nomeDoDia } from "@/lib/formatar";
import { servicos, type Memoria, type Persona, type Profissional, type Tom } from "@/services";
import { Digitando } from "../chat/chat";
import { useEu } from "../sessao";
import { Avatar, Carregando, Chip, Opcao, Painel, Sub } from "../ui/blocos";
import { Botao } from "../ui/botao";

/** Características que o profissional pode marcar. */
const CARACTERISTICAS = [
  "Age por impulso",
  "Compra quando está triste",
  "Compra quando está ansiosa",
  "Compra à noite",
  "Compra por tédio",
  "Esconde compras da família",
  "Responde bem a elogios",
  "Prefere mensagens curtas",
  "Se assusta com números grandes",
  "Tem dificuldade com contas",
];

const TESTES = ["Tô triste e com vontade de comprar uma roupa", "E se eu pagar 200 a mais por mês?", "Quanto eu pago de juros?"];

const CAMPO =
  "w-full rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 outline-none focus:border-primary";

export function TelaMemoria({ pessoaId }: { pessoaId: string }) {
  const dados = useConsulta(`memoria:${pessoaId}`, async () => {
    const [persona, memoria, profissionais] = await Promise.all([
      servicos.pessoas.obter(pessoaId),
      servicos.memoria.obter(pessoaId),
      servicos.pessoas.profissionais(pessoaId),
    ]);
    return { persona, memoria, profissionais };
  });
  if (!dados?.persona) return <Carregando />;
  const { persona, memoria, profissionais } = dados;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] desk:gap-5">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        {/* key: ao trocar de paciente, os campos recomeçam com a memória dele. */}
        <JeitoDeSer key={persona.id} persona={persona} memoria={memoria} />
        <Anotacoes key={`n-${persona.id}`} persona={persona} memoria={memoria} profissionais={profissionais} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 desk:sticky desk:top-28">
        <Testar key={persona.id} persona={persona} />
      </div>
    </div>
  );
}

function JeitoDeSer({ persona, memoria }: { persona: Persona; memoria: Memoria }) {
  const [nova, setNova] = useState("");
  const [objetivo, setObjetivo] = useState(memoria.objetivo);
  const [evitar, setEvitar] = useState(memoria.evitar);
  const salvar = (m: Partial<Omit<Memoria, "anotacoes">>) => servicos.memoria.salvar(persona.id, m);
  const opcoes = [...new Set([...CARACTERISTICAS, ...memoria.caracteristicas])];

  function alternar(c: string) {
    const marcadas = memoria.caracteristicas.includes(c)
      ? memoria.caracteristicas.filter((x) => x !== c)
      : [...memoria.caracteristicas, c];
    salvar({ caracteristicas: marcadas });
  }

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const texto = nova.trim();
    if (!texto) return;
    salvar({ caracteristicas: [...new Set([...memoria.caracteristicas, texto])] });
    setNova("");
  }

  return (
    <Painel titulo={`Como ${persona.apelido} é`}>
      <Sub className="mb-2.5">Marque o que você percebeu. A Luana leva isso em conta em cada resposta.</Sub>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Características">
        {opcoes.map((c) => {
          const marcada = memoria.caracteristicas.includes(c);
          return (
            <Chip key={c} pequeno marcado={marcada} onClick={() => alternar(c)}>
              {marcada && <Check aria-hidden="true" />}
              {c}
            </Chip>
          );
        })}
      </div>
      <form onSubmit={adicionar} className="mt-2.5 flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Outra característica</span>
          <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Outra característica" autoComplete="off" className={`${CAMPO} min-h-11`} />
        </label>
        <Botao type="submit" variante="secundario" tamanho="pequeno">
          <Plus aria-hidden="true" />
          Adicionar
        </Botao>
      </form>

      <div className="mt-4">
        <p id="tom" className="mb-1.5 font-bold">
          Tom da Luana
        </p>
        <div role="radiogroup" aria-labelledby="tom" className="grid gap-2">
          {(Object.keys(TONS) as Tom[]).map((t) => (
            <Opcao key={t} marcada={memoria.tom === t} onClick={() => salvar({ tom: t })} titulo={TONS[t].nome} descricao={TONS[t].descricao} />
          ))}
        </div>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block font-bold">Objetivo atual</span>
        <input
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          onBlur={() => objetivo !== memoria.objetivo && salvar({ objetivo })}
          placeholder="Ex.: sair do rotativo até fevereiro"
          autoComplete="off"
          className={`${CAMPO} min-h-12`}
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block font-bold">O que evitar</span>
        <textarea
          value={evitar}
          onChange={(e) => setEvitar(e.target.value)}
          onBlur={() => evitar !== memoria.evitar && salvar({ evitar })}
          placeholder="Ex.: não usar tom de bronca"
          rows={3}
          className={`${CAMPO} py-2.5`}
        />
      </label>
      <Sub className="mt-1.5">Objetivo e o que evitar são salvos quando você sai do campo.</Sub>
    </Painel>
  );
}

function Anotacoes({ persona, memoria, profissionais }: { persona: Persona; memoria: Memoria; profissionais: Profissional[] }) {
  const agora = useAgora();
  const eu = useEu();
  const [texto, setTexto] = useState("");
  const [privada, setPrivada] = useState(false);
  const autor = (id: string) => profissionais.find((p) => p.id === id);
  const lista = [...memoria.anotacoes].sort((a, b) => b.quando.localeCompare(a.quando));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    await servicos.memoria.anotar(persona.id, { texto: texto.trim(), privada });
    setTexto("");
    setPrivada(false);
  }

  return (
    <Painel titulo="Anotações das conversas">
      <Sub className="mb-2.5">
        Depois de uma conversa com {persona.apelido}, registre o que entendeu. Todos os profissionais que acompanham {persona.apelido} veem estas notas.
      </Sub>
      <form onSubmit={salvar} className="grid gap-2.5">
        {eu.profissional && (
          <p className="text-[0.92rem] text-muted">
            Escrevendo como <b className="text-ink">{eu.profissional.nome}</b>, {eu.profissional.papel}.
          </p>
        )}
        <label>
          <span className="sr-only">Anotação</span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder={`Ex.: Na conversa de hoje percebi que ${persona.apelido} compra por impulso quando…`}
            className={`${CAMPO} py-2.5`}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={privada} onChange={(e) => setPrivada(e.target.checked)} className="size-5 accent-[var(--primary)]" />
            <span>Privada ({persona.apelido} não vê)</span>
          </label>
          <Botao type="submit" tamanho="pequeno">
            <Plus aria-hidden="true" />
            Salvar anotação
          </Botao>
        </div>
      </form>
      <ul className="mt-2">
        {lista.length === 0 && <li className="py-2 text-muted">Nenhuma anotação ainda.</li>}
        {lista.map((n) => {
          const a = autor(n.autorId);
          return (
            <li key={n.id} className="flex gap-3 border-b border-line py-3 last:border-0">
              <Avatar nome={a?.nome ?? "?"} cor={a?.cor ?? "var(--muted)"} tamanho="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <b>{a?.nome ?? "Profissional"}</b>
                  <span className="text-[0.85rem] text-muted">
                    {a?.papel}
                    {agora && `, ${nomeDoDia(chaveDoDia(new Date(n.quando)), agora).toLowerCase()}`}
                  </span>
                  {n.privada && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-maybe-soft px-2 py-0.5 text-[0.78rem] font-bold text-maybe">
                      <EyeOff aria-hidden="true" className="size-3.5" />
                      Privada
                    </span>
                  )}
                </p>
                <p className="mt-1">{n.texto}</p>
              </div>
              <button
                type="button"
                onClick={() => servicos.memoria.apagarAnotacao(persona.id, n.id)}
                aria-label={`Apagar anotação de ${a?.nome ?? "profissional"}`}
                className="grid size-11 shrink-0 place-items-center rounded-[10px] border border-line bg-surface2 text-muted hover:border-bad hover:text-bad"
              >
                <Trash2 aria-hidden="true" className="size-4.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </Painel>
  );
}

function Testar({ persona }: { persona: Persona }) {
  const [texto, setTexto] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);
  const [pensando, setPensando] = useState(false);
  const contexto = useConsulta(`contexto:${persona.id}`, () => servicos.assistente.contexto(persona.id));

  async function testar(mensagem: string) {
    if (!mensagem.trim()) return;
    setPensando(true);
    setResposta(null);
    setResposta(await servicos.assistente.testar(persona.id, mensagem));
    setPensando(false);
  }

  return (
    <>
      <Painel titulo="Testar o assistente" acao={<Bot aria-hidden="true" className="size-5 text-muted" />}>
        <Sub className="mb-2.5">
          Escreva como se fosse {persona.apelido} e veja como a Luana responderia com esta memória. Nada é enviado para {persona.apelido}.
        </Sub>
        <div className="mb-2.5 flex flex-wrap gap-2">
          {TESTES.map((t) => (
            <Chip
              key={t}
              pequeno
              marcado={false}
              onClick={() => {
                setTexto(t);
                testar(t);
              }}
            >
              {t}
            </Chip>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            testar(texto);
          }}
          className="flex gap-2"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Mensagem de teste</span>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Mensagem de teste" autoComplete="off" className="min-h-12 w-full rounded-full border-2 border-line bg-surface px-4 outline-none focus:border-primary" />
          </label>
          <button type="submit" aria-label="Testar" disabled={pensando} className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-ink disabled:opacity-60">
            <Send aria-hidden="true" className="size-5" />
          </button>
        </form>
        <div aria-live="polite">
          {(pensando || resposta) && (
            <div className="mt-3 rounded-2xl bg-chat-bg p-3.5">
              <p className="max-w-full rounded-2xl rounded-tl-[4px] bg-chat-bot px-3 py-2 whitespace-pre-wrap">
                {pensando ? <Digitando /> : resposta}
              </p>
            </div>
          )}
        </div>
        <Sub className="mt-2.5">Resposta de demonstração, por regras locais. Com a IA real, o modelo escreve usando o contexto abaixo.</Sub>
      </Painel>
      <Painel>
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center font-bold">Ver o que o assistente recebe</summary>
          <Sub className="mt-1 mb-2">Texto montado a partir da memória e dos números calculados pelo sistema.</Sub>
          <pre className="max-h-[28rem] overflow-auto rounded-xl border border-line bg-surface2 p-3 font-sans text-[0.85rem] whitespace-pre-wrap">
            {contexto ?? "Carregando…"}
          </pre>
        </details>
      </Painel>
    </>
  );
}
