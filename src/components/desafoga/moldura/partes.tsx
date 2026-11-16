"use client";

import { ALargeSmall, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLetraMaior } from "@/hooks/use-letra-maior";
import { BotaoIcone } from "../ui/botao";
import { rotaDeOutroPaciente, type ItemDoMenu } from "./navegacao";
import { servicos, type Persona } from "@/services";

/** Logo: círculo com uma onda, a ideia de respirar e aliviar o peso. */
export function Marca({ comNome = true }: { comNome?: boolean }) {
  return (
    <span className="flex items-center gap-2 text-[1.2rem] font-bold">
      <svg aria-hidden="true" viewBox="0 0 30 30" className="size-[30px] shrink-0">
        <circle cx="15" cy="15" r="15" fill="var(--primary)" />
        <path
          d="M7 13.5c2.7-3 5.3-3 8 0s5.3 3 8 0M7 18.5c2.7-3 5.3-3 8 0s5.3 3 8 0"
          fill="none"
          stroke="var(--primary-ink)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      {comNome && <span>Desafoga</span>}
    </span>
  );
}

/**
 * Na demonstração, volta à entrada para trocar de persona (os dados continuam
 * os mesmos). Em conta real, sai da sessão.
 */
export function LinkSair({ compacto = false, demo }: { compacto?: boolean; demo: boolean }) {
  const router = useRouter();
  const rotulo = demo ? "Trocar de perfil" : "Sair";
  const classe = compacto
    ? "inline-grid size-11 shrink-0 place-items-center rounded-[10px] border border-line bg-surface2 hover:border-primary"
    : "flex min-h-11 items-center gap-2.5 rounded-xl border border-line bg-surface2 px-3 text-[0.9rem] font-bold no-underline hover:border-primary";
  if (demo) {
    return (
      <Link href="/" aria-label={compacto ? rotulo : undefined} className={classe}>
        <LogOut aria-hidden="true" className="size-5" />
        {!compacto && rotulo}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={compacto ? rotulo : undefined}
      className={classe}
      onClick={async () => {
        await servicos.sessao.sair();
        router.replace("/");
      }}
    >
      <LogOut aria-hidden="true" className="size-5" />
      {!compacto && rotulo}
    </button>
  );
}

export function BotaoLetraMaior({ comTexto = false }: { comTexto?: boolean }) {
  const [ativa, alternar] = useLetraMaior();
  if (comTexto) {
    return (
      <button
        type="button"
        aria-pressed={ativa}
        onClick={alternar}
        className="flex min-h-11 items-center gap-2.5 rounded-xl border border-line bg-surface2 px-3 text-[0.9rem] font-bold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-ink"
      >
        <ALargeSmall aria-hidden="true" className="size-5" />
        Letra maior
      </button>
    );
  }
  return (
    <BotaoIcone aria-label="Letra maior" aria-pressed={ativa} onClick={alternar}>
      <ALargeSmall aria-hidden="true" />
    </BotaoIcone>
  );
}

export function MenuInferior({ itens, caminho }: { itens: ItemDoMenu[]; caminho: string }) {
  return (
    <nav
      aria-label="Menu"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] desk:hidden"
    >
      <ul className="mx-auto grid max-w-[620px] auto-cols-fr grid-flow-col">
        {itens.map(({ href, rotulo, Icone, ativo }) => {
          const atual = ativo(caminho);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={atual ? "page" : undefined}
                className="relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-[0.78rem] text-muted no-underline aria-[current=page]:font-bold aria-[current=page]:text-primary"
              >
                {atual && <span aria-hidden="true" className="absolute inset-x-1/4 top-0 h-[3px] rounded-b bg-primary" />}
                <Icone aria-hidden="true" className="size-6" />
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MenuLateral({ itens, caminho }: { itens: ItemDoMenu[]; caminho: string }) {
  return (
    <nav aria-label="Menu">
      <ul className="grid gap-1">
        {itens.map(({ href, rotulo, Icone, ativo }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={ativo(caminho) ? "page" : undefined}
              className="flex min-h-[46px] items-center gap-3 rounded-xl px-3 font-bold text-muted no-underline hover:bg-surface2 hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
            >
              <Icone aria-hidden="true" className="size-5" />
              {rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Troca de paciente mantendo a tela aberta. */
export function SeletorDePaciente({ pessoas, atual, caminho }: { pessoas: Persona[]; atual: string; caminho: string }) {
  const router = useRouter();
  const pessoa = pessoas.find((p) => p.id === atual);
  return (
    <label className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface py-1.5 pr-2.5 pl-1.5">
      {pessoa && (
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-full text-[0.8rem] font-bold text-white" style={{ background: pessoa.cor }}>
          {pessoa.apelido[0]}
        </span>
      )}
      <span className="sr-only">Paciente</span>
      <select
        value={atual}
        onChange={(e) => router.push(rotaDeOutroPaciente(caminho, e.target.value))}
        className="min-h-11 flex-1 cursor-pointer border-0 bg-transparent text-[0.95rem] font-bold"
      >
        {pessoas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
            {p.idade ? `, ${p.idade} anos` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
