"use client";

import { ALargeSmall } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLetraMaior } from "@/hooks/use-letra-maior";
import { BotaoIcone } from "../ui/botao";
import { rotaDeOutroPaciente, type ItemDoMenu, type Modo } from "./navegacao";
import type { Persona } from "@/services";

/** Logo: círculo com o símbolo de pausa. */
export function Marca({ comNome = true }: { comNome?: boolean }) {
  return (
    <span className="flex items-center gap-2 text-[1.2rem] font-bold">
      <span aria-hidden="true" className="relative grid size-[30px] shrink-0 place-items-center rounded-full bg-primary">
        <span className="flex gap-1">
          <i className="block h-3.5 w-1 rounded-sm bg-primary-ink" />
          <i className="block h-3.5 w-1 rounded-sm bg-primary-ink" />
        </span>
      </span>
      {comNome && <span>Pausa</span>}
    </span>
  );
}

/** Alterna a demonstração entre a visão da pessoa e a do responsável. */
export function SeletorDeModo({ modo }: { modo: Modo }) {
  const opcoes: [Modo, string, string][] = [
    ["pessoa", "Pessoa", "/hoje"],
    ["responsavel", "Responsável", `/pacientes`],
  ];
  return (
    <nav aria-label="Ver o app como" className="flex rounded-xl border border-line bg-surface2 p-[3px]">
      {opcoes.map(([valor, rotulo, href]) => (
        <Link
          key={valor}
          href={href}
          aria-current={modo === valor ? "page" : undefined}
          className="flex min-h-11 flex-1 items-center justify-center rounded-[9px] px-3 text-[0.85rem] font-bold text-muted no-underline aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:shadow-[0_0_0_1px_var(--line)]"
        >
          {rotulo}
        </Link>
      ))}
    </nav>
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
            {p.nome}, {p.idade} anos
          </option>
        ))}
      </select>
    </label>
  );
}
