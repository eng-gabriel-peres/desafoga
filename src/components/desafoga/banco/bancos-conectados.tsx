"use client";

import { Building2, LoaderCircle, MoreHorizontal, Plus, RefreshCw, Sparkles, TriangleAlert, Unplug } from "lucide-react";
import { useCallback, useState } from "react";
import { quando } from "@/lib/formatar";
import { servicos, type ConexaoBancaria, type DadosDoBanco, type ModoCompras, type ResultadoDaSincronizacao } from "@/services";
import { Opcao, Painel, Sub } from "../ui/blocos";
import { Botao } from "../ui/botao";
import { Janela } from "../ui/janela";
import { JanelaDaPluggy } from "./conectar";

type Estado =
  | { etapa: "parado" }
  | { etapa: "janela"; itemId?: string }
  | { etapa: "lendo" }
  | { etapa: "resumo"; r: ResultadoDaSincronizacao }
  | { etapa: "erro"; mensagem: string };

const MODOS: { modo: ModoCompras; titulo: string; descricao: string }[] = [
  { modo: "revisar", titulo: "Revisar antes", descricao: "Aviso a cada compra; você diz como estava e registra." },
  { modo: "automatico", titulo: "Registrar sozinho", descricao: "Entra direto, com a categoria automática; a emoção você completa quando quiser." },
  { modo: "desligado", titulo: "Não usar compras", descricao: "O banco serve só para dívidas, faturas e próximos meses." },
];

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function resumoDaLeitura(r: ResultadoDaSincronizacao): string {
  if (r.erro) return `Não consegui ler o banco agora (${r.erro}). Tente atualizar daqui a pouco.`;
  const partes = [`${r.contas} ${r.contas === 1 ? "conta" : "contas"}`];
  if (r.paraRevisar) partes.push(`${r.paraRevisar} ${r.paraRevisar === 1 ? "compra desta semana para revisar" : "compras desta semana para revisar"}`);
  if (r.automaticas) partes.push(`${r.automaticas} ${r.automaticas === 1 ? "compra registrada" : "compras registradas"}`);
  if (r.sugestoes) partes.push(`${r.sugestoes} ${r.sugestoes === 1 ? "dívida encontrada" : "dívidas encontradas"}`);
  return `Achei ${partes.join(", ")}.`;
}

/** Bloco "Bancos conectados" de Contas: conectar, atualizar, reconectar, desconectar e o modo das compras. */
export function BancosConectados({ pessoaId, dados, demo, agora, somenteLeitura }: { pessoaId: string; dados: DadosDoBanco; demo: boolean; agora: Date; somenteLeitura?: boolean }) {
  const [estado, setEstado] = useState<Estado>({ etapa: "parado" });
  const [desconectando, setDesconectando] = useState<ConexaoBancaria | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const falhar = useCallback((mensagem: string) => setEstado({ etapa: "erro", mensagem }), []);
  const fechar = useCallback(() => setEstado((e) => (e.etapa === "janela" ? { etapa: "parado" } : e)), []);
  const conectou = useCallback((r: ResultadoDaSincronizacao) => setEstado({ etapa: "resumo", r }), []);
  const lendo = useCallback(() => setEstado({ etapa: "lendo" }), []);

  async function atualizar(c: ConexaoBancaria) {
    setOcupado(c.id);
    try {
      const r = await servicos.banco.atualizar(pessoaId, c.id);
      if (r) setEstado({ etapa: "resumo", r });
    } catch (e) {
      falhar(e instanceof Error ? e.message : "Não consegui atualizar agora.");
    } finally {
      setOcupado(null);
    }
  }

  async function desconectar(c: ConexaoBancaria) {
    setOcupado(c.id);
    try {
      await servicos.banco.desconectar(pessoaId, c.id);
    } finally {
      setOcupado(null);
      setDesconectando(null);
    }
  }

  return (
    <Painel
      titulo="Bancos conectados"
      acao={
        !somenteLeitura &&
        dados.configurado && (
          <Botao variante="secundario" tamanho="pequeno" onClick={() => setEstado({ etapa: "janela" })} disabled={estado.etapa === "janela" || estado.etapa === "lendo"}>
            <Plus aria-hidden="true" />
            Conectar banco
          </Botao>
        )
      }
    >
      {estado.etapa === "janela" && (
        <JanelaDaPluggy
          pessoaId={pessoaId}
          itemId={estado.itemId}
          aoLer={lendo}
          aoConectar={conectou}
          aoFalhar={falhar}
          fechar={fechar}
        />
      )}

      {!dados.configurado && !somenteLeitura && (
        <p className="mb-3 rounded-[14px] bg-surface2 p-3 text-[0.92rem] text-muted">
          Conexão com bancos indisponível neste ambiente. Você ainda pode enviar a fatura, o extrato ou o Registrato em Dívidas.
        </p>
      )}

      <div aria-live="polite">
        {estado.etapa === "janela" && (
          <p className="mb-3 flex items-center gap-2 text-muted">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Abrindo a conexão com o banco…
          </p>
        )}
        {estado.etapa === "lendo" && (
          <p className="mb-3 flex items-center gap-2 text-muted">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Lendo seu banco…
          </p>
        )}
        {estado.etapa === "resumo" && (
          <p className={`mb-3 flex items-start gap-2 rounded-[14px] p-3 text-[0.95rem] ${estado.r.erro ? "bg-bad-soft text-bad" : "bg-good-soft"}`}>
            <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {resumoDaLeitura(estado.r)}
          </p>
        )}
        {estado.etapa === "erro" && (
          <p role="alert" className="mb-3 flex items-start gap-2 rounded-[14px] bg-bad-soft p-3 text-[0.95rem] text-bad">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {estado.mensagem}
          </p>
        )}
      </div>

      {dados.conexoes.length ? (
        <ul>
          {dados.conexoes.map((c) => (
            <LinhaDoBanco
              key={c.id}
              c={c}
              agora={agora}
              ocupado={ocupado === c.id}
              somenteLeitura={somenteLeitura}
              atualizar={() => atualizar(c)}
              reconectar={() => c.pluggyItemId && setEstado({ etapa: "janela", itemId: c.pluggyItemId })}
              desconectar={() => setDesconectando(c)}
            />
          ))}
        </ul>
      ) : (
        <Sub>
          {somenteLeitura
            ? "Nenhum banco conectado."
            : "Conecte seu banco para ver compras, faturas e empréstimos sem digitar. A senha fica com o banco: o Desafoga nunca vê."}
        </Sub>
      )}

      {!somenteLeitura && (
        <fieldset className="mt-4">
          <legend className="mb-2 font-bold">Compras do banco</legend>
          <div role="radiogroup" aria-label="Compras do banco" className="grid gap-2">
            {MODOS.map((m) => (
              <Opcao key={m.modo} marcada={dados.modo === m.modo} onClick={() => servicos.banco.modo(pessoaId, m.modo)} titulo={m.titulo} descricao={m.descricao} />
            ))}
          </div>
        </fieldset>
      )}

      {demo && !somenteLeitura && <SimularCompra pessoaId={pessoaId} />}

      <Janela aberta={desconectando !== null} fechar={() => setDesconectando(null)} rotulo="Desconectar banco">
        {desconectando && (
          <div className="grid gap-3">
            <h2 className="text-[1.3rem] font-bold">Desconectar {desconectando.banco}?</h2>
            <Sub>
              As compras que você já registrou continuam. As que estavam esperando revisão somem, e as dívidas deste banco passam a ser atualizadas só por você.
            </Sub>
            <div className="flex flex-wrap justify-end gap-2">
              <Botao variante="secundario" onClick={() => setDesconectando(null)}>
                Cancelar
              </Botao>
              <Botao onClick={() => desconectar(desconectando)} disabled={ocupado === desconectando.id}>
                <Unplug aria-hidden="true" />
                Desconectar
              </Botao>
            </div>
          </div>
        )}
      </Janela>
    </Painel>
  );
}

function LinhaDoBanco({
  c,
  agora,
  ocupado,
  somenteLeitura,
  atualizar,
  reconectar,
  desconectar,
}: {
  c: ConexaoBancaria;
  agora: Date;
  ocupado: boolean;
  somenteLeitura?: boolean;
  atualizar: () => void;
  reconectar: () => void;
  desconectar: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const bloqueado = c.proximaAtualizacaoPossivel !== null;
  const situacao =
    c.status === "reconectar"
      ? "precisa reconectar"
      : c.status === "erro"
        ? "não consegui atualizar"
        : c.ultimaSincronizacao
          ? `atualizado ${quando(c.ultimaSincronizacao, agora).toLowerCase()}`
          : c.pluggyItemId
            ? "lendo…"
            : "demonstração";
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line py-3 last:border-0">
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface2">
        {c.logo ? (
          // Logo do banco vem da Pluggy (domínio externo, tamanho fixo): <img> simples basta.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.logo} alt="" className="size-full object-contain" />
        ) : (
          <Building2 className="size-5 text-muted" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{c.banco}</p>
        <p className={`text-[0.85rem] ${c.status === "ok" ? "text-muted" : "text-bad"}`}>
          {situacao}
          {c.contas.length ? ` · ${c.contas.map((x) => x.nome).join(", ")}` : ""}
        </p>
      </div>
      {!somenteLeitura && c.pluggyItemId && (
        <div className="relative flex items-center gap-2">
          {c.status === "reconectar" ? (
            <Botao tamanho="pequeno" onClick={reconectar}>
              Reconectar
            </Botao>
          ) : (
            <Botao variante="secundario" tamanho="pequeno" onClick={atualizar} disabled={ocupado || bloqueado} title={bloqueado ? `O banco deixa atualizar uma vez por hora` : undefined}>
              {ocupado ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
              {bloqueado ? `Próxima às ${hora(c.proximaAtualizacaoPossivel!)}` : "Atualizar"}
            </Botao>
          )}
          <button
            type="button"
            aria-label={`Mais opções de ${c.banco}`}
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
            className="grid size-9 place-items-center rounded-full hover:bg-surface2"
          >
            <MoreHorizontal aria-hidden="true" className="size-5" />
          </button>
          {menu && (
            <div className="surgir absolute top-full right-0 z-10 mt-1 min-w-44 rounded-[14px] border border-line bg-surface p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  desconectar();
                }}
                className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left hover:bg-surface2"
              >
                <Unplug aria-hidden="true" className="size-4" /> Desconectar
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** Demonstração: uma compra nova chega do banco na hora. */
function SimularCompra({ pessoaId }: { pessoaId: string }) {
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="mt-4 rounded-[14px] border-2 border-dashed border-line p-3">
      <p className="mb-2 text-[0.9rem] text-muted">Demonstração: veja o aviso chegando como se fosse uma compra feita agora no cartão.</p>
      <Botao
        variante="secundario"
        tamanho="pequeno"
        disabled={enviando}
        onClick={async () => {
          setEnviando(true);
          try {
            await servicos.banco.simularCompra(pessoaId);
          } finally {
            setEnviando(false);
          }
        }}
      >
        <Sparkles aria-hidden="true" />
        Simular compra do banco
      </Botao>
    </div>
  );
}
