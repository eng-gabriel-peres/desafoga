"use client";

import { BookOpen, ChevronLeft, Plus, Send, SquarePen, Trash2, TriangleAlert, UserCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { TEMAS, type Tema } from "@/lib/desafoga/conteudos";
import { quando } from "@/lib/formatar";
import { servicos, type Criador, type FeedDeConteudos } from "@/services";
import { AcoesDoConteudo, CabecalhoDoConteudo, CartaoDoConteudo, fundoDaCapa, ICONE_DO_TIPO, Verificado } from "../conteudos/cartao";
import { useEu } from "../sessao";
import { Avatar, Carregando, Chip, Kpi, Painel, Sub, Vazio } from "../ui/blocos";
import { Botao, BotaoLink } from "../ui/botao";
import { CAMPO } from "../ui/campos";

type Filtro = "todos" | "seguindo" | "salvos";

/** Onde fica Conteúdos em cada área. */
const useBase = () => (useEu().profissional ? "/painel/conteudos" : "/app/conteudos");

function BotaoSeguir({ c }: { c: Criador }) {
  const [ocupado, setOcupado] = useState(false);
  const Icone = c.sigo ? UserCheck : UserPlus;
  return (
    <Botao
      tamanho="pequeno"
      variante={c.sigo ? "secundario" : "primario"}
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true);
        await servicos.conteudos.seguir(c.id).finally(() => setOcupado(false));
      }}
    >
      <Icone aria-hidden="true" />
      {c.sigo ? "Seguindo" : "Seguir"}
    </Botao>
  );
}

/** Os profissionais em círculos, como stories; anel colorido se publicou nos últimos 2 dias. */
function Stories({ feed, base, publicar }: { feed: FeedDeConteudos; base: string; publicar: boolean }) {
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      {publicar && (
        <Link href="/painel/conteudos/novo" className="flex w-16 shrink-0 flex-col items-center gap-1 text-[0.8rem] font-bold">
          <span className="grid size-16 place-items-center rounded-full border-2 border-dashed border-primary text-primary">
            <Plus aria-hidden="true" className="size-6" />
          </span>
          Publicar
        </Link>
      )}
      {feed.criadores.map((c) => (
        <Link key={c.id} href={`${base}/perfil/${c.id}`} className="flex w-16 shrink-0 flex-col items-center gap-1 text-[0.8rem] font-bold">
          <span className={`rounded-full p-[3px] ${c.recente ? "bg-gradient-to-tr from-maybe to-primary" : "bg-line"}`}>
            <span className="block rounded-full bg-surface p-[2px]">
              <Avatar nome={c.nome} cor={c.cor} tamanho="lg" />
            </span>
          </span>
          <span className="w-full truncate text-center">{c.nome.split(" ")[0]}</span>
        </Link>
      ))}
    </div>
  );
}

/** Feed de Conteúdos: para a pessoa e para o profissional (com a lateral de quem publica). */
export function TelaConteudos() {
  const eu = useEu();
  const base = useBase();
  const feed = useConsulta("conteudos", () => servicos.conteudos.feed());
  const agora = useAgora();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [tema, setTema] = useState<Tema | null>(null);
  if (!feed || !agora) return <Carregando />;

  const profissional = eu.profissional;
  const sigo = new Set(feed.criadores.filter((c) => c.sigo).map((c) => c.id));
  const lista = feed.conteudos
    .filter((c) => filtro !== "seguindo" || sigo.has(c.autor.id))
    .filter((c) => filtro !== "salvos" || c.salvei)
    .filter((c) => !tema || c.tema === tema);
  const vazio =
    filtro === "salvos" ? "Você ainda não salvou nada. Toque no marcador de um post para guardar." : filtro === "seguindo" ? "Siga profissionais para ver os conteúdos deles aqui." : "Nada por aqui com esse filtro.";
  const filtros: [Filtro, string][] = profissional
    ? [
        ["todos", "Para você"],
        ["salvos", "Salvos"],
      ]
    : [
        ["todos", "Para você"],
        ["seguindo", "Seguindo"],
        ["salvos", "Salvos"],
      ];
  const meus = profissional ? feed.conteudos.filter((c) => c.autor.id === profissional.id) : [];

  return (
    <>
      <div className="mb-4 desk:hidden">
        <h1 className="text-[1.7rem] leading-tight font-bold">Conteúdos</h1>
        <p className="mt-0.5 text-muted">{profissional ? "Publique conteúdos para ajudar quem você acompanha" : "Dicas e textos de profissionais para te ajudar"}</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 desk:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <Stories feed={feed} base={base} publicar={Boolean(profissional)} />
          <div className="flex flex-wrap gap-2">
            {filtros.map(([f, rotulo]) => (
              <Chip key={f} marcado={filtro === f} onClick={() => setFiltro(f)}>
                {rotulo}
              </Chip>
            ))}
          </div>
          <div className="-mt-1 flex gap-1.5 overflow-x-auto pb-1 desk:hidden">
            {[null, ...TEMAS].map((t) => (
              <Chip key={t ?? "todos"} pequeno marcado={tema === t} onClick={() => setTema(t)}>
                {t ?? "Todos os temas"}
              </Chip>
            ))}
          </div>
          {tema && (
            <p className="hidden text-[0.9rem] text-muted desk:block">
              Mostrando o tema {tema}.{" "}
              <button type="button" onClick={() => setTema(null)} className="font-bold text-primary">
                Ver todos
              </button>
            </p>
          )}
          {lista.length ? lista.map((c) => <CartaoDoConteudo key={c.id} c={c} base={base} agora={agora} />) : <Vazio>{vazio}</Vazio>}
        </div>
        <aside className="hidden gap-4 desk:grid">
          {profissional ? (
            <>
              <Painel titulo="Seu conteúdo">
                <div className="grid grid-cols-3 gap-2">
                  <Kpi rotulo="Publicações" valor={meus.length} />
                  <Kpi rotulo="Curtidas" valor={meus.reduce((s, c) => s + c.curtidas, 0).toLocaleString("pt-BR")} />
                  <Kpi rotulo="Comentários" valor={meus.reduce((s, c) => s + c.comentarios, 0)} />
                </div>
                <BotaoLink href="/painel/conteudos/novo" bloco tamanho="pequeno" className="mt-3.5">
                  <SquarePen aria-hidden="true" />
                  Publicar conteúdo
                </BotaoLink>
              </Painel>
              <Painel titulo="Comentários para responder">
                {feed.paraResponder.length ? (
                  <ul className="grid gap-1">
                    {feed.paraResponder.map((x, i) => (
                      <li key={i}>
                        <Link href={`${base}/${x.conteudoId}`} className="flex items-start gap-2.5 rounded-xl p-2 hover:bg-surface2">
                          <Avatar nome={x.nome} cor={x.cor} tamanho="sm" />
                          <span>
                            <b>{x.nome}</b> {x.texto}
                            <span className="block text-[0.82rem] text-muted">em {x.titulo}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Sub>Tudo respondido por aqui.</Sub>
                )}
              </Painel>
            </>
          ) : (
            <Painel titulo="Profissionais">
              <ul className="grid gap-3">
                {feed.criadores.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5">
                    <Link href={`${base}/perfil/${c.id}`}>
                      <Avatar nome={c.nome} cor={c.cor} tamanho="sm" />
                    </Link>
                    <span className="min-w-0 flex-1">
                      <Link href={`${base}/perfil/${c.id}`} className="font-bold hover:underline">
                        {c.nome}
                      </Link>{" "}
                      <Verificado />
                      <span className="block text-[0.85rem] text-muted">{c.papel}</span>
                    </span>
                    <BotaoSeguir c={c} />
                  </li>
                ))}
              </ul>
            </Painel>
          )}
          <Painel titulo="Temas">
            <div className="flex flex-wrap gap-1.5">
              {TEMAS.map((t) => (
                <Chip key={t} pequeno marcado={tema === t} onClick={() => setTema(tema === t ? null : t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </Painel>
        </aside>
      </div>
    </>
  );
}

function Voltar({ base, rotulo = "Voltar aos conteúdos" }: { base: string; rotulo?: string }) {
  return (
    <Link href={base} className="mb-2 inline-flex items-center gap-1 font-bold text-primary">
      <ChevronLeft aria-hidden="true" className="size-4" /> {rotulo}
    </Link>
  );
}

/** O post aberto: artigo para ler ou o cartão, e os comentários. */
export function TelaDoConteudo({ conteudoId }: { conteudoId: string }) {
  const eu = useEu();
  const base = useBase();
  const c = useConsulta(`conteudo:${conteudoId}`, () => servicos.conteudos.ver(conteudoId));
  const agora = useAgora();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  if (!c || !agora) return <Carregando />;

  async function comentar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    await servicos.conteudos
      .comentar(conteudoId, texto.trim())
      .then(() => setTexto(""))
      .finally(() => setEnviando(false));
  }

  return (
    <>
      <Voltar base={base} rotulo="Voltar" />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 desk:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {c.tipo === "artigo" ? (
          <article className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <span className="inline-flex items-center gap-1.5 text-[0.8rem] font-bold tracking-wide text-muted uppercase">
              <BookOpen aria-hidden="true" className="size-4" /> {c.minutos} min de leitura, {c.tema}
            </span>
            <h1 className="mt-2 text-[1.7rem] leading-tight font-bold">{c.titulo}</h1>
            <div className="mt-3">
              <CabecalhoDoConteudo c={c} base={base} agora={agora} />
            </div>
            <div aria-hidden="true" className="mb-4 h-2 rounded-full" style={fundoDaCapa(c.cor)} />
            {c.corpo.map((p, i) => (
              <p key={i} className="mb-3.5 text-[1.05rem] leading-relaxed">
                {p}
              </p>
            ))}
            <AcoesDoConteudo c={c} base={base} />
          </article>
        ) : (
          <CartaoDoConteudo c={c} base={base} agora={agora} completo />
        )}
        <Painel titulo={`Comentários (${c.listaDeComentarios.length})`}>
          {c.listaDeComentarios.length ? (
            <ul className="grid gap-3">
              {c.listaDeComentarios.map((x) => (
                <li key={x.id} className="flex gap-2.5">
                  <Avatar nome={x.autor.nome} cor={x.autor.cor} tamanho="sm" />
                  <div className="min-w-0 flex-1">
                    <p>
                      <b>{x.meu ? "Você" : x.autor.nome}</b> {x.autor.profissional && <Verificado />} {x.texto}
                    </p>
                    <p className="flex items-center gap-2 text-[0.82rem] text-muted">
                      {quando(x.quando, agora)}
                      {x.podeApagar && (
                        <button type="button" onClick={() => servicos.conteudos.apagarComentario(x.id)} className="inline-flex items-center gap-0.5 font-bold hover:text-bad">
                          <Trash2 aria-hidden="true" className="size-3.5" /> Apagar
                        </button>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Sub>Seja a primeira pessoa a comentar.</Sub>
          )}
          <form onSubmit={comentar} className="mt-3.5 flex gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={600}
              autoComplete="off"
              enterKeyHint="send"
              aria-label="Comentário"
              placeholder={eu.profissional ? `Responder como ${eu.profissional.nome}` : "Escreva um comentário"}
              className={`${CAMPO} rounded-full`}
            />
            <button type="submit" aria-label="Publicar comentário" disabled={enviando || !texto.trim()} className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-ink disabled:opacity-50">
              <Send aria-hidden="true" className="size-5" />
            </button>
          </form>
          <p className="mt-3 flex items-start gap-2 text-[0.85rem] text-muted">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Os comentários são públicos para quem usa o Desafoga e moderados pelos profissionais. Se estiver em crise, procure ajuda agora: CVV, ligue 188, 24 horas e grátis.
            </span>
          </p>
        </Painel>
      </div>
    </>
  );
}

/** Perfil do profissional: bio, números e a grade de publicações. */
export function TelaPerfilDoProfissional({ profissionalId }: { profissionalId: string }) {
  const eu = useEu();
  const base = useBase();
  const feed = useConsulta("conteudos", () => servicos.conteudos.feed());
  if (!feed) return <Carregando />;
  const c = feed.criadores.find((x) => x.id === profissionalId);
  if (!c) {
    return (
      <>
        <Voltar base={base} />
        <Vazio>Profissional não encontrado.</Vazio>
      </>
    );
  }
  const posts = feed.conteudos.filter((x) => x.autor.id === c.id);
  return (
    <div className="mx-auto max-w-[760px]">
      <Voltar base={base} />
      <Painel>
        <div className="flex flex-wrap items-center gap-4">
          <span className="scale-150 p-3">
            <Avatar nome={c.nome} cor={c.cor} tamanho="lg" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.35rem] font-bold">
              {c.nome} <Verificado />
            </h2>
            <p className="text-muted">{c.papel}</p>
            <dl className="mt-2 flex gap-5">
              {(
                [
                  [c.publicacoes, "publicações"],
                  [c.seguidores, "seguidores"],
                  [c.curtidas, "curtidas"],
                ] as const
              ).map(([n, rotulo]) => (
                <div key={rotulo}>
                  <dt className="sr-only">{rotulo}</dt>
                  <dd>
                    <b className="block text-[1.15rem]">{n.toLocaleString("pt-BR")}</b>
                    <span className="text-[0.85rem] text-muted">{rotulo}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        {c.bio && <p className="mt-3">{c.bio}</p>}
        <div className="mt-3.5">
          {eu.profissional?.id === c.id ? (
            <BotaoLink href="/painel/conteudos/novo" tamanho="pequeno">
              <SquarePen aria-hidden="true" />
              Publicar conteúdo
            </BotaoLink>
          ) : (
            !eu.profissional && <BotaoSeguir c={c} />
          )}
        </div>
      </Painel>
      <div className="mt-4 grid grid-cols-3 gap-1.5">
        {posts.length ? (
          posts.map((p) => {
            const Icone = ICONE_DO_TIPO[p.tipo];
            return (
              <Link
                key={p.id}
                href={`${base}/${p.id}`}
                aria-label={p.titulo}
                className="relative grid aspect-square content-end overflow-hidden rounded-xl p-2.5 text-white"
                style={fundoDaCapa(p.cor)}
              >
                <Icone aria-hidden="true" className="absolute top-2 right-2 size-4 opacity-90" />
                <span className="line-clamp-3 text-[0.85rem] leading-tight font-bold">{p.titulo}</span>
              </Link>
            );
          })
        ) : (
          <div className="col-span-3">
            <Vazio>Nenhuma publicação ainda.</Vazio>
          </div>
        )}
      </div>
    </div>
  );
}
