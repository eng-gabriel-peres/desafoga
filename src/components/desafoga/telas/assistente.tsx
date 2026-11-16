"use client";

import { useState } from "react";
import { useConsulta } from "@/hooks/use-consulta";
import { servicos } from "@/services";
import { Chat } from "../chat/chat";
import { PESSOA_DA_DEMO } from "../moldura/navegacao";
import { Carregando, Painel, Sub, TituloCelular } from "../ui/blocos";

const EXEMPLOS: [string, string][] = [
  ["comprei pão 12", "Registra a compra e pergunta como você estava e se era necessária."],
  ["e se eu pagar 200 a mais?", "Simula o plano das dívidas com números calculados pelo sistema."],
  ["plano", "Mostra o seu plano para sair das dívidas."],
  ["quanto eu pago de juros?", "Mostra os juros, o IOF e as tarifas do mês."],
  ["resumo", "Compras de hoje e a nota do dia."],
  ["tô triste hoje", "Conversa livre: a Luana responde com base na memória que os profissionais deixaram."],
];

export function TelaAssistente() {
  const mensagens = useConsulta(`conversa:${PESSOA_DA_DEMO}`, () => servicos.assistente.conversa(PESSOA_DA_DEMO));
  const [digitando, setDigitando] = useState(false);
  const [rascunho, setRascunho] = useState("");

  async function enviar(texto: string) {
    setDigitando(true);
    try {
      await servicos.assistente.enviar(PESSOA_DA_DEMO, texto);
    } finally {
      setDigitando(false);
    }
  }

  const comandos = (
    <Painel titulo="O que a Luana entende">
      <ul className="grid gap-2.5">
        {EXEMPLOS.map(([exemplo, explicacao]) => (
          <li key={exemplo} className="grid grid-cols-[auto_1fr] items-start gap-3">
            <button
              type="button"
              onClick={() => setRascunho(exemplo)}
              aria-label={`Escrever "${exemplo}" no campo de mensagem`}
              className="min-h-11 max-w-[11rem] rounded-lg border border-line bg-surface2 px-2.5 py-1 text-left font-bold hover:border-primary"
            >
              {exemplo}
            </button>
            <span className="pt-2.5 text-[0.95rem]">{explicacao}</span>
          </li>
        ))}
      </ul>
      <Sub className="mt-3">Nesta demonstração, as respostas vêm de regras locais. Os números sempre saem das contas do sistema, nunca da IA.</Sub>
    </Painel>
  );

  return (
    <>
      <TituloCelular titulo="Assistente" />
      <p className="mb-3 rounded-xl bg-primary-soft px-3.5 py-3 text-[0.95rem] desk:hidden">
        Converse como no WhatsApp. Experimente: “tô triste e com vontade de comprar” ou “e se eu pagar 200 a mais?”.
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-[minmax(0,460px)_minmax(0,1fr)] desk:gap-5">
        {mensagens ? (
          <Chat mensagens={mensagens} digitando={digitando} enviar={enviar} rascunho={rascunho} setRascunho={setRascunho} />
        ) : (
          <Carregando rotulo="Carregando a conversa" />
        )}
        {comandos}
      </div>
    </>
  );
}
