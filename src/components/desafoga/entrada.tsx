"use client";

import { ChevronRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useConsulta } from "@/hooks/use-consulta";
import { servicos } from "@/services";
import { BotaoLetraMaior, Marca } from "./moldura/partes";
import { PESSOA_DA_DEMO } from "./moldura/navegacao";
import { Avatar } from "./ui/blocos";

/**
 * Entrada da demonstração: escolhe em qual das duas áreas entrar. Quando a
 * autenticação chegar, esta tela vira o login e cada perfil cai na sua área.
 */
export function Entrada() {
  const perfis = useConsulta("entrada", async () => {
    const [pessoa, responsavel] = await Promise.all([
      servicos.pessoas.obter(PESSOA_DA_DEMO),
      servicos.pessoas.responsavel(),
    ]);
    return { pessoa, responsavel };
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Marca />
        <BotaoLetraMaior />
      </div>
      <h1 className="text-[1.9rem] leading-tight font-bold">Respire. Suas compras e dívidas, sem peso.</h1>
      <p className="mt-2 text-muted">
        O Desafoga junta a emoção de cada compra, o raio-x das dívidas e um profissional acompanhando. Escolha por onde
        entrar na demonstração.
      </p>

      <ul className="mt-7 grid gap-3">
        <li>
          <CartaoDeEntrada
            href="/app/hoje"
            titulo={perfis?.pessoa ? `Entrar como ${perfis.pessoa.apelido}` : "Entrar como pessoa"}
            descricao="App de quem usa: nota do dia, registro de compras, assistente e dívidas."
            nome={perfis?.pessoa?.nome}
            cor={perfis?.pessoa?.cor}
          />
        </li>
        <li>
          <CartaoDeEntrada
            href="/painel"
            titulo={perfis ? `Entrar como ${perfis.responsavel.nome}` : "Entrar como responsável"}
            descricao={`Painel de quem acompanha${perfis ? ` (${perfis.responsavel.papel.toLowerCase()})` : ""}: pacientes, resumo, dívidas e memória do assistente.`}
            nome={perfis?.responsavel.nome}
            cor={perfis?.responsavel.cor}
          />
        </li>
      </ul>

      <p className="mt-6 text-[0.88rem] text-muted">
        Demonstração com dados fictícios. Nada sai do seu navegador.
      </p>
      <button
        type="button"
        onClick={() => servicos.recomecar()}
        className="mt-2 inline-flex min-h-11 items-center gap-2 self-start font-bold text-primary hover:underline"
      >
        <RotateCcw aria-hidden="true" className="size-4" />
        Recomeçar demonstração
      </button>
    </main>
  );
}

function CartaoDeEntrada({
  href,
  titulo,
  descricao,
  nome,
  cor,
}: {
  href: string;
  titulo: string;
  descricao: string;
  nome?: string;
  cor?: string;
}) {
  return (
    <Link
      href={href}
      className="grid min-h-24 grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-[var(--radius-card)] border-2 border-line bg-surface p-4 no-underline hover:border-primary"
    >
      {nome && cor ? <Avatar nome={nome} cor={cor} tamanho="lg" /> : <span className="size-13" />}
      <span>
        <b className="block text-[1.1rem]">{titulo}</b>
        <span className="text-[0.92rem] text-muted">{descricao}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-6 text-muted" />
    </Link>
  );
}
