"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { usePacienteAtual } from "@/hooks/use-paciente-atual";
import { dataPorExtenso } from "@/lib/formatar";
import { servicos } from "@/services";
import { useEu } from "../sessao";
import { itensDoMenu, temPaciente, tituloDaRota, type Area } from "./navegacao";
import { MenuDoPerfil } from "./menu-do-perfil";
import { Marca, MenuInferior, MenuLateral, SeletorDePaciente } from "./partes";
import { Sino } from "./sino";

const NOME_DA_AREA: Record<Area, string> = { pessoa: "Meu Desafoga", responsavel: "Painel do responsável" };
const NOME_CURTO: Record<Area, string> = { pessoa: "Desafoga", responsavel: "Painel" };

/**
 * Moldura de cada área. No celular: topo com sino e a bolinha
 * do perfil, e a barra de menu flutuante com a Luana em destaque no meio.
 * No desktop (1000px ou mais): barra lateral com o perfil e o sino no pé, e cabeçalho com o título da tela.
 */
export function Moldura({ area, children }: { area: Area; children: ReactNode }) {
  const caminho = usePathname();
  const eu = useEu();
  const pessoas = useConsulta(area === "responsavel" ? "pessoas" : "sem-pessoas", () =>
    area === "responsavel" ? servicos.pessoas.listar() : Promise.resolve([]),
  );
  const guardado = usePacienteAtual();
  // Sem paciente aberto ainda: o primeiro da lista.
  const pacienteId = guardado || pessoas?.[0]?.id || "";
  const itens = itensDoMenu(area, pacienteId);
  const agora = useAgora();
  const comPaciente = temPaciente(caminho);
  /** O chat ocupa a altura toda, como no WhatsApp. */
  const telaCheia = caminho === "/app/assistente";

  const { titulo, subtitulo } =
    caminho === "/app/hoje" && eu.pessoa
      ? { titulo: `Oi, ${eu.pessoa.apelido}`, subtitulo: agora ? dataPorExtenso(agora) : undefined }
      : tituloDaRota(caminho);

  return (
    <div className="desk:grid desk:min-h-dvh desk:grid-cols-[264px_minmax(0,1fr)]">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>

      {/* Celular: topo */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface pt-[env(safe-area-inset-top)] desk:hidden">
        <div className="mx-auto flex h-16 max-w-[620px] items-center gap-1 px-3">
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <Marca comNome={false} />
            <span className="truncate font-bold">{NOME_CURTO[area]}</span>
          </div>
          <Sino area={area} />
          <MenuDoPerfil area={area} />
        </div>
      </header>

      {/* Desktop: barra lateral, com quem está usando e os avisos no pé */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 border-r border-line bg-surface px-3.5 py-5 desk:flex">
        <div className="px-2">
          <Marca />
          <p className="mt-1 text-[0.85rem] text-muted">{NOME_DA_AREA[area]}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <MenuLateral itens={itens} caminho={caminho} />
        </div>
        <div className="flex items-center gap-0.5 border-t border-line pt-3">
          <MenuDoPerfil area={area} lateral />
          <Sino area={area} paraCima />
        </div>
      </aside>

      <div className="min-w-0 desk:flex desk:flex-col">
        {/* Desktop: cabeçalho com o título da tela */}
        <header className="sticky top-0 z-15 hidden items-center gap-3.5 border-b border-line bg-bg px-9 pt-5 pb-4 desk:flex">
          <div>
            <h1 className="text-[1.55rem] leading-tight font-bold">{titulo}</h1>
            {subtitulo && <p className="mt-0.5 text-[0.92rem] text-muted">{subtitulo}</p>}
          </div>
          {comPaciente && pessoas && (
            <div className="ml-auto">
              <SeletorDePaciente pessoas={pessoas} atual={pacienteId} caminho={caminho} />
            </div>
          )}
        </header>

        <main
          id="conteudo"
          tabIndex={-1}
          className={`mx-auto w-full outline-none desk:max-w-[1280px] desk:px-9 ${
            telaCheia
              ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))] desk:pt-5 desk:pb-5"
              : "max-w-[620px] px-4 pt-4.5 pb-32 desk:pt-7 desk:pb-14"
          }`}
        >
          {comPaciente && pessoas && (
            <div className="mb-4 desk:hidden">
              <SeletorDePaciente pessoas={pessoas} atual={pacienteId} caminho={caminho} />
            </div>
          )}
          {children}
        </main>
      </div>

      <MenuInferior itens={itens} caminho={caminho} />
    </div>
  );
}
