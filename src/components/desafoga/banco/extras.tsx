"use client";

import { CalendarCheck, Clock, Receipt, Repeat, Wallet } from "lucide-react";
import { useState } from "react";
import { assinaturasDetectadas, melhorDiaDeCompra, tarifasDoMes, usoDoLimite, jurosDeBoletoDoMes } from "@/lib/banco/extras";
import { chaveDaDescricao } from "@/lib/banco/classificar";
import { reais } from "@/lib/formatar";
import { servicos, type ContaBancaria, type ContaFixa, type DadosDoBanco } from "@/services";
import { Painel, Sub } from "../ui/blocos";
import { Botao } from "../ui/botao";

const mesDe = (agora: Date) => agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);

/** Limite usado e melhor dia de compra de um cartão conectado. */
export function DetalhesDoCartao({ conta }: { conta: ContaBancaria }) {
  const uso = usoDoLimite(conta);
  const dia = melhorDiaDeCompra(conta);
  if (!uso && !dia) return null;
  const alto = uso && uso.fracao >= 0.8;
  return (
    <div className="mt-1.5 grid gap-1 text-[0.82rem]">
      {uso && (
        <div>
          <div className="flex justify-between">
            <span className="text-muted">{conta.nome}: limite usado</span>
            <b className={alto ? "text-bad" : ""}>{Math.round(uso.fracao * 100)}%</b>
          </div>
          <div aria-hidden="true" className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface2">
            <div className={`h-full rounded-full ${alto ? "bg-bad" : "bg-primary"}`} style={{ width: `${Math.min(100, Math.round(uso.fracao * 100))}%` }} />
          </div>
          <span className="text-muted">
            {reais(uso.usado)} de {reais(uso.limite)}
          </span>
        </div>
      )}
      {dia && (
        <p className="flex items-center gap-1.5 text-muted">
          <CalendarCheck aria-hidden="true" className="size-3.5" /> Melhor dia de compra: dia {dia} (a compra só vence na fatura seguinte)
        </p>
      )}
    </div>
  );
}

/** Quantos dias faltam para a autorização do Open Finance vencer; null se não vence logo. */
export function diasParaVencer(consentimentoAte: string | null, agora: Date): number | null {
  if (!consentimentoAte) return null;
  const dias = Math.ceil((Date.parse(consentimentoAte) - agora.getTime()) / 86_400_000);
  return dias <= 15 ? dias : null;
}

/** "Sua renda parece ser…": o salário percebido no banco, para a pessoa confirmar. */
export function SugestaoDeRenda({ pessoaId, banco }: { pessoaId: string; banco: DadosDoBanco }) {
  const s = banco.sugestoes.find((x) => x.tipo === "renda");
  const [ocupado, setOcupado] = useState(false);
  if (!s) return null;
  const { valor, dia } = s.dados as unknown as { valor: number; dia: number };
  return (
    <Painel titulo="Sua renda">
      <p className="flex items-center gap-2">
        <Wallet aria-hidden="true" className="size-5 text-primary" />
        <span>
          Pelo banco, sua renda parece ser <b>{reais(valor)}</b> no dia <b>{dia}</b>.
        </span>
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Botao
          tamanho="pequeno"
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true);
            await servicos.banco.aceitarRenda(pessoaId).finally(() => setOcupado(false));
          }}
        >
          Usar essa renda
        </Botao>
        <Botao tamanho="pequeno" variante="secundario" disabled={ocupado} onClick={() => servicos.banco.dispensarSugestao(pessoaId, s.chave)}>
          Agora não
        </Botao>
      </div>
    </Painel>
  );
}

/** Assinaturas percebidas (a mesma loja todo mês): total e "virar conta fixa". */
export function Assinaturas({ pessoaId, banco, contas, somenteLeitura }: { pessoaId: string; banco: DadosDoBanco; contas: ContaFixa[]; somenteLeitura?: boolean }) {
  const jaFixas = new Set(contas.map((c) => chaveDaDescricao(c.nome)));
  const lista = assinaturasDetectadas(banco.movimentos);
  if (!lista.length) return null;
  const total = lista.reduce((s, a) => s + a.valor, 0);
  return (
    <Painel titulo="Assinaturas">
      <Sub className="mb-1">
        Você paga <b>{reais(total)}</b> por mês em cobranças que se repetem. Vale olhar se ainda usa todas.
      </Sub>
      <ul>
        {lista.map((a) => {
          const fixa = jaFixas.has(chaveDaDescricao(a.nome));
          return (
            <li key={a.nome} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-0">
              <Repeat aria-hidden="true" className="size-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <b className="block truncate">{a.nome}</b>
                <span className="text-[0.82rem] text-muted">há {a.meses} meses seguidos</span>
              </span>
              <b>{reais(a.valor)}</b>
              {!somenteLeitura &&
                (fixa ? (
                  <span className="text-[0.82rem] text-muted">já é conta fixa</span>
                ) : (
                  <Botao
                    tamanho="pequeno"
                    variante="secundario"
                    onClick={() =>
                      servicos.contas.salvar(pessoaId, {
                        nome: a.nome,
                        categoria: "assinatura",
                        valor: a.valor,
                        vencimento: Number(a.ultimaData.slice(8, 10)),
                        variavel: false,
                        debitoAutomatico: true,
                        lembrete: false,
                      })
                    }
                  >
                    Virar conta fixa
                  </Botao>
                ))}
            </li>
          );
        })}
      </ul>
    </Painel>
  );
}

/** Tarifas do banco no mês e juros/multa de boletos pagos atrasados. */
export function CustoDoBanco({ banco, agora }: { banco: DadosDoBanco; agora: Date }) {
  const mes = mesDe(agora);
  const tarifas = tarifasDoMes(banco.movimentos, mes);
  const atraso = jurosDeBoletoDoMes(banco.movimentos, mes);
  if (!tarifas.total && !atraso) return null;
  return (
    <Painel titulo="Tarifas e atrasos do mês">
      <ul className="grid gap-1.5">
        {tarifas.itens.map((t, i) => (
          <li key={i} className="flex items-center gap-2">
            <Receipt aria-hidden="true" className="size-4 text-muted" />
            <span className="flex-1">{t.nome}</span>
            <b>{reais(t.valor)}</b>
          </li>
        ))}
        {atraso > 0 && (
          <li className="flex items-center gap-2">
            <Clock aria-hidden="true" className="size-4 text-bad" />
            <span className="flex-1">Juros e multa de boletos pagos atrasados</span>
            <b className="text-bad">{reais(atraso)}</b>
          </li>
        )}
      </ul>
      {tarifas.total > 0 && (
        <Sub className="mt-2">Todo banco é obrigado a oferecer uma conta com serviços essenciais sem tarifa. Dá para pedir a troca no app ou na agência.</Sub>
      )}
    </Painel>
  );
}
