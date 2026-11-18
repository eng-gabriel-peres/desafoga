"use client";

import { AlarmClock, BarChart3, CalendarDays, Newspaper, ChevronDown, ChevronsUpDown, Landmark, LogOut, RotateCcw, Trophy, UserRound, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { useFecharFora } from "@/hooks/use-fechar-fora";
import { servicos } from "@/services";
import { useEu } from "../sessao";
import { Avatar } from "../ui/blocos";
import type { Area } from "./navegacao";

const ITEM =
  "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[0.95rem] font-bold text-ink no-underline hover:bg-surface2 focus-visible:bg-surface2 [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-muted";

/**
 * Bolinha com as iniciais no topo: abre o menu de quem está usando, com
 * perfil, recomeçar a demonstração e sair.
 */
export function MenuDoPerfil({
  area,
  lateral = false,
  paraCima = false,
}: {
  area: Area;
  /** Na barra lateral aberta: nome ao lado da bolinha. */
  lateral?: boolean;
  /** No pé da barra lateral: o menu abre para cima. */
  paraCima?: boolean;
}) {
  const eu = useEu();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const id = useId();

  const fechar = useCallback((devolverFoco: boolean) => {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  }, []);
  useFecharFora(aberto, fechar, caixa);

  const quem =
    area === "responsavel" && eu.profissional
      ? { nome: eu.profissional.nome, cor: eu.profissional.cor, detalhe: eu.profissional.papel }
      : eu.pessoa
        ? {
            nome: eu.pessoa.nome,
            cor: eu.pessoa.cor,
            detalhe: eu.acompanhantes.length ? `Acompanhada por ${eu.acompanhantes[0].nome}` : "Sem acompanhamento ainda",
          }
        : null;
  if (!quem) return null;

  async function recomecar() {
    setAberto(false);
    await servicos.sessao.recomecar();
    router.refresh();
  }

  async function sair() {
    setAberto(false);
    await servicos.sessao.sair();
    router.replace("/");
  }

  return (
    <div ref={caixa} className={`relative ${lateral ? "min-w-0 flex-1" : ""}`}>
      <button
        ref={botao}
        type="button"
        aria-label={`Menu de ${quem.nome}`}
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
        className={`flex min-h-11 items-center hover:bg-surface2 aria-expanded:bg-surface2 [&_svg]:shrink-0 [&_svg]:text-muted ${
          lateral ? "w-full gap-2.5 rounded-xl p-1.5 text-left [&_svg]:size-4" : "shrink-0 gap-1 rounded-full p-0.5 [&_svg]:size-4"
        }`}
      >
        <Avatar nome={quem.nome} cor={quem.cor} />
        {lateral ? (
          <>
            <span aria-hidden="true" className="min-w-0 flex-1">
              <b className="block truncate text-[0.95rem]">{quem.nome}</b>
              <span className="block truncate text-[0.82rem] text-muted">{quem.detalhe}</span>
            </span>
            <ChevronsUpDown aria-hidden="true" />
          </>
        ) : (
          <ChevronDown aria-hidden="true" className={paraCima ? "hidden" : "hidden desk:block"} />
        )}
      </button>

      {aberto && (
        <div
          id={id}
          className={`absolute z-40 w-[min(300px,calc(100vw-24px))] ${paraCima ? "surgir-de-baixo bottom-full left-0 mb-2" : "surgir top-13 right-0"} rounded-2xl border border-line bg-surface p-2 shadow-[0_12px_32px_rgb(0_0_0/0.18)]`}
        >
          <div className="flex items-center gap-2.5 border-b border-line px-2 pt-1.5 pb-3">
            <Avatar nome={quem.nome} cor={quem.cor} />
            <div className="min-w-0">
              <b className="block truncate">{quem.nome}</b>
              <span className="block truncate text-[0.85rem] text-muted">{quem.detalhe}</span>
            </div>
          </div>

          <ul className="grid gap-0.5 pt-2">
            {area === "pessoa" ? (
              <>
                <ItemLink href="/app/perfil" Icone={UserRound} aoEscolher={() => setAberto(false)}>
                  Meu perfil
                </ItemLink>
                <ItemLink href="/app/semana" Icone={BarChart3} aoEscolher={() => setAberto(false)}>
                  Sua semana
                </ItemLink>
                <ItemLink href="/app/conteudos" Icone={Newspaper} aoEscolher={() => setAberto(false)}>
                  Conteúdos
                </ItemLink>
                <ItemLink href="/app/eventos" Icone={CalendarDays} aoEscolher={() => setAberto(false)}>
                  Eventos
                </ItemLink>
                <ItemLink href="/app/conquistas" Icone={Trophy} aoEscolher={() => setAberto(false)}>
                  Conquistas
                </ItemLink>
                <ItemLink href="/app/rotina" Icone={AlarmClock} aoEscolher={() => setAberto(false)}>
                  Rotina e privacidade
                </ItemLink>
                <ItemLink href="/app/contas" Icone={Landmark} aoEscolher={() => setAberto(false)}>
                  Bancos conectados
                </ItemLink>
              </>
            ) : (
              <>
                <ItemLink href="/painel" Icone={Users} aoEscolher={() => setAberto(false)}>
                  Pacientes e convite
                </ItemLink>
                <ItemLink href="/painel/conteudos" Icone={Newspaper} aoEscolher={() => setAberto(false)}>
                  Conteúdos
                </ItemLink>
                <ItemLink href="/painel/eventos" Icone={CalendarDays} aoEscolher={() => setAberto(false)}>
                  Eventos
                </ItemLink>
              </>
            )}
            {eu.demo && (
              <li>
                <button type="button" onClick={recomecar} className={ITEM}>
                  <RotateCcw aria-hidden="true" />
                  Recomeçar demonstração
                </button>
              </li>
            )}
          </ul>

          <div className="mt-2 border-t border-line pt-2">
            {eu.demo ? (
              // Na demonstração, sair é voltar à entrada para trocar de persona.
              <Link href="/" className={ITEM}>
                <LogOut aria-hidden="true" />
                Trocar de perfil
              </Link>
            ) : (
              <button type="button" onClick={sair} className={ITEM}>
                <LogOut aria-hidden="true" />
                Sair
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemLink({ href, Icone, aoEscolher, children }: { href: string; Icone: LucideIcon; aoEscolher: () => void; children: ReactNode }) {
  return (
    <li>
      <Link href={href} onClick={aoEscolher} className={ITEM}>
        <Icone aria-hidden="true" />
        {children}
      </Link>
    </li>
  );
}
