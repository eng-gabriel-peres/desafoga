"use client";

import { useState } from "react";
import { useConsulta } from "@/hooks/use-consulta";
import { servicos, type Mensagem } from "@/services";
import { Chat, type Ocupada } from "../chat/chat";
import { BotaoWhatsapp } from "../chat/conectar-whatsapp";
import { PESSOA_DA_DEMO } from "../moldura/navegacao";
import { Carregando } from "../ui/blocos";

const local = (de: Mensagem["de"], texto: string): Mensagem => ({
  id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  de,
  texto,
  quando: new Date().toISOString(),
});

/**
 * Mensagens mostradas antes de a conversa salva trazê-las: a que a pessoa
 * acabou de mandar, ou um aviso de erro. Somem quando a conversa salva cresce.
 */
interface Pendentes {
  base: number;
  mensagens: Mensagem[];
}

/** Conversa com a Luana, ocupando a tela como no WhatsApp. */
export function TelaAssistente() {
  const salvas = useConsulta(`conversa:${PESSOA_DA_DEMO}`, () => servicos.assistente.conversa(PESSOA_DA_DEMO));
  const [ocupada, setOcupada] = useState<Ocupada>(false);
  const [pendentes, setPendentes] = useState<Pendentes>({ base: -1, mensagens: [] });

  if (!salvas) return <Carregando rotulo="Carregando a conversa" />;
  const total = salvas.length;
  const visiveis = pendentes.base === total ? pendentes.mensagens : [];

  async function comEspera(estado: Exclude<Ocupada, false>, minha: Mensagem, pedir: () => Promise<unknown>) {
    setOcupada(estado);
    setPendentes({ base: total, mensagens: [minha] });
    try {
      await pedir();
    } catch (e) {
      const aviso = local("assistente", e instanceof Error ? e.message : "Não consegui responder agora. Tente de novo.");
      setPendentes((p) => ({ ...p, mensagens: [...p.mensagens, aviso] }));
    } finally {
      setOcupada(false);
    }
  }

  return (
    <div className="h-[calc(100dvh-8rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))] desk:mx-auto desk:h-[calc(100dvh-8.7rem)] desk:max-w-[860px]">
      <h1 className="sr-only">Assistente</h1>
      <Chat
        mensagens={[...salvas, ...visiveis]}
        ocupada={ocupada}
        enviar={(texto) => comEspera("digitando", local("pessoa", texto), () => servicos.assistente.enviar(PESSOA_DA_DEMO, texto))}
        enviarArquivo={(arquivo) =>
          comEspera("lendo", local("pessoa", `Arquivo: ${arquivo.name}`), () => servicos.assistente.enviarArquivo(PESSOA_DA_DEMO, arquivo))
        }
        enviarAudio={(audio) => comEspera("ouvindo", local("pessoa", "Mensagem de voz"), () => servicos.assistente.enviarAudio(PESSOA_DA_DEMO, audio))}
        aviso={(texto) => setPendentes({ base: total, mensagens: [local("assistente", texto)] })}
        cabecalho={<BotaoWhatsapp pessoaId={PESSOA_DA_DEMO} />}
      />
    </div>
  );
}
