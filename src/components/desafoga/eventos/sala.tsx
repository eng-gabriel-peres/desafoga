"use client";

import {
  CalendarDays,
  Check,
  ChevronLeft,
  Crown,
  Flame,
  Gift,
  HandHeart,
  Heart,
  Lightbulb,
  ListChecks,
  MapPin,
  Medal,
  Megaphone,
  MessageSquare,
  Pin,
  PinOff,
  Send,
  Settings,
  Sparkles,
  Trash2,
  TriangleAlert,
  Trophy,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { quando } from "@/lib/formatar";
import { servicos, type PostDoMural, type SalaDoEvento, type TipoDePost } from "@/services";
import { Avatar, Carregando, Etiqueta, Kpi, Painel, Sub, Vazio } from "../ui/blocos";
import { Botao } from "../ui/botao";
import { Barra, CAMPO } from "../ui/campos";
import { Bolinhas, EtiquetaDaFase, hojeNoBrasil, IconeDoEvento, LegendaDasBolinhas, nomeDoTipo, PilhaDeAvatares, quandoDoEvento, regraDoEvento, VoceVai } from "./visual";

type Aba = "mural" | "ranking" | "progresso" | "pessoas" | "config";

const TIPOS_DE_POST: Record<Exclude<TipoDePost, "sistema">, [LucideIcon, string]> = {
  recado: [MessageSquare, "Recado"],
  dica: [Lightbulb, "Dica"],
  conquista: [Trophy, "Conquista"],
  desabafo: [HandHeart, "Desabafo"],
  aviso: [Megaphone, "Aviso"],
};

/**
 * Sala do evento, para a pessoa (`pessoaId`) ou para o profissional dono.
 * O servidor já manda só o que cada um pode ver.
 */
export function SalaDoEventoTela({ eventoId, pessoaId, voltar }: { eventoId: string; pessoaId: string | null; voltar: string }) {
  const evento = useConsulta(`evento:${eventoId}`, () => servicos.eventos.ver(eventoId));
  const agora = useAgora();
  const [aba, setAba] = useState<Aba>("mural");
  if (!evento || !agora) return <Carregando />;

  const desafio = evento.tipo === "desafio";
  const abas: [Aba, LucideIcon, string][] = [["mural", MessageSquare, "Mural"]];
  if (desafio && evento.ranking) abas.push(["ranking", Trophy, "Ranking"]);
  abas.push(desafio ? ["progresso", ListChecks, evento.souDono ? "Andamento" : "Progresso"] : ["pessoas", Users, "Quem vai"]);
  if (evento.souDono) abas.push(["config", Settings, "Configurar"]);
  const atual = abas.some(([a]) => a === aba) ? aba : "mural";

  return (
    <>
      <Link href={voltar} className="mb-2 inline-flex items-center gap-1 font-bold text-primary">
        <ChevronLeft aria-hidden="true" className="size-4" /> Voltar aos eventos
      </Link>
      <Painel>
        <div className="flex items-start gap-3">
          <IconeDoEvento evento={evento} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.35rem] leading-tight font-bold">{evento.nome}</h2>
            <p className="text-[0.9rem] text-muted">{nomeDoTipo(evento)}</p>
          </div>
          <EtiquetaDaFase evento={evento} />
        </div>
        {evento.descricao && <p className="mt-3">{evento.descricao}</p>}
        <div className="mt-3 flex items-center gap-2">
          <PilhaDeAvatares participantes={evento.participantes} />
          <span className="text-[0.88rem] text-muted">
            {evento.participantes.length} {evento.participantes.length === 1 ? "participante" : "participantes"}
          </span>
        </div>
      </Painel>

      <div role="tablist" aria-label="Partes do evento" className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-surface2 p-1">
        {abas.map(([a, Icone, rotulo]) => (
          <button
            key={a}
            role="tab"
            type="button"
            aria-selected={atual === a}
            onClick={() => setAba(a)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3 font-bold whitespace-nowrap text-muted aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow-[0_0_0_1px_var(--line)] [&_svg]:size-4"
          >
            <Icone aria-hidden="true" />
            {rotulo}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] desk:gap-5">
        <div role="tabpanel" className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {atual === "mural" && <Mural evento={evento} agora={agora} />}
          {atual === "ranking" && <Ranking evento={evento} pessoaId={pessoaId} />}
          {atual === "progresso" && (evento.souDono ? <Andamento evento={evento} agora={agora} /> : <MeuProgresso evento={evento} pessoaId={pessoaId} agora={agora} />)}
          {atual === "pessoas" && <QuemVai evento={evento} pessoaId={pessoaId} />}
          {atual === "config" && <Configurar evento={evento} voltar={voltar} />}
        </div>
        <Lateral evento={evento} pessoaId={pessoaId} />
      </div>
    </>
  );
}

function Mural({ evento, agora }: { evento: SalaDoEvento; agora: Date }) {
  const [texto, setTexto] = useState("");
  const tipos = (Object.keys(TIPOS_DE_POST) as (keyof typeof TIPOS_DE_POST)[]).filter((t) => t !== "aviso" || evento.souDono);
  const [tipo, setTipo] = useState<keyof typeof TIPOS_DE_POST>("recado");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function publicar() {
    if (!texto.trim()) return;
    setEnviando(true);
    setErro("");
    try {
      await servicos.eventos.postar(evento.id, tipo, texto.trim());
      setTexto("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para publicar agora.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Painel titulo={evento.souDono ? "Escreva para o grupo" : "Compartilhe com o grupo"}>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={1000}
          rows={3}
          aria-label="Texto do post"
          placeholder={evento.souDono ? "Um aviso, um incentivo, uma pergunta…" : "Como está indo? Uma dica, uma conquista, um desabafo…"}
          className={`${CAMPO} py-2.5`}
        />
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <div className="flex flex-1 flex-wrap gap-1.5">
            {tipos.map((t) => {
              const [Icone, rotulo] = TIPOS_DE_POST[t];
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tipo === t}
                  onClick={() => setTipo(t)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border-2 border-line bg-surface px-2.5 text-[0.85rem] font-bold aria-pressed:border-primary aria-pressed:bg-primary-soft [&_svg]:size-3.5"
                >
                  <Icone aria-hidden="true" />
                  {rotulo}
                </button>
              );
            })}
          </div>
          <Botao tamanho="pequeno" disabled={enviando || !texto.trim()} onClick={publicar}>
            <Send aria-hidden="true" />
            Publicar
          </Botao>
        </div>
        {erro && (
          <p role="alert" className="mt-2 font-bold text-bad">
            {erro}
          </p>
        )}
      </Painel>
      {evento.posts.length ? (
        <ul className="grid gap-3">
          {evento.posts.map((p) => (
            <li key={p.id}>
              <CartaoDoPost evento={evento} post={p} agora={agora} />
            </li>
          ))}
        </ul>
      ) : (
        <Vazio>Ninguém postou ainda. Que tal começar?</Vazio>
      )}
    </>
  );
}

function CartaoDoPost({ evento, post: p, agora }: { evento: SalaDoEvento; post: PostDoMural; agora: Date }) {
  if (p.autor.tipo === "sistema") {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-surface2 px-3.5 py-2.5 text-[0.9rem] text-muted">
        <Sparkles aria-hidden="true" className="size-4 shrink-0" />
        <span className="flex-1">{p.texto}</span>
        <time className="text-[0.8rem]">{quando(p.quando, agora)}</time>
      </p>
    );
  }
  const [Icone, rotulo] = TIPOS_DE_POST[p.tipo as keyof typeof TIPOS_DE_POST] ?? TIPOS_DE_POST.recado;
  const podeApagar = evento.souDono || p.meu;
  return (
    <article className={`rounded-[var(--radius-card)] border bg-surface p-4 ${p.fixado ? "border-primary" : "border-line"}`}>
      {p.fixado && (
        <p className="mb-2 flex items-center gap-1 text-[0.82rem] font-bold text-primary">
          <Pin aria-hidden="true" className="size-3.5" /> Fixado por {evento.profissional.nome.split(" ")[0]}
        </p>
      )}
      <div className="flex items-center gap-2.5">
        <Avatar nome={p.autor.nome} cor={p.autor.cor} tamanho="sm" />
        <div className="min-w-0 flex-1">
          <b>{p.meu ? "Você" : p.autor.nome}</b> {p.autor.tipo === "profissional" && <Etiqueta tom="primaria">Responsável</Etiqueta>}
          <p className="text-[0.82rem] text-muted">{quando(p.quando, agora)}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-[0.8rem] font-bold text-muted">
          <Icone aria-hidden="true" className="size-3.5" />
          {rotulo}
        </span>
      </div>
      <p className="mt-2.5 whitespace-pre-line">{p.texto}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <AcaoDoPost Icone={Heart} marcado={p.apoiei} onClick={() => servicos.eventos.apoiar(evento.id, p.id)}>
          Apoiar{p.apoios ? ` ${p.apoios}` : ""}
        </AcaoDoPost>
        {evento.souDono && (
          <AcaoDoPost Icone={p.fixado ? PinOff : Pin} onClick={() => servicos.eventos.fixar(evento.id, p.id)}>
            {p.fixado ? "Desafixar" : "Fixar"}
          </AcaoDoPost>
        )}
        {podeApagar && (
          <AcaoDoPost Icone={Trash2} onClick={() => servicos.eventos.apagarPost(evento.id, p.id)}>
            Apagar
          </AcaoDoPost>
        )}
      </div>
    </article>
  );
}

function AcaoDoPost({ Icone, marcado, onClick, children }: { Icone: LucideIcon; marcado?: boolean; onClick: () => Promise<void>; children: React.ReactNode }) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={marcado}
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true);
        await onClick().finally(() => setOcupado(false));
      }}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[0.88rem] font-bold text-muted hover:bg-surface2 aria-pressed:text-bad [&_svg]:size-4 aria-pressed:[&_svg]:fill-current"
    >
      <Icone aria-hidden="true" />
      {children}
    </button>
  );
}

function Ranking({ evento, pessoaId }: { evento: SalaDoEvento; pessoaId: string | null }) {
  const linhas = evento.ranking ?? [];
  if (!linhas.length) return <Vazio>Ninguém no desafio ainda.</Vazio>;
  const nome = (r: (typeof linhas)[number]) => (r.pessoaId === pessoaId ? "Você" : r.apelido);
  return (
    <>
      <Painel titulo="Quem está na frente" acao={<span className="text-[0.85rem] text-muted">Atualiza a cada compra registrada</span>}>
        <div className="mb-3 grid grid-cols-3 items-end gap-2">
          {linhas.slice(0, 3).map((r) => (
            <div
              key={r.pessoaId}
              className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-center ${r.pessoaId === pessoaId ? "border-primary bg-primary-soft" : "border-line bg-surface2"}`}
            >
              {r.posicao === 1 ? <Crown aria-hidden="true" className="size-5 text-maybe" /> : <Medal aria-hidden="true" className="size-5 text-muted" />}
              <Avatar nome={r.nome} cor={r.cor} tamanho="lg" />
              <b>{nome(r)}</b>
              <span className="font-bold text-primary">{r.pontos} pts</span>
              <span className="text-[0.8rem] text-muted">{r.posicao}º lugar</span>
            </div>
          ))}
        </div>
        <ol className="grid">
          {linhas.map((r) => (
            <li key={r.pessoaId} className={`flex items-center gap-2.5 border-b border-line py-2.5 last:border-0 ${r.pessoaId === pessoaId ? "font-bold" : ""}`}>
              <span className="w-7 text-center font-bold">{r.posicao}º</span>
              <Avatar nome={r.nome} cor={r.cor} tamanho="sm" />
              <span className="min-w-0 flex-1">
                <b className="block truncate">{r.pessoaId === pessoaId ? "Você" : r.nome}</b>
                <span className="text-[0.85rem] font-normal text-muted">
                  {r.ok} de {r.contados} {r.contados === 1 ? "dia" : "dias"} na regra
                </span>
              </span>
              <span title="Dias seguidos" className="inline-flex items-center gap-0.5 text-maybe">
                <Flame aria-hidden="true" className="size-4" />
                {r.sequencia}
                <span className="sr-only"> dias seguidos</span>
              </span>
              <b className="w-16 text-right">
                {r.pontos}
                <small className="font-normal text-muted"> pts</small>
              </b>
            </li>
          ))}
        </ol>
      </Painel>
      <Painel titulo="Como os pontos funcionam">
        <ul className="grid gap-2">
          <li className="flex items-start gap-2">
            <Check aria-hidden="true" className="mt-0.5 size-4 text-good" />
            <span>
              <b>10 pontos</b> por dia dentro da regra
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Flame aria-hidden="true" className="mt-0.5 size-4 text-maybe" />
            <span>
              <b>+5 pontos</b> por dia seguido, a partir do segundo
            </span>
          </li>
          <li className="flex items-start gap-2">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 text-muted" />
            <span>Compras não registradas não contam. Combine com o grupo registrar tudo.</span>
          </li>
        </ul>
      </Painel>
    </>
  );
}

function MeuProgresso({ evento, pessoaId, agora }: { evento: SalaDoEvento; pessoaId: string | null; agora: Date }) {
  const meu = evento.andamento.find((a) => a.pessoaId === pessoaId);
  if (!meu) return null;
  const hoje = hojeNoBrasil(agora);
  const hojeOk = meu.dias.find((d) => d.dia === hoje)?.estado;
  return (
    <Painel titulo="Seus dias">
      <LegendaDasBolinhas />
      <Bolinhas dias={meu.dias} hoje={hoje} grande />
      {evento.situacao.fase === "agora" &&
        (hojeOk === "ok" ? (
          <p className="mt-3 flex items-center gap-1.5 font-bold text-good">
            <Check aria-hidden="true" className="size-4" /> Hoje você está dentro da regra.
          </p>
        ) : hojeOk === "fora" ? (
          <p className="mt-3 font-bold text-maybe">Hoje ficou fora da regra. Amanhã é um novo dia.</p>
        ) : null)}
      <div className="mt-4 grid grid-cols-2 gap-3 desk:grid-cols-4">
        <Kpi rotulo="Dias na regra" valor={`${meu.ok} de ${meu.contados}`} />
        <Kpi rotulo="Seguidos agora" valor={meu.sequencia} />
        <Kpi rotulo="Pontos" valor={meu.pontos} />
        <Kpi rotulo="Grupo" valor={evento.grupo === null ? "–" : `${evento.grupo}%`} />
      </div>
    </Painel>
  );
}

function Andamento({ evento, agora }: { evento: SalaDoEvento; agora: Date }) {
  const hoje = hojeNoBrasil(agora);
  return (
    <Painel titulo="Andamento do grupo" acao={<span className="text-[0.85rem] text-muted">{evento.grupo === null ? "Começa em breve" : `${evento.grupo}% dos dias cumpridos`}</span>}>
      <LegendaDasBolinhas />
      {evento.participantes.length ? (
        <ul>
          {evento.participantes.map((p) => {
            const a = evento.andamento.find((x) => x.pessoaId === p.pessoaId);
            return (
              <li key={p.pessoaId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-b border-line py-3 last:border-0 desk:grid-cols-[150px_minmax(0,1fr)_auto_auto]">
                <span className="flex items-center gap-2">
                  <Avatar nome={p.nome} cor={p.cor} tamanho="sm" />
                  <b className="truncate">{p.apelido}</b>
                </span>
                <span className="col-span-2 row-start-2 desk:col-span-1 desk:row-start-auto">{a && <Bolinhas dias={a.dias} hoje={hoje} />}</span>
                <span className="text-right whitespace-nowrap">
                  <b>
                    {a?.ok ?? 0} de {a?.contados ?? 0}
                  </b>
                  <span className="block text-[0.82rem] text-muted">{a?.sequencia ?? 0} seguidos</span>
                </span>
                <RemoverParticipante evento={evento} pessoaId={p.pessoaId} nome={p.apelido} />
              </li>
            );
          })}
        </ul>
      ) : (
        <Sub>Ninguém no desafio ainda.</Sub>
      )}
      <AdicionarParticipante evento={evento} />
    </Painel>
  );
}

function RemoverParticipante({ evento, pessoaId, nome }: { evento: SalaDoEvento; pessoaId: string; nome: string }) {
  return (
    <button
      type="button"
      aria-label={`Remover ${nome} do evento`}
      onClick={() => servicos.eventos.remover(evento.id, pessoaId)}
      className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface2 hover:text-bad"
    >
      <X aria-hidden="true" className="size-4" />
    </button>
  );
}

function AdicionarParticipante({ evento }: { evento: SalaDoEvento }) {
  const pessoas = useConsulta("pessoas", () => servicos.pessoas.listar());
  const fora = (pessoas ?? []).filter((p) => !evento.participantes.some((x) => x.pessoaId === p.id));
  const [escolhida, setEscolhida] = useState("");
  if (!fora.length) return null;
  const alvo = escolhida && fora.some((p) => p.id === escolhida) ? escolhida : fora[0].id;
  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-2">
      <select value={alvo} onChange={(e) => setEscolhida(e.target.value)} aria-label="Pessoa para adicionar" className={`${CAMPO} flex-[1_1_200px]`}>
        {fora.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
      <Botao variante="secundario" tamanho="pequeno" onClick={() => servicos.eventos.adicionar(evento.id, alvo)}>
        <UserPlus aria-hidden="true" />
        Adicionar
      </Botao>
    </div>
  );
}

const RESPOSTA: Record<string, [string, "boa" | "talvez" | "ruim"]> = { vou: ["Vai", "boa"], talvez: ["Talvez", "talvez"], nao: ["Não vai", "ruim"] };

function QuemVai({ evento, pessoaId }: { evento: SalaDoEvento; pessoaId: string | null }) {
  const eu = evento.participantes.find((p) => p.pessoaId === pessoaId);
  const conta = (r: string) => evento.participantes.filter((p) => p.resposta === r).length;
  return (
    <>
      {eu && (
        <Painel titulo="Você vai?">
          <VoceVai evento={evento} atual={eu.resposta} />
        </Painel>
      )}
      <Painel titulo="Confirmações" acao={<span className="text-[0.85rem] text-muted">{`${conta("vou")} vão, ${conta("talvez")} talvez, ${conta("nao")} não vão`}</span>}>
        <ul>
          {evento.participantes.map((p) => {
            const r = p.resposta ? RESPOSTA[p.resposta] : null;
            return (
              <li key={p.pessoaId} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-0">
                <Avatar nome={p.nome} cor={p.cor} tamanho="sm" />
                <b className="min-w-0 flex-1 truncate">{p.pessoaId === pessoaId ? "Você" : p.nome}</b>
                <Etiqueta tom={r ? r[1] : "neutra"}>{r ? r[0] : "Sem resposta"}</Etiqueta>
                {evento.souDono && <RemoverParticipante evento={evento} pessoaId={p.pessoaId} nome={p.apelido} />}
              </li>
            );
          })}
        </ul>
        {evento.souDono && <AdicionarParticipante evento={evento} />}
      </Painel>
    </>
  );
}

function Configurar({ evento, voltar }: { evento: SalaDoEvento; voltar: string }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  return (
    <>
      {evento.tipo === "desafio" && (
        <Painel titulo="Ranking">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={evento.mostrarRanking}
              onChange={(e) => servicos.eventos.configurar(evento.id, { mostrarRanking: e.target.checked })}
              className="mt-1 size-5 accent-[var(--primary)]"
            />
            <span>Mostrar o ranking para os participantes. Desligado, só você vê.</span>
          </label>
        </Painel>
      )}
      <Painel titulo="Apagar evento">
        <Sub className="mb-2.5">Remove o evento, o mural e o ranking para todos.</Sub>
        {confirmar ? (
          <div className="flex flex-wrap gap-2">
            <Botao
              tamanho="pequeno"
              className="!bg-bad !text-white"
              onClick={async () => {
                await servicos.eventos.apagar(evento.id);
                router.push(voltar);
              }}
            >
              <Trash2 aria-hidden="true" />
              Apagar de vez
            </Botao>
            <Botao variante="secundario" tamanho="pequeno" onClick={() => setConfirmar(false)}>
              Cancelar
            </Botao>
          </div>
        ) : (
          <Botao variante="secundario" tamanho="pequeno" onClick={() => setConfirmar(true)}>
            <Trash2 aria-hidden="true" />
            Apagar evento
          </Botao>
        )}
      </Painel>
    </>
  );
}

function Lateral({ evento, pessoaId }: { evento: SalaDoEvento; pessoaId: string | null }) {
  const linhas: [LucideIcon, string][] =
    evento.tipo === "desafio"
      ? [
          [ListChecks, regraDoEvento(evento)],
          [CalendarDays, quandoDoEvento(evento)],
          ...(evento.premio ? [[Gift, evento.premio] as [LucideIcon, string]] : []),
        ]
      : [
          [CalendarDays, quandoDoEvento(evento)],
          [MapPin, evento.local ?? ""],
          [Users, `${evento.participantes.filter((p) => p.resposta === "vou").length} confirmadas, ${evento.participantes.filter((p) => p.resposta === "talvez").length} talvez`],
        ];
  const minha = evento.ranking?.find((r) => r.pessoaId === pessoaId);
  const frente = evento.ranking?.[0];
  return (
    <Painel>
      {evento.tipo === "desafio" && (minha || frente) && (
        <div className="mb-3 border-b border-line pb-3">
          <span className="text-[0.88rem] text-muted">{minha ? "Sua posição" : "Na frente agora"}</span>
          <b className="block text-[1.8rem] leading-tight">
            {minha ? (
              <>
                {minha.posicao}º <small className="text-[1rem] font-normal text-muted">de {evento.ranking!.length}</small>
              </>
            ) : (
              frente!.apelido
            )}
          </b>
          <span className="text-[0.88rem] text-muted">{(minha ?? frente)!.pontos} pontos</span>
        </div>
      )}
      <ul className="grid gap-1.5">
        {linhas.map(([Icone, texto]) => (
          <li key={texto} className="flex items-start gap-2">
            <Icone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
            <span>{texto}</span>
          </li>
        ))}
      </ul>
      {evento.tipo === "desafio" && (
        <div className="mt-3">
          <Barra fracao={(evento.grupo ?? 0) / 100} tom="primaria" />
          <Sub className="mt-1">{evento.grupo === null ? "O grupo ainda não tem dias para contar" : `O grupo cumpriu ${evento.grupo}% dos dias`}</Sub>
        </div>
      )}
    </Painel>
  );
}
