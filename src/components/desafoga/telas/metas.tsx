"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { usePessoa } from "@/hooks/use-pessoa";
import { guardadoNaMeta, situacaoDaMeta, type Meta } from "@/lib/finance";
import { reaisCurto } from "@/lib/assistente/textos";
import { servicos } from "@/services";
import { CartaoDaMeta } from "../metas/cartao";
import type { Area } from "../moldura/navegacao";
import { usePessoaDaSessao } from "../sessao";
import { Carregando, TituloCelular } from "../ui/blocos";
import { BotaoLink } from "../ui/botao";

/** Aviso curto depois de guardar ou incentivar, lido pelo leitor de tela. */
export function Recado({ texto }: { texto: string }) {
  return (
    <p role="status" className={texto ? "entrar mb-3.5 rounded-2xl bg-good-soft px-4 py-3 font-bold text-good" : "sr-only"}>
      {texto}
    </p>
  );
}

export const rotaDasMetas = (area: Area, pessoaId: string) => (area === "pessoa" ? "/app/metas" : `/painel/${pessoaId}/metas`);

/** Metas da pessoa. O profissional vê só leitura e pode mandar incentivo. */
export function TelaMetas({ area = "pessoa", pessoaId: doPainel }: { area?: Area; pessoaId?: string }) {
  const minha = usePessoaDaSessao();
  const pessoaId = doPainel ?? minha ?? "";
  const dados = usePessoa(pessoaId);
  const agora = useAgora();
  const [recado, setRecado] = useState("");
  if (!dados || !agora) return <Carregando />;

  const { persona, metas } = dados;
  const profissional = area === "responsavel";
  const ativas = metas.filter((m) => !situacaoDaMeta(m, agora).concluida);
  const concluidas = metas.filter((m) => situacaoDaMeta(m, agora).concluida);
  const total = metas.reduce((s, m) => s + guardadoNaMeta(m), 0);

  async function incentivar(m: Meta) {
    const r = await servicos.metas.incentivar(pessoaId, m.id);
    setRecado(`Incentivo enviado para ${persona.apelido} ${r.whatsapp ? "no WhatsApp e no app" : "no app"}.`);
  }

  const grade = (lista: Meta[]) => (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 desk:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] desk:gap-4.5">
      {lista.map((m) => (
        <CartaoDaMeta
          key={m.id}
          pessoaId={pessoaId}
          meta={m}
          agora={agora}
          detalhe={`${rotaDasMetas(area, pessoaId)}/${m.id}`}
          incentivar={profissional ? () => incentivar(m) : undefined}
          aoGuardar={setRecado}
        />
      ))}
    </div>
  );

  return (
    <>
      {!profissional && <TituloCelular titulo="Metas" subtitulo="Junte dinheiro para o que importa" />}
      <div className="entrar my-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 desk:mt-0">
        <div className="flex flex-col">
          <span className="text-[0.92rem] text-muted">{profissional ? `${persona.apelido} já guardou` : "Você já guardou"}</span>
          <b className="text-[1.5rem] text-good">{reaisCurto(total)}</b>
          <span className="text-[0.92rem] text-muted">
            em {metas.length} {metas.length === 1 ? "meta" : "metas"}
          </span>
        </div>
        {!profissional && (
          <BotaoLink href="/app/metas/nova" tamanho="pequeno">
            <Plus aria-hidden="true" />
            Nova meta
          </BotaoLink>
        )}
      </div>
      <Recado texto={recado} />
      {ativas.length ? (
        grade(ativas)
      ) : (
        <div className="rounded-[18px] border-2 border-dashed border-line p-5 text-center text-muted">
          {profissional ? "Nenhuma meta ativa." : "Nenhuma meta ativa. Que tal criar a primeira?"}
        </div>
      )}
      {concluidas.length > 0 && (
        <>
          <h2 className="mt-5.5 mb-2 text-[1.05rem] font-bold">Concluídas</h2>
          {grade(concluidas)}
        </>
      )}
    </>
  );
}
