"use client";

import { ArrowRight, BadgeCheck, BarChart3, Bookmark, BookOpen, Check, ChevronLeft, ChevronRight, Heart, Layers, Lightbulb, MessageCircle, Send, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CORES_DA_CAPA, type CorDaCapa, type TipoDeConteudo } from "@/lib/desafoga/conteudos";
import { quando } from "@/lib/formatar";
import { servicos, type ConteudoNoFeed } from "@/services";
import { Avatar } from "../ui/blocos";

export const ICONE_DO_TIPO: Record<TipoDeConteudo, LucideIcon> = { dica: Lightbulb, artigo: BookOpen, carrossel: Layers, enquete: BarChart3 };

export const fundoDaCapa = (cor: CorDaCapa) => {
  const [a, b] = CORES_DA_CAPA[cor] ?? CORES_DA_CAPA.azul;
  return { background: `linear-gradient(135deg, ${a}, ${b})` };
};

export function Verificado() {
  return (
    <span title="Profissional verificado" className="inline-flex align-[-2px] text-primary">
      <BadgeCheck aria-hidden="true" className="size-4" />
      <span className="sr-only">Profissional verificado</span>
    </span>
  );
}

const Rotulo = ({ Icone, children }: { Icone: LucideIcon; children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 text-[0.8rem] font-bold tracking-wide uppercase opacity-90">
    <Icone aria-hidden="true" className="size-4" />
    {children}
  </span>
);

/** A imagem do post: dica, capa do artigo, carrossel ou enquete. */
export function Midia({ c }: { c: ConteudoNoFeed }) {
  const [i, setI] = useState(0);
  if (c.tipo === "enquete") return <Enquete c={c} />;
  const capa = "relative grid overflow-hidden rounded-2xl p-6 text-white";
  if (c.tipo === "dica") {
    return (
      <div className={`${capa} aspect-square content-between`} style={fundoDaCapa(c.cor)}>
        <Rotulo Icone={Lightbulb}>{c.titulo || "Dica"}</Rotulo>
        <p className="text-[1.45rem] leading-snug font-bold text-balance">{c.texto || "Seu texto aparece aqui"}</p>
        <span className="text-[0.88rem] opacity-90">{c.autor.nome}</span>
      </div>
    );
  }
  if (c.tipo === "artigo") {
    return (
      <div className={`${capa} aspect-[16/9] content-end gap-2`} style={fundoDaCapa(c.cor)}>
        <Rotulo Icone={BookOpen}>Artigo, {c.minutos} min de leitura</Rotulo>
        <p className="text-[1.5rem] leading-tight font-bold text-balance">{c.titulo || "Título do artigo"}</p>
      </div>
    );
  }
  const total = c.cartoes.length + 1;
  const atual = Math.min(i, total - 1);
  return (
    <div>
      <div className={`${capa} aspect-square content-between px-14`} style={fundoDaCapa(c.cor)} aria-roledescription="carrossel" aria-label={`Cartão ${atual + 1} de ${total}`}>
        <span className="absolute top-3 right-3 rounded-full bg-black/30 px-2 py-0.5 text-[0.8rem] font-bold">
          {atual + 1}/{total}
        </span>
        {atual === 0 ? (
          <>
            <Rotulo Icone={Layers}>Carrossel</Rotulo>
            <p className="text-[1.6rem] leading-tight font-bold text-balance">{c.titulo || "Título do carrossel"}</p>
            <span className="inline-flex items-center gap-1 text-[0.88rem] opacity-90">
              Passe para o lado <ArrowRight aria-hidden="true" className="size-4" />
            </span>
          </>
        ) : (
          <>
            <span className="text-[2.2rem] leading-none font-bold opacity-60">{atual}</span>
            <p className="text-[1.3rem] leading-snug font-bold text-balance">{c.cartoes[atual - 1]}</p>
            <span className="text-[0.88rem] opacity-90">{c.autor.nome}</span>
          </>
        )}
        {atual > 0 && (
          <button type="button" aria-label="Cartão anterior" onClick={() => setI(atual - 1)} className="absolute top-1/2 left-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink">
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
        )}
        {atual < total - 1 && (
          <button type="button" aria-label="Próximo cartão" onClick={() => setI(atual + 1)} className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink">
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>
      <div aria-hidden="true" className="mt-2 flex justify-center gap-1">
        {Array.from({ length: total }, (_, k) => (
          <span key={k} className={`size-1.5 rounded-full ${k === atual ? "bg-primary" : "bg-line"}`} />
        ))}
      </div>
    </div>
  );
}

function Enquete({ c }: { c: ConteudoNoFeed }) {
  const r = c.enquete;
  const [votando, setVotando] = useState(false);
  const votou = r?.meu !== null && r?.meu !== undefined;
  const cor = (CORES_DA_CAPA[c.cor] ?? CORES_DA_CAPA.azul)[1];
  return (
    <div className="rounded-2xl border border-line bg-surface2 p-4">
      <span className="inline-flex items-center gap-1.5 text-[0.8rem] font-bold tracking-wide text-muted uppercase">
        <BarChart3 aria-hidden="true" className="size-4" /> Enquete
      </span>
      <p className="mt-1.5 text-[1.15rem] font-bold">{c.titulo || "Sua pergunta aparece aqui"}</p>
      <div className="mt-3 grid gap-2">
        {(r?.opcoes ?? c.opcoes.map((texto) => ({ texto, votos: 0, porcento: 0 }))).map((o, k) => (
          <button
            key={k}
            type="button"
            aria-pressed={r?.meu === k}
            disabled={votando || c.id === "previa"}
            onClick={async () => {
              setVotando(true);
              await servicos.conteudos.votar(c.id, k).finally(() => setVotando(false));
            }}
            className="relative flex min-h-11 items-center justify-between overflow-hidden rounded-xl border-2 border-line bg-surface px-3 text-left font-bold aria-pressed:border-primary"
          >
            <span aria-hidden="true" className="absolute inset-y-0 left-0 opacity-20" style={{ width: `${votou ? o.porcento : 0}%`, background: cor }} />
            <span className="relative inline-flex items-center gap-1.5">
              {r?.meu === k && <Check aria-hidden="true" className="size-4" />}
              {o.texto || `Opção ${k + 1}`}
            </span>
            {votou && <span className="relative">{o.porcento}%</span>}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[0.85rem] text-muted">
        {(r?.total ?? 0).toLocaleString("pt-BR")} {r?.total === 1 ? "voto" : "votos"}
        {votou ? ". Toque em outra opção para mudar." : ""}
      </p>
    </div>
  );
}

function BotaoDeAcao({ rotulo, Icone, marcado, cor, onClick }: { rotulo: string; Icone: LucideIcon; marcado?: boolean; cor?: string; onClick: () => Promise<void> }) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <button
      type="button"
      aria-label={rotulo}
      aria-pressed={marcado}
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true);
        await onClick().finally(() => setOcupado(false));
      }}
      className={`grid size-10 place-items-center rounded-full hover:bg-surface2 ${marcado ? cor : "text-ink"} [&_svg]:size-6 ${marcado ? "[&_svg]:fill-current" : ""}`}
    >
      <Icone aria-hidden="true" />
    </button>
  );
}

/** Curtir, comentar, enviar no WhatsApp e salvar. */
export function AcoesDoConteudo({ c, base }: { c: ConteudoNoFeed; base: string }) {
  const previa = c.id === "previa";
  const compartilhar = `https://wa.me/?text=${encodeURIComponent(`${c.titulo}${c.texto ? `\n${c.texto}` : ""}\n(Conteúdo de ${c.autor.nome} no Desafoga)`)}`;
  return (
    <>
      <div className="mt-2 flex items-center gap-0.5">
        <BotaoDeAcao rotulo="Curtir" Icone={Heart} marcado={c.curti} cor="text-bad" onClick={() => (previa ? Promise.resolve() : servicos.conteudos.reagir(c.id, "curtir"))} />
        <Link href={previa ? "#" : `${base}/${c.id}`} aria-label="Comentar" className="grid size-10 place-items-center rounded-full hover:bg-surface2">
          <MessageCircle aria-hidden="true" className="size-6" />
        </Link>
        <a href={compartilhar} target="_blank" rel="noreferrer" aria-label="Enviar no WhatsApp" className="grid size-10 place-items-center rounded-full hover:bg-surface2">
          <Send aria-hidden="true" className="size-6" />
        </a>
        <span className="flex-1" />
        <BotaoDeAcao rotulo="Salvar" Icone={Bookmark} marcado={c.salvei} cor="text-primary" onClick={() => (previa ? Promise.resolve() : servicos.conteudos.reagir(c.id, "salvar"))} />
      </div>
      <p className="px-1 font-bold">
        {c.curtidas.toLocaleString("pt-BR")} {c.curtidas === 1 ? "curtida" : "curtidas"}
      </p>
    </>
  );
}

export function CabecalhoDoConteudo({ c, base, agora }: { c: ConteudoNoFeed; base: string; agora: Date }) {
  const Icone = ICONE_DO_TIPO[c.tipo];
  return (
    <header className="mb-2.5 flex items-center gap-2.5">
      <Link href={`${base}/perfil/${c.autor.id}`} aria-label={`Perfil de ${c.autor.nome}`}>
        <Avatar nome={c.autor.nome} cor={c.autor.cor} tamanho="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`${base}/perfil/${c.autor.id}`} className="font-bold hover:underline">
          {c.autor.nome}
        </Link>{" "}
        <Verificado />
        <p className="truncate text-[0.82rem] text-muted">
          {c.autor.papel}, {c.id === "previa" ? "agora" : quando(c.quando, agora)}
        </p>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-[0.8rem] font-bold text-muted">
        <Icone aria-hidden="true" className="size-3.5" />
        {c.tema}
      </span>
      {c.meu && c.id !== "previa" && (
        <button
          type="button"
          aria-label="Apagar publicação"
          onClick={() => servicos.conteudos.apagar(c.id)}
          className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface2 hover:text-bad"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      )}
    </header>
  );
}

/** Post do feed, como no protótipo. `completo`: sem o resumo dos comentários (tela do post e prévia). */
export function CartaoDoConteudo({ c, base, agora, completo }: { c: ConteudoNoFeed; base: string; agora: Date; completo?: boolean }) {
  const primeiroNome = c.autor.nome.split(" ")[0];
  return (
    <article className="entrar rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <CabecalhoDoConteudo c={c} base={base} agora={agora} />
      <Midia c={c} />
      <AcoesDoConteudo c={c} base={base} />
      {c.tipo === "artigo" ? (
        <div className="mt-1.5 px-1">
          <p className="font-bold">{c.titulo}</p>
          <p className="line-clamp-2 text-muted">{c.corpo[0] ?? ""}</p>
          {c.id !== "previa" && (
            <Link href={`${base}/${c.id}`} className="mt-1 inline-flex items-center gap-1 font-bold text-primary">
              Ler artigo completo <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          )}
        </div>
      ) : (
        c.texto &&
        c.tipo !== "dica" && (
          <p className="mt-1.5 px-1">
            <b>{primeiroNome}</b> {c.texto}
          </p>
        )
      )}
      {!completo && (
        <div className="mt-1.5 px-1 text-[0.95rem]">
          <Link href={`${base}/${c.id}`} className="text-muted hover:underline">
            {c.comentarios === 0 ? "Escrever um comentário" : c.comentarios === 1 ? "Ver 1 comentário" : `Ver os ${c.comentarios} comentários`}
          </Link>
          {c.primeiroComentario && (
            <p className="mt-0.5">
              <b>{c.primeiroComentario.nome}</b> {c.primeiroComentario.texto}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
