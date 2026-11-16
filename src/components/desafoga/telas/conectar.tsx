"use client";

import { Check, MessageCircle, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { telefoneLegivel } from "@/lib/desafoga/telefone";
import { servicos } from "@/services";
import { PESSOA_DA_DEMO } from "../moldura/navegacao";
import { Carregando, Painel } from "../ui/blocos";
import { BotaoLink } from "../ui/botao";

type Estado = { tipo: "conectando" } | { tipo: "pronto"; telefone: string } | { tipo: "erro"; mensagem: string };

/**
 * Página aberta pelo link que a Luana manda no WhatsApp. O código vem depois
 * do #; ao abrir, conecta o número à conta aberta neste navegador.
 */
export function TelaConectar() {
  const [estado, setEstado] = useState<Estado>({ tipo: "conectando" });
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current) return;
    feito.current = true;
    const codigo = decodeURIComponent(window.location.hash.slice(1));
    // Tira o código do endereço: não fica no histórico nem é compartilhado sem querer.
    history.replaceState(null, "", window.location.pathname);
    const conectar = async () => {
      if (!codigo) throw new Error("Este endereço não tem o link de conexão. Abra o link que a Luana mandou no WhatsApp.");
      return servicos.pessoas.conectarWhatsappPorLink(PESSOA_DA_DEMO, codigo);
    };
    conectar().then(
      (telefone) => setEstado({ tipo: "pronto", telefone }),
      (e: unknown) => setEstado({ tipo: "erro", mensagem: e instanceof Error ? e.message : "Não consegui conectar." }),
    );
  }, []);

  if (estado.tipo === "conectando") return <Carregando rotulo="Conectando seu WhatsApp" />;

  return (
    <div className="mx-auto max-w-[520px]">
      <Painel>
        <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
          <span
            aria-hidden="true"
            className={`grid size-16 place-items-center rounded-full ${estado.tipo === "pronto" ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}
          >
            {estado.tipo === "pronto" ? <Check className="size-8" /> : <TriangleAlert className="size-8" />}
          </span>
          {estado.tipo === "pronto" ? (
            <>
              <h1 className="text-[1.4rem] font-bold">WhatsApp conectado</h1>
              <p>
                O número <b>{telefoneLegivel(estado.telefone)}</b> agora está ligado à sua conta. Pode conversar com a Luana por lá: compras, faturas e áudios entram aqui no app.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-[1.4rem] font-bold">Não deu para conectar</h1>
              <p>{estado.mensagem}</p>
            </>
          )}
          <BotaoLink href="/app/assistente" className="mt-2">
            <MessageCircle aria-hidden="true" />
            Ir para o assistente
          </BotaoLink>
        </div>
      </Painel>
    </div>
  );
}
