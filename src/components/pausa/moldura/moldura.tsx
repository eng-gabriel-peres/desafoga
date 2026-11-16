"use client";

import { RotateCcw } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { usePacienteAtual } from "@/hooks/use-paciente-atual";
import { dataPorExtenso } from "@/lib/formatar";
import { servicos } from "@/services";
import { Avatar } from "../ui/blocos";
import { itensDoMenu, modoDaRota, PESSOA_DA_DEMO, tituloDaRota } from "./navegacao";
import { BotaoLetraMaior, Marca, MenuInferior, MenuLateral, SeletorDeModo, SeletorDePaciente } from "./partes";
import { Sino } from "./sino";

/**
 * Moldura do app. No celular: topo com o seletor de modo e menu inferior.
 * No desktop (1000px ou mais): barra lateral, cabeçalho com título e sino.
 */
export function Moldura({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  const modo = modoDaRota(caminho);
  const pacienteId = usePacienteAtual();
  const itens = itensDoMenu(modo, pacienteId);
  const agora = useAgora();
  const pessoas = useConsulta("pessoas", () => servicos.pessoas.listar());
  const responsavel = useConsulta("responsavel", () => servicos.pessoas.responsavel());
  const ana = pessoas?.find((p) => p.id === PESSOA_DA_DEMO);
  const comPaciente = /^\/pacientes\/[^/]+/.test(caminho);

  const { titulo, subtitulo } =
    caminho === "/hoje" && ana
      ? { titulo: `Oi, ${ana.apelido}`, subtitulo: agora ? dataPorExtenso(agora) : undefined }
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
          <span className="mr-auto">
            <Marca comNome={false} />
            <span className="sr-only">Pausa</span>
          </span>
          <SeletorDeModo modo={modo} />
          <BotaoLetraMaior />
          <Sino modo={modo} />
        </div>
      </header>

      {/* Desktop: barra lateral */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 overflow-auto border-r border-line bg-surface px-3.5 py-5 desk:flex">
        <div className="px-2">
          <Marca />
        </div>
        <div>
          <p className="mb-1.5 px-2 text-[0.8rem] text-muted">Ver o app como</p>
          <SeletorDeModo modo={modo} />
        </div>
        <MenuLateral itens={itens} caminho={caminho} />
        <div className="mt-auto grid gap-2.5">
          <BotaoLetraMaior comTexto />
          <button
            type="button"
            onClick={() => servicos.recomecar()}
            className="flex min-h-11 items-center gap-2.5 rounded-xl border border-line bg-surface2 px-3 text-[0.9rem] font-bold"
          >
            <RotateCcw aria-hidden="true" className="size-5" />
            Recomeçar demonstração
          </button>
          {modo === "pessoa" && ana && responsavel && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface2 p-2.5">
              <Avatar nome={ana.nome} cor={ana.cor} />
              <div>
                <b className="block text-[0.95rem]">{ana.nome}</b>
                <span className="text-[0.85rem] text-muted">Acompanhada por {responsavel.nome}</span>
              </div>
            </div>
          )}
          {modo === "responsavel" && responsavel && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface2 p-2.5">
              <Avatar nome={responsavel.nome} cor={responsavel.cor} />
              <div>
                <b className="block text-[0.95rem]">{responsavel.nome}</b>
                <span className="text-[0.85rem] text-muted">{responsavel.papel}</span>
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
            <Sino modo={modo} />
          </div>
        </header>

        <main
          id="conteudo"
          tabIndex={-1}
          className="mx-auto w-full max-w-[620px] px-4 pt-4.5 pb-32 outline-none desk:max-w-[1280px] desk:px-9 desk:pt-7 desk:pb-14"
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
