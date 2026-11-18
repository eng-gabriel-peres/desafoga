"use client";

import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { usePessoa } from "@/hooks/use-pessoa";
import { mensagemDoLembreteDiario } from "@/lib/assistente/textos";
import { chaveDoDia, comprasDoDia, notaMedia, type ConfigDosAvisos } from "@/lib/finance";
import { servicos } from "@/services";
import { Carregando, Painel, Sub } from "../ui/blocos";
import { CAMPO, CampoReais } from "../ui/campos";
import { Interruptor, Linha } from "./rotina";

const HORARIOS = ["08:00", "12:00", "18:00", "20:00", "21:00", "22:00"];

/** "Avisos no WhatsApp" (como no protótipo): o que a Luana manda para a pessoa e para quem acompanha. */
export function TelaAvisosDoPaciente({ pessoaId }: { pessoaId: string }) {
  const dados = usePessoa(pessoaId);
  const config = useConsulta(`avisos-config:${pessoaId}`, () => servicos.configDosAvisos.ver(pessoaId));
  const agora = useAgora();
  const [valor, setValor] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  if (!dados || !config || !agora) return <Carregando />;
  const apelido = dados.persona.apelido;
  const salvar = (m: Partial<ConfigDosAvisos>) => {
    setErro("");
    servicos.configDosAvisos.salvar(pessoaId, m).catch((e: unknown) => setErro(e instanceof Error ? e.message : "Não deu para salvar."));
  };
  const deHoje = comprasDoDia(dados.compras, chaveDoDia(agora));
  const previa = mensagemDoLembreteDiario(config.horaDoLembrete, deHoje, notaMedia(deHoje));
  const valorNaTela = valor ?? (config.valorDaCompraAlta / 100).toFixed(2).replace(".", ",");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-2 desk:gap-5">
      <Painel>
        <Linha
          titulo={`Lembrete diário para ${apelido}`}
          descricao="Pergunta se comprou algo e mostra a nota do dia."
          extra={
            <label className="mt-2 flex items-center gap-2">
              <span className="text-[0.9rem] text-muted">Horário</span>
              <select value={config.horaDoLembrete} onChange={(e) => salvar({ horaDoLembrete: e.target.value })} aria-label="Horário do lembrete" className={`${CAMPO} min-h-10 w-auto`}>
                {[...new Set([...HORARIOS, config.horaDoLembrete])].sort().map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </label>
          }
        >
          <Interruptor ligado={config.lembreteDiario} mudar={(v) => salvar({ lembreteDiario: v })} rotulo="Lembrete diário" />
        </Linha>
        <Linha
          titulo="Me avisar de compra alta"
          descricao="Quando registrar uma compra a partir deste valor."
          extra={
            <CampoReais
              rotulo="Valor da compra alta"
              className="mt-2 block max-w-[220px] [&>span:first-child]:sr-only"
              value={valorNaTela}
              onChange={(e) => setValor(e.target.value)}
              onBlur={() => {
                const centavos = Math.round(Number(valorNaTela.replace(/\./g, "").replace(",", ".")) * 100);
                if (!(centavos >= 100)) return setErro("Coloque um valor de pelo menos R$ 1,00.");
                setValor(null);
                salvar({ valorDaCompraAlta: centavos });
              }}
            />
          }
        >
          <Interruptor ligado={config.compraAlta} mudar={(v) => salvar({ compraAlta: v })} rotulo="Aviso de compra alta" />
        </Linha>
        <Linha titulo="Me avisar de dia difícil" descricao="Quando a nota do dia ficar em 2 ou menos.">
          <Interruptor ligado={config.diaDificil} mudar={(v) => salvar({ diaDificil: v })} rotulo="Aviso de dia difícil" />
        </Linha>
        <Linha titulo="Resumo da semana" descricao={`Todo domingo, para ${apelido} e para você.`}>
          <Interruptor ligado={config.resumoDaSemana} mudar={(v) => salvar({ resumoDaSemana: v })} rotulo="Resumo da semana" />
        </Linha>
        {erro && (
          <p role="alert" className="mt-2 font-bold text-bad">
            {erro}
          </p>
        )}
      </Painel>
      <Painel titulo={`Como ${apelido} recebe o lembrete`}>
        <div className="rounded-2xl bg-surface2 p-3">
          <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface px-3.5 py-2.5 whitespace-pre-line shadow-sm">{previa}</p>
        </div>
        <Sub className="mt-2.5">
          A mensagem muda conforme as compras do dia. Ela fica no chat do app e vai pelo WhatsApp quando {apelido} conectou o número (fora das 24 horas depois da última mensagem, o
          WhatsApp só aceita modelos aprovados).
        </Sub>
      </Painel>
    </div>
  );
}
