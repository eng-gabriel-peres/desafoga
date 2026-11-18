"use client";

import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { usePessoa } from "@/hooks/use-pessoa";
import { TIPOS_DE_CONQUISTA, tituloAutomatico, type IconeDaConquista, type TipoDeConquista } from "@/lib/finance";
import { servicos } from "@/services";
import { CartaoDaConquista, ICONE_DA_CONQUISTA } from "../conquistas/cartao";
import { useEu, useMinhaPessoaId } from "../sessao";
import { Carregando, Painel, Sub, Vazio } from "../ui/blocos";
import { Botao } from "../ui/botao";
import { CAMPO } from "../ui/campos";

/** Conquistas da pessoa: as metas com prêmio que quem acompanha criou. */
export function TelaConquistas() {
  const pessoaId = useMinhaPessoaId();
  const eu = useEu();
  const dados = usePessoa(pessoaId);
  const lista = useConsulta(`conquistas:${pessoaId}`, () => servicos.conquistas.listar(pessoaId));
  const agora = useAgora();
  if (!dados || !lista || !agora) return <Carregando />;
  const quem = eu.acompanhantes[0]?.nome ?? "quem te acompanha";

  return (
    <>
      <div className="mb-4 desk:hidden">
        <h1 className="text-[1.7rem] leading-tight font-bold">Conquistas</h1>
        <p className="mt-0.5 text-muted">Metas que {quem} criou para você</p>
      </div>
      {lista.length ? (
        <div className="grid gap-3 desk:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {lista.map((c) => (
            <CartaoDaConquista key={c.id} conquista={c} compras={dados.compras} agora={agora} />
          ))}
        </div>
      ) : (
        <Vazio>Ainda não há conquistas. Quem te acompanha pode criar metas com prêmios para você.</Vazio>
      )}
    </>
  );
}

const ICONES = Object.keys(ICONE_DA_CONQUISTA) as IconeDaConquista[];
const TIPOS = Object.keys(TIPOS_DE_CONQUISTA) as TipoDeConquista[];

/** Painel do profissional: criar conquistas com prêmio e ver o andamento. */
export function TelaConquistasDoPaciente({ pessoaId }: { pessoaId: string }) {
  const dados = usePessoa(pessoaId);
  const lista = useConsulta(`conquistas:${pessoaId}`, () => servicos.conquistas.listar(pessoaId));
  const agora = useAgora();
  const eu = useEu();
  const [icone, setIcone] = useState<IconeDaConquista>("broto");
  const [tipo, setTipo] = useState<TipoDeConquista>("sem-impulso");
  const [alvo, setAlvo] = useState("3");
  const [titulo, setTitulo] = useState("");
  const [premio, setPremio] = useState("");
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const [salvando, setSalvando] = useState(false);
  if (!dados || !lista || !agora) return <Carregando />;

  const apelido = dados.persona.apelido;
  const n = Number.parseInt(alvo, 10);
  const valido = Number.isInteger(n) && n >= 1 && n <= 365;

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setFeito("");
    if (!valido) return setErro("Coloque uma meta de 1 a 365.");
    setErro("");
    setSalvando(true);
    try {
      await servicos.conquistas.criar(pessoaId, { icone, tipo, alvo: n, titulo, premio });
      setTitulo("");
      setPremio("");
      setFeito(`Conquista criada. ${apelido} recebe o aviso da Luana.`);
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não deu para criar agora.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-2 desk:gap-5">
      <Painel titulo={`Nova conquista para ${apelido}`}>
        <form onSubmit={criar} noValidate className="grid gap-4">
          <fieldset className="min-w-0">
            <legend className="mb-1.5 font-bold">Ícone</legend>
            <div className="grid max-w-[420px] grid-cols-8 gap-1.5">
              {ICONES.map((i) => {
                const [Icone, nome] = ICONE_DA_CONQUISTA[i];
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={icone === i}
                    aria-label={`Ícone ${nome}`}
                    onClick={() => setIcone(i)}
                    className="grid aspect-square place-items-center rounded-xl border-2 border-line bg-surface hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary-soft"
                  >
                    <Icone aria-hidden="true" className="size-6" />
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="mb-1.5 font-bold">O que a pessoa precisa fazer?</legend>
            <div className="grid gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tipo === t}
                  onClick={() => setTipo(t)}
                  className="rounded-[14px] border-2 border-line bg-surface px-3.5 py-2.5 text-left font-bold aria-pressed:border-primary aria-pressed:bg-primary-soft"
                >
                  {TIPOS_DE_CONQUISTA[t].titulo}
                </button>
              ))}
            </div>
            <Sub className="mt-2">{TIPOS_DE_CONQUISTA[tipo].descricao}</Sub>
          </fieldset>
          <label>
            <span className="mb-1 block font-bold">Meta ({TIPOS_DE_CONQUISTA[tipo].unidade})</span>
            <input value={alvo} onChange={(e) => setAlvo(e.target.value)} type="number" min={1} max={365} inputMode="numeric" className={CAMPO} />
          </label>
          <label>
            <span className="mb-1 block font-bold">Nome da conquista</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={80}
              autoComplete="off"
              placeholder={tituloAutomatico(tipo, valido ? n : 1)}
              className={CAMPO}
            />
          </label>
          <label>
            <span className="mb-1 block font-bold">Prêmio (opcional)</span>
            <input value={premio} onChange={(e) => setPremio(e.target.value)} maxLength={80} autoComplete="off" placeholder="Ex.: cinema no sábado" className={CAMPO} />
          </label>
          {erro && (
            <p role="alert" className="font-bold text-bad">
              {erro}
            </p>
          )}
          {feito && (
            <p role="status" className="font-bold text-good">
              {feito}
            </p>
          )}
          <Botao type="submit" bloco disabled={salvando}>
            Criar conquista
          </Botao>
        </form>
      </Painel>
      <section aria-labelledby="lista-de-conquistas">
        <h2 id="lista-de-conquistas" className="mb-2.5 text-[1.12rem] font-bold">
          Conquistas de {apelido}
        </h2>
        {lista.length ? (
          <div className="grid gap-3">
            {lista.map((c) => (
              <CartaoDaConquista
                key={c.id}
                conquista={c}
                compras={dados.compras}
                agora={agora}
                aoApagar={eu.profissional ? () => void servicos.conquistas.apagar(pessoaId, c.id) : undefined}
              />
            ))}
          </div>
        ) : (
          <Vazio>Nenhuma conquista ainda. Crie a primeira.</Vazio>
        )}
      </section>
    </div>
  );
}
