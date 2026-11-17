"use client";

import { ArrowLeftRight, CreditCard, EyeOff, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { reais } from "@/lib/formatar";
import { servicos, type CompraParcelada, type DadosDoBanco, type Movimento } from "@/services";
import { ICONE_DA_CATEGORIA } from "../categorias";
import { useAbrirRegistro, type PreviaDoRegistro } from "../registro";
import { Painel, Sub } from "../ui/blocos";
import { Botao } from "../ui/botao";
import { Janela } from "../ui/janela";

const VISIVEIS = 5;

/** "Hoje", "Ontem" ou "12/11": o banco informa só o dia. */
function diaLegivel(dia: string, agora: Date): string {
  const hoje = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const ontem = new Date(agora.getTime() - 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (dia === hoje) return "Hoje";
  if (dia === ontem) return "Ontem";
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/** "IFOOD *RESTAURANTE" → "Ifood *restaurante": legível sem inventar nome. */
export function nomeDaLoja(descricao: string): string {
  const t = descricao.replace(/\s*\b(PARC(ELA)?\.?\s*)?\d{1,3}\s*\/\s*\d{1,3}\b/gi, "").trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

interface ParaRevisar {
  movimento: Movimento;
  parcelada: CompraParcelada | undefined;
}

/** Uma linha por compra: as parcelas da mesma compra parcelada aparecem uma vez só. */
export function comprasParaRevisar(banco: DadosDoBanco): ParaRevisar[] {
  const porId = new Map(banco.parceladas.map((p) => [p.id, p]));
  const vistas = new Set<string>();
  const lista: ParaRevisar[] = [];
  for (const m of banco.movimentos.filter((x) => x.situacao === "revisar").sort((a, b) => b.data.localeCompare(a.data))) {
    if (m.parceladaId) {
      if (vistas.has(m.parceladaId)) continue;
      vistas.add(m.parceladaId);
    }
    lista.push({ movimento: m, parcelada: m.parceladaId ? porId.get(m.parceladaId) : undefined });
  }
  return lista;
}

export function previaDe({ movimento: m, parcelada }: ParaRevisar): PreviaDoRegistro {
  return parcelada
    ? { tipo: "banco", movimentoId: m.id, item: parcelada.nome === parcelada.lojaOriginal ? nomeDaLoja(parcelada.nome) : parcelada.nome, valor: parcelada.valorTotal, categoria: parcelada.categoria, parcelas: parcelada.totalParcelas }
    : { tipo: "banco", movimentoId: m.id, item: nomeDaLoja(m.descricao), valor: m.valor, categoria: m.categoria ?? "Outro", parcelas: null };
}

/** Cartão de Hoje: compras do banco esperando a pessoa dizer como estava. */
export function ComprasParaRevisar({ pessoaId, banco, agora }: { pessoaId: string; banco: DadosDoBanco; agora: Date }) {
  const [todas, setTodas] = useState(false);
  const lista = comprasParaRevisar(banco);
  if (!lista.length) return null;
  const titulo = `${lista.length} ${lista.length === 1 ? "compra para revisar" : "compras para revisar"}`;
  return (
    <Painel
      titulo={titulo}
      acao={
        lista.length > VISIVEIS && (
          <Botao variante="link" onClick={() => setTodas(true)}>
            Ver todas
          </Botao>
        )
      }
    >
      <Sub className="mb-1">Vieram do seu banco. Diga como você estava em cada uma.</Sub>
      <ListaParaRevisar pessoaId={pessoaId} itens={lista.slice(0, VISIVEIS)} agora={agora} />
      <Janela aberta={todas} fechar={() => setTodas(false)} rotulo={titulo} larga>
        <h2 className="mb-2 text-[1.3rem] font-bold">{titulo}</h2>
        <ListaParaRevisar pessoaId={pessoaId} itens={lista} agora={agora} />
      </Janela>
    </Painel>
  );
}

function ListaParaRevisar({ pessoaId, itens, agora }: { pessoaId: string; itens: ParaRevisar[]; agora: Date }) {
  return (
    <ul>
      {itens.map((x) => (
        <LinhaParaRevisar key={x.movimento.id} pessoaId={pessoaId} item={x} agora={agora} />
      ))}
    </ul>
  );
}

function LinhaParaRevisar({ pessoaId, item, agora }: { pessoaId: string; item: ParaRevisar; agora: Date }) {
  const abrirRegistro = useAbrirRegistro();
  const [menu, setMenu] = useState(false);
  const previa = previaDe(item);
  const Icone = ICONE_DA_CATEGORIA[previa.categoria] ?? CreditCard;
  const parcelas = previa.tipo === "banco" && previa.parcelas ? ` · ${previa.parcelas}x` : "";
  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface2 text-muted">
        <Icone className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{previa.item}</p>
        <p className="text-[0.85rem] text-muted">
          {reais(previa.valor)}
          {parcelas} · {diaLegivel(item.movimento.data, agora)}
        </p>
      </div>
      <Botao tamanho="pequeno" onClick={() => abrirRegistro(previa)}>
        Registrar
      </Botao>
      <div className="relative">
        <button
          type="button"
          aria-label={`Mais opções de ${previa.item}`}
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          className="grid size-9 place-items-center rounded-full hover:bg-surface2"
        >
          <MoreHorizontal aria-hidden="true" className="size-5" />
        </button>
        {menu && (
          <div className="surgir absolute top-full right-0 z-10 mt-1 min-w-56 rounded-[14px] border border-line bg-surface p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                servicos.banco.ignorar(pessoaId, item.movimento.id);
              }}
              className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left hover:bg-surface2"
            >
              <EyeOff aria-hidden="true" className="size-4" /> Ignorar
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                servicos.banco.marcarTransferencia(pessoaId, item.movimento.id);
              }}
              className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left hover:bg-surface2"
            >
              <ArrowLeftRight aria-hidden="true" className="size-4" /> É transferência minha
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
