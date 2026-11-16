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
import { BotaoLetraMaior, Marca, MenuInferior, SeletorDePaciente } from "./partes";
import { Sino } from "./sino";

const NOME_DA_AREA: Record<Area, string> = { pessoa: "Meu Desafoga", responsavel: "Painel do responsável" };
const NOME_CURTO: Record<Area, string> = { pessoa: "Desafoga", responsavel: "Painel" };

/**
 * Moldura de cada área, igual no celular e no desktop: topo com letra maior,
 * sino e a bolinha do perfil (menu com perfil e sair), e a barra de menu
 * flutuante embaixo, com a Luana em destaque no meio. No desktop, o título
 * da tela abre o conteúdo.
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
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-20 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-[620px] items-center gap-2 px-3 desk:max-w-[1280px] desk:gap-2.5 desk:px-9">
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <Marca comNome={false} />
            <span className="truncate font-bold desk:hidden">{NOME_CURTO[area]}</span>
            <span className="hidden text-[1.2rem] font-bold desk:inline">Desafoga</span>
            <span className="hidden rounded-full bg-surface2 px-2.5 py-0.5 text-[0.85rem] text-muted desk:inline">{NOME_DA_AREA[area]}</span>
          </div>
          {comPaciente && pessoas && (
            <div className="hidden desk:block">
              <SeletorDePaciente pessoas={pessoas} atual={pacienteId} caminho={caminho} />
            </div>
          )}
          <BotaoLetraMaior />
          <Sino area={area} />
          <MenuDoPerfil area={area} />
        </div>
      </header>

      <main
        id="conteudo"
        tabIndex={-1}
        className={`mx-auto w-full outline-none desk:max-w-[1280px] desk:px-9 ${
          telaCheia ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))] desk:pt-5" : "max-w-[620px] px-4 pt-4.5 pb-32 desk:pt-7"
        }`}
      >
        {!telaCheia && (
          <div className="mb-6 hidden desk:block">
            <h1 className="text-[1.55rem] leading-tight font-bold">{titulo}</h1>
            {subtitulo && <p className="mt-0.5 text-[0.92rem] text-muted">{subtitulo}</p>}
          </div>
        )}
        {comPaciente && pessoas && (
          <div className="mb-4 desk:hidden">
            <SeletorDePaciente pessoas={pessoas} atual={pacienteId} caminho={caminho} />
          </div>
        )}
        {children}
      </main>

      <MenuInferior itens={itens} caminho={caminho} />
    </div>
  );
}
