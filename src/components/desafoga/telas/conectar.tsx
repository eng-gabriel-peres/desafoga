"use client";

import { Check, MessageCircle, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useConsulta } from "@/hooks/use-consulta";
import { telefoneLegivel } from "@/lib/desafoga/telefone";
import { servicos } from "@/services";
import { PESSOA_DA_DEMO } from "../moldura/navegacao";
import { Carregando, Painel } from "../ui/blocos";
import { Botao, BotaoLink } from "../ui/botao";

type Estado =
  | { tipo: "lendo" }
  | { tipo: "confirmar"; codigo: string; telefone: string }
  | { tipo: "conectando" }
  | { tipo: "pronto"; telefone: string }
  | { tipo: "erro"; mensagem: string };

/** Número que vem dentro do link, só para mostrar. Quem confere a assinatura é o servidor. */
function numeroDoLink(codigo: string): string | null {
  try {
    const [dados] = codigo.split(".");
    const json = JSON.parse(atob(dados.replace(/-/g, "+").replace(/_/g, "/"))) as { t?: unknown };
    return typeof json.t === "string" ? json.t : null;
  } catch {
    return null;
  }
}

/**
 * Página aberta pelo link que a Luana manda no WhatsApp. Não conecta sozinha:
 * mostra o número e pede confirmação, para ninguém ligar o próprio número à
 * conta de outra pessoa mandando o link para ela abrir.
 */
export function TelaConectar() {
  const [estado, setEstado] = useState<Estado>({ tipo: "lendo" });
  const atual = useConsulta(`whatsapp:${PESSOA_DA_DEMO}`, () => servicos.pessoas.whatsapp(PESSOA_DA_DEMO));
  const ultimoCodigo = useRef<string | null>(null);

  useEffect(() => {
    // Lê o link do endereço ao abrir e também quando a âncora muda com a
    // página já aberta (tocar no link de novo não recarrega a página).
    function lerLink() {
      const codigo = decodeURIComponent(window.location.hash.slice(1));
      if (!codigo) {
        // Sem âncora: mantém o link já lido (o modo de desenvolvimento roda o efeito duas vezes).
        if (!ultimoCodigo.current) {
          setEstado({ tipo: "erro", mensagem: "Este endereço não tem um link de conexão válido. Abra o link que a Luana mandou no WhatsApp." });
        }
        return;
      }
      ultimoCodigo.current = codigo;
      // Tira o código do endereço: não fica no histórico nem é compartilhado sem querer.
      history.replaceState(history.state, "", window.location.pathname);
      const telefone = numeroDoLink(codigo);
      setEstado(
        telefone
          ? { tipo: "confirmar", codigo, telefone }
          : { tipo: "erro", mensagem: "Este endereço não tem um link de conexão válido. Abra o link que a Luana mandou no WhatsApp." },
      );
    }
    const agendado = setTimeout(lerLink, 0);
    window.addEventListener("hashchange", lerLink);
    return () => {
      clearTimeout(agendado);
      window.removeEventListener("hashchange", lerLink);
    };
  }, []);

  async function confirmar(codigo: string) {
    setEstado({ tipo: "conectando" });
    try {
      setEstado({ tipo: "pronto", telefone: await servicos.pessoas.conectarWhatsappPorLink(PESSOA_DA_DEMO, codigo) });
    } catch (e) {
      setEstado({ tipo: "erro", mensagem: e instanceof Error ? e.message : "Não consegui conectar." });
    }
  }

  if (estado.tipo === "lendo" || estado.tipo === "conectando") return <Carregando rotulo="Conectando seu WhatsApp" />;

  if (estado.tipo === "confirmar") {
    const troca = atual && atual !== estado.telefone;
    return (
      <div className="mx-auto max-w-[520px]">
        <Painel>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
              <MessageCircle className="size-8" />
            </span>
            <h1 className="text-[1.4rem] font-bold">Conectar este WhatsApp?</h1>
            <p className="text-[1.3rem] font-bold">{telefoneLegivel(estado.telefone)}</p>
            <p>
              Compras, faturas e áudios mandados por esse número vão entrar na sua conta, e a Luana vai responder por lá com os seus dados.
            </p>
            <p className="rounded-xl bg-maybe-soft px-3 py-2 text-[0.95rem] text-maybe">
              Só confirme se esse número é seu e você mesmo pediu o link pelo WhatsApp.
              {troca && ` Isso substitui o número conectado agora, ${telefoneLegivel(atual)}.`}
            </p>
            <div className="mt-2 grid w-full gap-2.5">
              <Botao bloco onClick={() => confirmar(estado.codigo)}>
                Sim, o número é meu
              </Botao>
              <BotaoLink href="/app/assistente" variante="secundario" bloco>
                Não é meu, cancelar
              </BotaoLink>
            </div>
          </div>
        </Painel>
      </div>
    );
  }

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
