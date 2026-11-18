"use client";

import { CalendarDays, Check, Gift, ListChecks, MapPin, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { dataCurtaDaChave, dataLongaDaChave, regraEmTexto } from "@/lib/assistente/textos";
import { servicos, type ConviteDoEvento, type Eu } from "@/services";
import { Marca } from "../moldura/partes";
import { Carregando, Painel, Sub } from "../ui/blocos";
import { Botao } from "../ui/botao";
import { CAMPO } from "../ui/campos";

/**
 * Quem abre o link de convite: vê o básico do evento (sem ninguém do grupo)
 * e entra. Quem já usa o app neste aparelho entra com um toque; quem não usa
 * faz um cadastro rápido. Entrar pelo link já é aceitar o convite.
 */
export function ConviteParaEvento({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [convite, setConvite] = useState<ConviteDoEvento | null>(null);
  const [eu, setEu] = useState<Eu | null | undefined>(undefined);
  const [erro, setErro] = useState("");
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [idade, setIdade] = useState("");
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    servicos.eventos.convite(codigo).then(setConvite, (e: unknown) => setErro(e instanceof Error ? e.message : "Convite não encontrado."));
    servicos.sessao.eu().then(setEu, () => setEu(null));
  }, [codigo]);

  async function entrar() {
    setEnviando(true);
    setErro("");
    try {
      const { id } = await servicos.eventos.entrarPeloLink(codigo);
      router.push(`/app/eventos/${id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para entrar agora.");
      setEnviando(false);
    }
  }

  async function cadastrarEEntrar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !apelido.trim()) return setErro("Escreva seu nome e como prefere ser chamado.");
    if (!aceito) return setErro("Para participar, marque que você está de acordo.");
    const anos = idade.trim() ? Number.parseInt(idade, 10) : null;
    setEnviando(true);
    setErro("");
    try {
      await servicos.sessao.criarConta({ tipo: "pessoa", nome: nome.trim(), apelido: apelido.trim(), idade: anos });
      await entrar();
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não deu para criar a conta agora.");
      setEnviando(false);
    }
  }

  const casca = (conteudo: React.ReactNode) => (
    <main className="mx-auto grid max-w-[520px] gap-4 px-4 py-8">
      <Marca />
      {conteudo}
    </main>
  );

  if (erro && !convite) {
    return casca(
      <Painel titulo="Convite não encontrado">
        <Sub>{erro}</Sub>
      </Painel>,
    );
  }
  if (!convite || eu === undefined) return casca(<Carregando />);

  const desafio = convite.tipo === "desafio";
  const Icone = desafio ? Target : MapPin;
  const linhas: [typeof CalendarDays, string][] = desafio
    ? [
        [CalendarDays, `${dataCurtaDaChave(convite.inicio ?? "")} a ${dataCurtaDaChave(convite.fim ?? "")}`],
        [ListChecks, convite.regra ? regraEmTexto({ regra: convite.regra, categoria: convite.categoria, limite: convite.limite }) : ""],
        ...(convite.premio ? [[Gift, convite.premio] as [typeof CalendarDays, string]] : []),
      ]
    : [
        [CalendarDays, `${dataLongaDaChave(convite.data ?? "")}, ${convite.hora}`],
        [MapPin, convite.local ?? ""],
      ];

  return casca(
    <>
      <Painel>
        <Sub>{convite.profissional} convidou você para</Sub>
        <div className="mt-2.5 flex items-start gap-3">
          <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-xl ${desafio ? "bg-primary-soft text-primary" : "bg-maybe-soft text-maybe"}`}>
            <Icone className="size-5" />
          </span>
          <div>
            <h1 className="text-[1.45rem] leading-tight font-bold">{convite.nome}</h1>
            <p className="text-[0.9rem] text-muted">{desafio ? "Desafio em grupo" : "Encontro presencial"}</p>
          </div>
        </div>
        <ul className="mt-3 grid gap-1.5">
          {linhas.map(([I, t]) => (
            <li key={t} className="flex items-start gap-2">
              <I aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
              {t}
            </li>
          ))}
        </ul>
        {convite.descricao && <p className="mt-3">{convite.descricao}</p>}
        <p className="mt-3 text-[0.9rem] text-muted">
          {convite.pessoasNoGrupo === 0 ? "Ninguém entrou ainda." : `${convite.pessoasNoGrupo} ${convite.pessoasNoGrupo === 1 ? "pessoa já participa" : "pessoas já participam"}.`}
        </p>
      </Painel>
      {convite.situacao.fase === "fim" ? (
        <Painel>
          <Sub>Este evento já terminou.</Sub>
        </Painel>
      ) : eu?.profissional ? (
        <Painel>
          <Sub>Você está como profissional. Para participar, abra o link na conta da pessoa.</Sub>
        </Painel>
      ) : eu?.pessoa ? (
        <Painel>
          <p>
            Você vai entrar como <b>{eu.pessoa.nome}</b>. Quem participa vê o seu primeiro nome{desafio ? " e os seus pontos, nunca as suas compras" : " e se você vai"}.
          </p>
          {erro && (
            <p role="alert" className="mt-2 font-bold text-bad">
              {erro}
            </p>
          )}
          <Botao tamanho="grande" bloco className="mt-3" disabled={enviando} onClick={entrar}>
            <Check aria-hidden="true" />
            Quero participar
          </Botao>
        </Painel>
      ) : (
        <Painel titulo="Crie seu cadastro">
          <Sub className="mb-3">Leva menos de um minuto. Depois disso você já está no evento.</Sub>
          <form onSubmit={cadastrarEEntrar} noValidate className="grid gap-3.5">
            <label>
              <span className="mb-1 block font-bold">Seu nome</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoComplete="name" placeholder="Nome e sobrenome" className={CAMPO} />
            </label>
            <label>
              <span className="mb-1 block font-bold">Como prefere ser chamado(a)</span>
              <input value={apelido} onChange={(e) => setApelido(e.target.value)} maxLength={40} autoComplete="nickname" className={CAMPO} />
            </label>
            <label>
              <span className="mb-1 block font-bold">Idade (opcional)</span>
              <input value={idade} onChange={(e) => setIdade(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" className={CAMPO} />
            </label>
            <label className="flex items-start gap-2.5 rounded-xl border border-line p-3">
              <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--primary)]" />
              <span>
                Aceito que a Luana me mande mensagens sobre o evento e que {convite.profissional} e quem participa vejam meu primeiro nome
                {desafio ? " e meus pontos no desafio (nunca as minhas compras)" : " e se eu vou"}.
              </span>
            </label>
            {erro && (
              <p role="alert" className="font-bold text-bad">
                {erro}
              </p>
            )}
            <Botao type="submit" tamanho="grande" bloco disabled={enviando}>
              Entrar no evento
            </Botao>
          </form>
        </Painel>
      )}
    </>,
  );
}
