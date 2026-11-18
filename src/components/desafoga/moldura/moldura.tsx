"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useBarraRecolhida } from "@/hooks/use-barra-recolhida";
import { useConsulta } from "@/hooks/use-consulta";
import { usePacienteAtual } from "@/hooks/use-paciente-atual";
import { dataPorExtenso } from "@/lib/formatar";
import { servicos } from "@/services";
import { useEu } from "../sessao";
import { AvisoNovo } from "./aviso-novo";
import { itensDoMenu, temPaciente, tituloDaRota, type Area } from "./navegacao";
import { MenuDoPerfil } from "./menu-do-perfil";
import { Marca, MenuInferior, MenuLateral, SeletorDePaciente } from "./partes";
import { Sino } from "./sino";
import { AtualizarBancosAoAbrir } from "../banco/atualizar-ao-abrir";
import { ComRegistro } from "../registro";
import { BotaoIcone } from "../ui/botao";

const NOME_DA_AREA: Record<Area, string> = { pessoa: "Meu Desafoga", responsavel: "Painel do responsável" };

/**
 * Moldura de cada área. No celular: topo com sino e a bolinha
 * do perfil, e a barra de menu flutuante com a Luana em destaque no meio.
 * No desktop (1000px ou mais): barra lateral com o perfil e o sino no pé, e cabeçalho com o título da tela.
 */
export function Moldura({ area, children }: { area: Area; children: ReactNode }) {
  const caminho = usePathname();
  const [recolhida, alternarBarra] = useBarraRecolhida();
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
    <ComRegistro>
    {area === "pessoa" && eu.pessoa && <AtualizarBancosAoAbrir pessoaId={eu.pessoa.id} />}
    <AvisoNovo area={area} />
    <div className={`desk:grid desk:min-h-dvh desk:transition-[grid-template-columns] desk:duration-300 desk:ease-out ${recolhida ? "desk:grid-cols-[76px_minmax(0,1fr)]" : "desk:grid-cols-[264px_minmax(0,1fr)]"}`}>
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
            <Marca />
            {area === "responsavel" && <span className="truncate text-[0.85rem] font-bold text-muted">Painel</span>}
          </div>
          <Sino area={area} />
          <MenuDoPerfil area={area} />
        </div>
      </header>

      {/* Desktop: barra lateral, com quem está usando e os avisos no pé */}
      <aside
        className={`sticky top-0 z-30 hidden h-dvh flex-col gap-5 border-r border-line bg-surface py-5 desk:flex ${recolhida ? "items-center px-2.5" : "px-3.5"}`}
      >
        {recolhida ? (
          <div key="recolhida" className="aparecer grid justify-items-center gap-3">
            <Marca comNome={false} />
            <BotaoIcone leve aria-label="Abrir o menu" aria-expanded={false} title="Abrir o menu" onClick={alternarBarra}>
              <PanelLeftOpen aria-hidden="true" />
            </BotaoIcone>
          </div>
        ) : (
          <div key="aberta" className="aparecer flex items-start gap-2 pl-2">
            <div className="min-w-0 flex-1">
              <Marca />
              <p className="mt-1 text-[0.85rem] text-muted">{NOME_DA_AREA[area]}</p>
            </div>
            <BotaoIcone leve aria-label="Recolher o menu" aria-expanded title="Recolher o menu" onClick={alternarBarra}>
              <PanelLeftClose aria-hidden="true" />
            </BotaoIcone>
          </div>
        )}
        {/* Recolhida, a lista não rola: os rótulos aparecem ao lado e não podem ser cortados. */}
        <div key={recolhida ? "menu-recolhido" : "menu-aberto"} className={`aparecer ${recolhida ? "flex-1" : "min-h-0 flex-1 overflow-auto"}`}>
          <MenuLateral itens={itens} caminho={caminho} recolhida={recolhida} />
        </div>
        <div className={`flex border-t border-line pt-3 ${recolhida ? "flex-col items-center gap-1.5" : "items-center gap-0.5"}`}>
          <MenuDoPerfil area={area} lateral={!recolhida} paraCima />
          <Sino area={area} paraCima />
        </div>
      </aside>

      <div className="min-w-0 desk:flex desk:flex-col">
        {/* Desktop: cabeçalho com o título da tela */}
        {/* No chat, o cabeçalho da Luana faz o papel de título: a conversa ocupa a tela toda. */}
        <header className={`sticky top-0 z-15 hidden items-center gap-3.5 border-b border-line bg-bg px-9 pt-5 pb-4 ${telaCheia ? "" : "desk:flex"}`}>
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
          className={`mx-auto w-full outline-none ${
            telaCheia
              ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))] desk:pb-0"
              : "max-w-[620px] px-4 pt-4.5 pb-32 desk:max-w-[1280px] desk:px-9 desk:pt-7 desk:pb-14"
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
    </ComRegistro>
  );
}
