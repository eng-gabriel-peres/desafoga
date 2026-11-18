"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { usePessoa } from "@/hooks/use-pessoa";
import { chaveDoDia, comprasParaAvaliar, opinioesDiferentes, type Compra, type FiltroDaAvaliacao } from "@/lib/finance";
import { hora, nomeDoDia, reais } from "@/lib/formatar";
import { NOME_DA_EMOCAO } from "@/lib/assistente/textos";
import { servicos } from "@/services";
import { ICONE_DA_CATEGORIA } from "../categorias";
import { Carregando, Chip, EtiquetaNecessidade, Sub, Vazio } from "../ui/blocos";
import { Carinha } from "../ui/carinha";

/** "Era necessária?" na opinião do profissional: tocar de novo desfaz. */
function Avaliar({ pessoaId, compra, compacto }: { pessoaId: string; compra: Compra; compacto?: boolean }) {
  const [salvando, setSalvando] = useState(false);
  const opcoes = [
    ["sim", Check, "Necessária", "Sim", "aria-pressed:border-good aria-pressed:bg-good-soft aria-pressed:text-good"],
    ["nao", X, "Não necessária", "Não", "aria-pressed:border-bad aria-pressed:bg-bad-soft aria-pressed:text-bad"],
  ] as const;
  return (
    <div role="group" aria-label={`Sua avaliação de ${compra.item}`} className={`flex gap-1.5 ${compacto ? "" : "flex-wrap"}`}>
      {opcoes.map(([v, Icone, rotulo, curto, cor]) => (
        <button
          key={v}
          type="button"
          aria-pressed={compra.avaliacaoProfissional === v}
          disabled={salvando}
          onClick={async () => {
            setSalvando(true);
            await servicos.compras.avaliar(pessoaId, compra.id, compra.avaliacaoProfissional === v ? null : v).finally(() => setSalvando(false));
          }}
          className={`inline-flex min-h-10 items-center gap-1 rounded-full border-2 border-line bg-surface px-3 text-[0.88rem] font-bold whitespace-nowrap ${cor} [&_svg]:size-4`}
        >
          <Icone aria-hidden="true" />
          {compacto ? (
            <>
              <span aria-hidden="true">{curto}</span>
              <span className="sr-only">{rotulo}</span>
            </>
          ) : (
            rotulo
          )}
        </button>
      ))}
    </div>
  );
}

function Diferenca({ compra, apelido }: { compra: Compra; apelido: string }) {
  if (!opinioesDiferentes(compra)) return null;
  return (
    <p className="mt-1.5 text-[0.88rem] font-bold text-maybe">
      {compra.necessidade === null || compra.necessidade === "talvez"
        ? `${apelido} não soube responder. Vale conversar sobre esta.`
        : "Vocês pensam diferente sobre esta compra. Bom assunto para a próxima conversa."}
    </p>
  );
}

/** Painel: o profissional diz se cada compra dos últimos 14 dias era necessária. A pessoa vê só a própria resposta. */
export function TelaComprasDoPaciente({ pessoaId }: { pessoaId: string }) {
  const dados = usePessoa(pessoaId);
  const agora = useAgora();
  const [filtro, setFiltro] = useState<FiltroDaAvaliacao>("todas");
  if (!dados || !agora) return <Carregando />;
  const apelido = dados.persona.apelido;
  const { lista, contagem } = comprasParaAvaliar(dados.compras, agora, filtro);
  const filtros: [FiltroDaAvaliacao, string][] = [
    ["todas", "Todas"],
    ["pendentes", "Para avaliar"],
    ["diferentes", "Opiniões diferentes"],
  ];
  const quando = (c: Compra) => `${nomeDoDia(chaveDoDia(new Date(c.quando)), agora)}${c.via === "banco" ? "" : `, ${hora(c.quando)}`}`;
  // Na tabela: "Hoje", "Ontem" ou "seg., 16/11".
  const dia = (c: Compra) => {
    const d = new Date(c.quando);
    const nome = nomeDoDia(chaveDoDia(d), agora);
    return nome === "Hoje" || nome === "Ontem" ? nome : d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  };
  const disse = (c: Compra) => (c.necessidade ? <EtiquetaNecessidade necessidade={c.necessidade} /> : <span className="text-muted">Não respondeu</span>);
  const carinha = (c: Compra) =>
    c.emocao === null ? <span className="text-muted">Sem emoção</span> : <span className="inline-flex items-center gap-1.5"><Carinha emocao={c.emocao} tamanho="sm" rotulo={false} />{NOME_DA_EMOCAO[c.emocao]}</span>;

  return (
    <>
      <Sub className="mb-3.5">Diga se, na sua opinião, cada compra dos últimos 14 dias era necessária. {apelido} vê só a própria resposta.</Sub>
      <div className="mb-4 flex flex-wrap gap-2">
        {filtros.map(([f, rotulo]) => (
          <Chip key={f} marcado={filtro === f} onClick={() => setFiltro(f)}>
            {rotulo} ({contagem[f]})
          </Chip>
        ))}
      </div>
      {!lista.length ? (
        <Vazio>Nada por aqui com esse filtro.</Vazio>
      ) : (
        <>
          {/* Desktop: tabela, como no protótipo. */}
          <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface desk:block">
            <table className="w-full text-left">
              <thead className="border-b border-line text-[0.85rem] text-muted">
                <tr>
                  {["Quando", "Compra", "Valor", "Como estava", `${apelido} disse`, "Era necessária? (você)", "Canal"].map((t) => (
                    <th key={t} scope="col" className={`px-3.5 py-2.5 font-bold ${t === "Valor" ? "text-right" : ""}`}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const Icone = ICONE_DA_CATEGORIA[c.categoria];
                  return (
                    <tr key={c.id} className="border-b border-line align-top last:border-0">
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <b>{dia(c)}</b>
                        {c.via !== "banco" && <span className="block text-[0.85rem] text-muted">{hora(c.quando)}</span>}
                      </td>
                      <td className="px-3.5 py-3">
                        <b>{c.item}</b>
                        <span className="flex items-center gap-1 text-[0.85rem] text-muted">
                          <Icone aria-hidden="true" className="size-3.5" /> {c.categoria}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right font-bold whitespace-nowrap">{reais(c.valor)}</td>
                      <td className="px-3.5 py-3">{carinha(c)}</td>
                      <td className="px-3.5 py-3">{disse(c)}</td>
                      <td className="px-3.5 py-3">
                        <Avaliar pessoaId={pessoaId} compra={c} compacto />
                        <Diferenca compra={c} apelido={apelido} />
                      </td>
                      <td className="px-3.5 py-3 text-[0.9rem] text-muted">{c.via === "whatsapp" ? "WhatsApp" : c.via === "banco" ? "Banco" : c.via === "fatura" ? "Fatura" : "App"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Celular: cartões. */}
          <ul className="grid gap-3 desk:hidden">
            {lista.map((c) => (
              <li key={c.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
                <div className="flex items-start gap-3">
                  {c.emocao !== null ? <Carinha emocao={c.emocao} /> : <span className="size-12" />}
                  <div className="min-w-0 flex-1">
                    <b className="block">{c.item}</b>
                    <span className="text-[0.85rem] text-muted">
                      {quando(c)} · {c.categoria}
                    </span>
                  </div>
                  <b>{reais(c.valor)}</b>
                </div>
                <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[0.9rem]">
                  {apelido} disse: {disse(c)}
                </p>
                <div className="mt-2.5">
                  <Avaliar pessoaId={pessoaId} compra={c} />
                </div>
                <Diferenca compra={c} apelido={apelido} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
