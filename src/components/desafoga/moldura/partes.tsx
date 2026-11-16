"use client";

import { ALargeSmall } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLetraMaior } from "@/hooks/use-letra-maior";
import { BotaoIcone } from "../ui/botao";
import { rotaDeOutroPaciente, type ItemDoMenu } from "./navegacao";
import type { Persona } from "@/services";

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

export function BotaoLetraMaior() {
  const [ativa, alternar] = useLetraMaior();
  return (
    <BotaoIcone aria-label="Letra maior" aria-pressed={ativa} onClick={alternar}>
      <ALargeSmall aria-hidden="true" />
    </BotaoIcone>
  );
}

/**
 * Barra de menu flutuante, no celular e no desktop. O item em destaque (a
 * Luana) fica num círculo que sobe acima da barra.
 */
export function MenuInferior({ itens, caminho }: { itens: ItemDoMenu[]; caminho: string }) {
  return (
    <nav
      aria-label="Menu"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-[540px] rounded-[22px] border border-line bg-surface shadow-[0_10px_30px_rgb(0_0_0/0.14)]"
    >
      <ul className="grid auto-cols-fr grid-flow-col px-1">
        {itens.map(({ href, rotulo, Icone, ativo, destaque }) => {
          const atual = ativo(caminho);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={atual ? "page" : undefined}
                className="group flex min-h-16 flex-col items-center justify-end gap-0.5 rounded-[18px] pb-2.5 text-[0.78rem] text-muted no-underline hover:text-ink aria-[current=page]:font-bold aria-[current=page]:text-primary"
              >
                {destaque ? (
                  <span
                    aria-hidden="true"
                    className="-mt-7 grid size-14 place-items-center rounded-full bg-primary text-primary-ink ring-[5px] ring-bg transition-transform group-hover:scale-105 group-aria-[current=page]:ring-primary-soft"
                  >
                    <Icone className="size-6" />
                  </span>
                ) : (
                  <Icone aria-hidden="true" className="size-6" />
                )}
                {rotulo}
              </Link>
            </li>
          );
        })}
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
