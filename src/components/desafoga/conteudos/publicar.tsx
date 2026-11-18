"use client";

import { ChevronLeft, Plus, Send, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { CORES_DA_CAPA, minutosDeLeitura, paragrafos, TEMAS, TIPOS_DE_CONTEUDO, type CorDaCapa, type Tema, type TipoDeConteudo } from "@/lib/desafoga/conteudos";
import { servicos, type ConteudoNoFeed } from "@/services";
import { useEu } from "../sessao";
import { Carregando, Chip, Painel, Sub } from "../ui/blocos";
import { Botao } from "../ui/botao";
import { CAMPO } from "../ui/campos";
import { CartaoDoConteudo, fundoDaCapa, ICONE_DO_TIPO } from "./cartao";

const TIPOS = Object.keys(TIPOS_DE_CONTEUDO) as TipoDeConteudo[];
const CORES = Object.keys(CORES_DA_CAPA) as CorDaCapa[];

/** Publicar dica, artigo, carrossel ou enquete, com a prévia de como fica no feed. */
export function FormularioDoConteudo() {
  const eu = useEu();
  const router = useRouter();
  const agora = useAgora();
  const [tipo, setTipo] = useState<TipoDeConteudo>("dica");
  const [tema, setTema] = useState<Tema>(TEMAS[0]);
  const [cor, setCor] = useState<CorDaCapa>("azul");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [cartoes, setCartoes] = useState(["", ""]);
  const [opcoes, setOpcoes] = useState(["", ""]);
  const [avisar, setAvisar] = useState(true);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  if (!agora || !eu.profissional) return <Carregando />;
  const autor = eu.profissional;

  const limpos = {
    corpo: paragrafos(corpo),
    cartoes: cartoes.map((t) => t.trim()).filter(Boolean),
    opcoes: opcoes.map((t) => t.trim()).filter(Boolean),
  };
  const previa: ConteudoNoFeed = {
    id: "previa",
    tipo,
    tema,
    cor,
    titulo: titulo.trim(),
    texto: texto.trim(),
    corpo: limpos.corpo,
    cartoes: limpos.cartoes,
    opcoes: opcoes.map((t) => t.trim()),
    autor: { id: autor.id, nome: autor.nome, papel: autor.papel, cor: autor.cor },
    quando: agora.toISOString(),
    minutos: minutosDeLeitura(limpos.corpo),
    curtidas: 0,
    curti: false,
    salvei: false,
    enquete: null,
    comentarios: 0,
    primeiroComentario: null,
    meu: true,
  };

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    const falta =
      !titulo.trim()
        ? tipo === "enquete"
          ? "Escreva a pergunta."
          : "Escreva o título."
        : tipo === "dica" && !texto.trim()
          ? "Escreva o texto da dica."
          : tipo === "artigo" && !limpos.corpo.length
            ? "Escreva o texto do artigo."
            : tipo === "carrossel" && !limpos.cartoes.length
              ? "Escreva pelo menos um cartão."
              : tipo === "enquete" && limpos.opcoes.length < 2
                ? "A enquete precisa de pelo menos duas opções."
                : "";
    if (falta) return setErro(falta);
    setErro("");
    setEnviando(true);
    try {
      const { id } = await servicos.conteudos.publicar({ tipo, tema, cor, titulo: titulo.trim(), texto: texto.trim(), ...limpos, avisar });
      router.push(`/painel/conteudos/${id}`);
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não deu para publicar agora.");
      setEnviando(false);
    }
  }

  const lista = (valores: string[], mudar: (l: string[]) => void, rotulo: (i: number) => string, max: number, min: number, area: boolean) => (
    <div className="grid gap-2">
      {valores.map((v, i) => (
        <div key={i} className="flex items-start gap-2">
          {area ? (
            <textarea value={v} onChange={(e) => mudar(valores.map((x, k) => (k === i ? e.target.value : x)))} maxLength={300} rows={2} placeholder={rotulo(i)} aria-label={rotulo(i)} className={`${CAMPO} py-2`} />
          ) : (
            <input value={v} onChange={(e) => mudar(valores.map((x, k) => (k === i ? e.target.value : x)))} maxLength={80} placeholder={rotulo(i)} aria-label={rotulo(i)} autoComplete="off" className={CAMPO} />
          )}
          {valores.length > min && (
            <button type="button" aria-label={`Remover ${rotulo(i).toLowerCase()}`} onClick={() => mudar(valores.filter((_, k) => k !== i))} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface2">
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
      ))}
      {valores.length < max && (
        <Botao variante="secundario" tamanho="pequeno" className="justify-self-start" onClick={() => mudar([...valores, ""])}>
          <Plus aria-hidden="true" />
          Adicionar
        </Botao>
      )}
    </div>
  );

  return (
    <>
      <Link href="/painel/conteudos" className="mb-2 inline-flex items-center gap-1 font-bold text-primary">
        <ChevronLeft aria-hidden="true" className="size-4" /> Voltar aos conteúdos
      </Link>
      <form onSubmit={publicar} noValidate className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-2 desk:gap-5">
        <div className="grid gap-4">
          <Painel titulo="Que tipo de conteúdo?">
            <div className="grid grid-cols-1 gap-2 desk:grid-cols-2" role="radiogroup" aria-label="Tipo de conteúdo">
              {TIPOS.map((t) => {
                const Icone = ICONE_DO_TIPO[t];
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={tipo === t}
                    onClick={() => setTipo(t)}
                    className="flex items-start gap-2.5 rounded-[14px] border-2 border-line bg-surface p-3 text-left aria-checked:border-primary aria-checked:bg-primary-soft"
                  >
                    <Icone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                    <span>
                      <b className="block">{TIPOS_DE_CONTEUDO[t].nome}</b>
                      <span className="text-[0.85rem] text-muted">{TIPOS_DE_CONTEUDO[t].descricao}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Painel>
          <Painel titulo="Conteúdo">
            <div className="grid gap-4">
              <label>
                <span className="mb-1 block font-bold">{tipo === "enquete" ? "Pergunta" : tipo === "carrossel" ? "Título (primeiro cartão)" : "Título"}</span>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={120}
                  autoComplete="off"
                  placeholder={tipo === "enquete" ? "Ex.: Em que horário você mais compra?" : "Ex.: Regra das 24 horas"}
                  className={CAMPO}
                />
              </label>
              {tipo === "dica" && (
                <label>
                  <span className="mb-1 block font-bold">Texto da dica</span>
                  <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={220} rows={3} placeholder="Uma frase curta e direta" className={`${CAMPO} py-2.5`} />
                </label>
              )}
              {tipo === "artigo" && (
                <label>
                  <span className="mb-1 block font-bold">Texto do artigo</span>
                  <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={10} placeholder="Deixe uma linha em branco entre os parágrafos" className={`${CAMPO} py-2.5`} />
                </label>
              )}
              {tipo === "carrossel" && (
                <>
                  <fieldset className="min-w-0">
                    <legend className="mb-1.5 font-bold">Cartões</legend>
                    {lista(cartoes, setCartoes, (i) => `Cartão ${i + 2}`, 7, 1, true)}
                  </fieldset>
                  <label>
                    <span className="mb-1 block font-bold">Legenda (opcional)</span>
                    <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={600} rows={2} placeholder="Texto que aparece abaixo do carrossel" className={`${CAMPO} py-2.5`} />
                  </label>
                </>
              )}
              {tipo === "enquete" && (
                <fieldset className="min-w-0">
                  <legend className="mb-1.5 font-bold">Opções</legend>
                  {lista(opcoes, setOpcoes, (i) => `Opção ${i + 1}`, 4, 2, false)}
                </fieldset>
              )}
              <fieldset className="min-w-0">
                <legend className="mb-1.5 font-bold">Tema</legend>
                <div className="flex flex-wrap gap-1.5">
                  {TEMAS.map((t) => (
                    <Chip key={t} pequeno marcado={tema === t} onClick={() => setTema(t)}>
                      {t}
                    </Chip>
                  ))}
                </div>
              </fieldset>
              <fieldset className="min-w-0">
                <legend className="mb-1.5 font-bold">Cor</legend>
                <div className="flex flex-wrap gap-2.5">
                  {CORES.map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={cor === k}
                      aria-label={`Cor ${k}`}
                      onClick={() => setCor(k)}
                      className="size-11 rounded-full border-[3px] border-surface shadow-[0_0_0_1px_var(--line)] aria-pressed:shadow-[0_0_0_3px_var(--ink)]"
                      style={fundoDaCapa(k)}
                    />
                  ))}
                </div>
              </fieldset>
              <label className="flex items-start gap-2.5">
                <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="mt-1 size-5 accent-[var(--primary)]" />
                <span>Avisar quem segue você (a Luana conta no chat)</span>
              </label>
              {erro && (
                <p role="alert" className="font-bold text-bad">
                  {erro}
                </p>
              )}
              <Botao type="submit" tamanho="grande" bloco disabled={enviando}>
                <Send aria-hidden="true" />
                Publicar
              </Botao>
            </div>
          </Painel>
        </div>
        <Painel titulo="Prévia">
          <Sub className="mb-3">Assim o post aparece no feed.</Sub>
          <CartaoDoConteudo c={previa} base="/painel/conteudos" agora={agora} completo />
        </Painel>
      </form>
    </>
  );
}
