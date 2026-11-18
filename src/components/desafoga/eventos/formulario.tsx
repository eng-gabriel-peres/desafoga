"use client";

import { ChevronLeft, MapPin, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { REGRAS_DO_DESAFIO, type Categoria, type RegraDoDesafio } from "@/lib/finance";
import { servicos, type TipoDeEvento } from "@/services";
import { CATEGORIAS, ICONE_DA_CATEGORIA } from "../categorias";
import { Avatar, Carregando, Painel, Sub } from "../ui/blocos";
import { Botao } from "../ui/botao";
import { CAMPO } from "../ui/campos";
import { hojeNoBrasil } from "./visual";

const somar = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const REGRAS = Object.keys(REGRAS_DO_DESAFIO) as RegraDoDesafio[];

/** Criar desafio em grupo ou encontro presencial (como no protótipo). */
export function FormularioDoEvento() {
  const router = useRouter();
  const agora = useAgora();
  const pessoas = useConsulta("pessoas", () => servicos.pessoas.listar());
  const hoje = agora ? hojeNoBrasil(agora) : "";
  const [tipo, setTipo] = useState<TipoDeEvento>("desafio");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [regra, setRegra] = useState<RegraDoDesafio>("sem-desnecessaria");
  const [categoria, setCategoria] = useState<Categoria>("Comida pronta");
  const [limite, setLimite] = useState("50");
  const [inicio, setInicio] = useState<string | null>(null);
  const [fim, setFim] = useState<string | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [hora, setHora] = useState("19:00");
  const [local, setLocal] = useState("");
  const [premio, setPremio] = useState("");
  const [mostrarRanking, setMostrarRanking] = useState(true);
  const [participantes, setParticipantes] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  if (!agora || !pessoas) return <Carregando />;

  const desafio = tipo === "desafio";
  const de = inicio ?? hoje;
  const ate = fim ?? somar(hoje, 6);
  const dia = data ?? somar(hoje, 7);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const reais = Number(limite.replace(",", "."));
    if (!nome.trim()) return setErro("Dê um nome ao evento.");
    if (desafio && de > ate) return setErro("O fim precisa ser depois do começo.");
    if (desafio && regra === "limite-dia" && !(reais >= 1)) return setErro("Coloque um limite de pelo menos R$ 1.");
    if (!desafio && !local.trim()) return setErro("Diga onde vai ser o encontro.");
    setErro("");
    setSalvando(true);
    try {
      const { id } = await servicos.eventos.criar({
        tipo,
        nome: nome.trim(),
        descricao: descricao.trim(),
        regra: desafio ? regra : null,
        categoria: desafio && regra === "sem-categoria" ? categoria : null,
        limite: desafio && regra === "limite-dia" ? Math.round(reais * 100) : null,
        inicio: desafio ? de : null,
        fim: desafio ? ate : null,
        data: desafio ? null : dia,
        hora: desafio ? null : hora,
        local: desafio ? null : local.trim(),
        premio: desafio ? premio.trim() : "",
        mostrarRanking,
        participantes,
      });
      router.push(`/painel/eventos/${id}`);
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não deu para criar agora.");
      setSalvando(false);
    }
  }

  return (
    <>
      <Link href="/painel/eventos" className="mb-2 inline-flex items-center gap-1 font-bold text-primary">
        <ChevronLeft aria-hidden="true" className="size-4" /> Voltar aos eventos
      </Link>
      <form onSubmit={criar} noValidate className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-2 desk:gap-5">
        <div className="grid gap-4">
          <Painel titulo="Tipo de evento">
            <div className="grid gap-2" role="radiogroup" aria-label="Tipo de evento">
              {(
                [
                  ["desafio", Target, "Desafio em grupo", "As pessoas seguem uma regra por alguns dias. O app confere pelas compras registradas."],
                  ["presencial", MapPin, "Encontro presencial", "Um encontro com data e local. A Luana avisa e pede confirmação."],
                ] as const
              ).map(([t, Icone, titulo, texto]) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tipo === t}
                  onClick={() => setTipo(t)}
                  className="flex items-start gap-3 rounded-[14px] border-2 border-line bg-surface p-3 text-left aria-checked:border-primary aria-checked:bg-primary-soft"
                >
                  <Icone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span>
                    <b className="block">{titulo}</b>
                    <span className="text-[0.88rem] text-muted">{texto}</span>
                  </span>
                </button>
              ))}
            </div>
          </Painel>
          <Painel titulo="Como vai ser">
            <div className="grid gap-4">
              <label>
                <span className="mb-1 block font-bold">Nome do evento</span>
                <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoComplete="off" placeholder={desafio ? "Ex.: 7 dias sem delivery" : "Ex.: Roda de conversa"} className={CAMPO} />
              </label>
              <label>
                <span className="mb-1 block font-bold">Descrição (opcional)</span>
                <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} rows={3} placeholder="O que as pessoas precisam saber" className={`${CAMPO} py-2.5`} />
              </label>
              {desafio ? (
                <>
                  <fieldset className="min-w-0">
                    <legend className="mb-1.5 font-bold">Regra do desafio</legend>
                    <div className="grid gap-2">
                      {REGRAS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          aria-pressed={regra === r}
                          onClick={() => setRegra(r)}
                          className="rounded-[14px] border-2 border-line bg-surface px-3.5 py-2.5 text-left font-bold aria-pressed:border-primary aria-pressed:bg-primary-soft"
                        >
                          {REGRAS_DO_DESAFIO[r].titulo}
                        </button>
                      ))}
                    </div>
                    <Sub className="mt-2">{REGRAS_DO_DESAFIO[regra].descricao}</Sub>
                  </fieldset>
                  {regra === "sem-categoria" && (
                    <fieldset className="min-w-0">
                      <legend className="mb-1.5 font-bold">Categoria que fica de fora</legend>
                      <div className="grid grid-cols-2 gap-2 desk:grid-cols-4">
                        {CATEGORIAS.map((c) => {
                          const Icone = ICONE_DA_CATEGORIA[c];
                          return (
                            <button
                              key={c}
                              type="button"
                              aria-pressed={categoria === c}
                              onClick={() => setCategoria(c)}
                              className="flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-line bg-surface px-2.5 text-[0.9rem] font-bold aria-pressed:border-primary aria-pressed:bg-primary-soft"
                            >
                              <Icone aria-hidden="true" className="size-4 shrink-0" />
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}
                  {regra === "limite-dia" && (
                    <label>
                      <span className="mb-1 block font-bold">Limite por dia (R$)</span>
                      <input value={limite} onChange={(e) => setLimite(e.target.value)} inputMode="decimal" className={CAMPO} />
                    </label>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      <span className="mb-1 block font-bold">Começa em</span>
                      <input type="date" value={de} onChange={(e) => setInicio(e.target.value)} className={CAMPO} />
                    </label>
                    <label>
                      <span className="mb-1 block font-bold">Termina em</span>
                      <input type="date" value={ate} min={de} onChange={(e) => setFim(e.target.value)} className={CAMPO} />
                    </label>
                  </div>
                  <label>
                    <span className="mb-1 block font-bold">Prêmio para quem completar (opcional)</span>
                    <input value={premio} onChange={(e) => setPremio(e.target.value)} maxLength={80} autoComplete="off" placeholder="Ex.: café da manhã juntos" className={CAMPO} />
                  </label>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      <span className="mb-1 block font-bold">Data</span>
                      <input type="date" value={dia} min={hoje} onChange={(e) => setData(e.target.value)} className={CAMPO} />
                    </label>
                    <label>
                      <span className="mb-1 block font-bold">Horário</span>
                      <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={CAMPO} />
                    </label>
                  </div>
                  <label>
                    <span className="mb-1 block font-bold">Local</span>
                    <input value={local} onChange={(e) => setLocal(e.target.value)} maxLength={160} autoComplete="off" placeholder="Endereço ou nome do lugar" className={CAMPO} />
                  </label>
                </>
              )}
            </div>
          </Painel>
        </div>
        <div className="grid gap-4">
          <Painel titulo="Quem participa">
            {pessoas.length ? (
              <ul className="grid gap-1.5">
                {pessoas.map((p) => (
                  <li key={p.id}>
                    <label className="flex min-h-11 items-center gap-2.5 rounded-xl border border-line px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={participantes.includes(p.id)}
                        onChange={(e) => setParticipantes((l) => (e.target.checked ? [...l, p.id] : l.filter((x) => x !== p.id)))}
                        className="size-5 accent-[var(--primary)]"
                      />
                      <Avatar nome={p.nome} cor={p.cor} tamanho="sm" />
                      {p.nome}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <Sub>Você ainda não acompanha ninguém. Dá para criar o evento e adicionar pessoas depois.</Sub>
            )}
            {desafio && (
              <label className="mt-3 flex items-start gap-2.5">
                <input type="checkbox" checked={mostrarRanking} onChange={(e) => setMostrarRanking(e.target.checked)} className="mt-1 size-5 accent-[var(--primary)]" />
                <span>Mostrar ranking para os participantes</span>
              </label>
            )}
            <Sub className="mt-3">Quem entrar recebe o aviso da Luana no chat do app.</Sub>
          </Painel>
          {erro && (
            <p role="alert" className="font-bold text-bad">
              {erro}
            </p>
          )}
          <Botao type="submit" tamanho="grande" bloco disabled={salvando}>
            Criar evento
          </Botao>
        </div>
      </form>
    </>
  );
}
