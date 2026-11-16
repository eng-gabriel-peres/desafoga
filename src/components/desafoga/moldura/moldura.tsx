"use client";

import { RotateCcw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { usePacienteAtual } from "@/hooks/use-paciente-atual";
import { dataPorExtenso } from "@/lib/formatar";
import { servicos } from "@/services";
import { useEu } from "../sessao";
import { Avatar } from "../ui/blocos";
import { itensDoMenu, temPaciente, tituloDaRota, type Area } from "./navegacao";
import { BotaoLetraMaior, LinkSair, Marca, MenuInferior, MenuLateral, SeletorDePaciente } from "./partes";
import { Sino } from "./sino";

const NOME_DA_AREA: Record<Area, string> = { pessoa: "Meu Desafoga", responsavel: "Painel do responsável" };
const NOME_CURTO: Record<Area, string> = { pessoa: "Desafoga", responsavel: "Painel" };

/**
 * Moldura de cada área. No celular: topo e menu inferior. No desktop (1000px
 * ou mais): barra lateral, cabeçalho com título e sino.
 */
export function Moldura({ area, children }: { area: Area; children: ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const eu = useEu();
  const pessoas = useConsulta(area === "responsavel" ? "pessoas" : "sem-pessoas", () =>
    area === "responsavel" ? servicos.pessoas.listar() : Promise.resolve([]),
  );
  const guardado = usePacienteAtual();
  // Sem paciente aberto ainda: o primeiro da lista.
  const pacienteId = guardado || pessoas?.[0]?.id || "";
  const itens = itensDoMenu(area, pacienteId);
  const agora = useAgora();
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

  async function recomecar() {
    await servicos.sessao.recomecar();
    router.refresh();
  }
  const comPaciente = temPaciente(caminho);
  /** O chat ocupa a altura toda, como no WhatsApp. */
  const telaCheia = caminho === "/app/assistente";

  const { titulo, subtitulo } =
    caminho === "/app/hoje" && eu.pessoa
      ? { titulo: `Oi, ${eu.pessoa.apelido}`, subtitulo: agora ? dataPorExtenso(agora) : undefined }
      : tituloDaRota(caminho);

  return (
    <div className="desk:grid desk:min-h-dvh desk:grid-cols-[256px_minmax(0,1fr)]">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>

      {/* Celular */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface pt-[env(safe-area-inset-top)] desk:hidden">
        <div className="mx-auto flex max-w-[620px] items-center gap-2 px-3 py-2.5">
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <Marca comNome={false} />
            <span className="truncate font-bold">{NOME_CURTO[area]}</span>
          </div>
          <BotaoLetraMaior />
          <Sino area={area} />
          <LinkSair compacto demo={eu.demo} />
        </div>
      </header>

      {/* Desktop: barra lateral */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 overflow-auto border-r border-line bg-surface px-3.5 py-5 desk:flex">
        <div className="px-2">
          <Marca />
          <p className="mt-1 text-[0.85rem] text-muted">{NOME_DA_AREA[area]}</p>
        </div>
        <MenuLateral itens={itens} caminho={caminho} />
        <div className="mt-auto grid gap-2.5">
          <BotaoLetraMaior comTexto />
          {eu.demo && (
            <button
              type="button"
              onClick={recomecar}
              className="flex min-h-11 items-center gap-2.5 rounded-xl border border-line bg-surface2 px-3 text-left text-[0.9rem] font-bold hover:border-primary"
            >
              <RotateCcw aria-hidden="true" className="size-5" />
              Recomeçar demonstração
            </button>
          )}
          <LinkSair demo={eu.demo} />
          {quem && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface2 p-2.5">
              <Avatar nome={quem.nome} cor={quem.cor} />
              <div>
                <b className="block text-[0.95rem]">{quem.nome}</b>
                <span className="text-[0.85rem] text-muted">{quem.detalhe}</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="min-w-0 desk:flex desk:flex-col">
        {/* Desktop: cabeçalho */}
        <header className="sticky top-0 z-15 hidden items-center gap-3.5 border-b border-line bg-bg px-9 pt-5 pb-4 desk:flex">
          <div>
            <h1 className="text-[1.55rem] leading-tight font-bold">{titulo}</h1>
            {subtitulo && <p className="mt-0.5 text-[0.92rem] text-muted">{subtitulo}</p>}
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            {comPaciente && pessoas && <SeletorDePaciente pessoas={pessoas} atual={pacienteId} caminho={caminho} />}
            <Sino area={area} />
          </div>
        </header>

        <main
          id="conteudo"
          tabIndex={-1}
          className={`mx-auto w-full outline-none desk:max-w-[1280px] desk:px-9 ${
            telaCheia
              ? "pb-[calc(4rem+env(safe-area-inset-bottom))] desk:pt-5 desk:pb-5"
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
