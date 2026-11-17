"use client";

import { Bell, ChevronLeft, Heart, PartyPopper, PencilLine, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { usePessoa } from "@/hooks/use-pessoa";
import { chaveDoDia, situacaoDaMeta } from "@/lib/finance";
import { NOME_DA_FREQUENCIA, dataCurta, reaisCurto } from "@/lib/assistente/textos";
import { nomeDoDia } from "@/lib/formatar";
import { servicos, type InvestimentoDoBanco } from "@/services";
import { CaixaDeDeposito } from "../metas/deposito";
import { Anel, IconeDaMetaBadge, corDaMeta } from "../metas/visual";
import type { Area } from "../moldura/navegacao";
import { usePessoaDaSessao } from "../sessao";
import { Carregando, Painel, Sub } from "../ui/blocos";
import { Botao, BotaoIcone, BotaoLink } from "../ui/botao";
import { Janela } from "../ui/janela";
import { TelaFormularioDaMeta } from "./formulario-da-meta";
import { Recado, rotaDasMetas } from "./metas";

const LEMBRETE = { dia: "todo dia", semana: "uma vez por semana", mes: "uma vez por mês" } as const;

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-surface2 p-2.5 text-left">
      <span className="text-[0.85rem] text-muted">{rotulo}</span>
      <b className="text-[1.1rem]">{valor}</b>
      {detalhe && <span className="text-[0.85rem] text-muted">{detalhe}</span>}
    </div>
  );
}

/** Detalhe da meta: anel grande, ritmo, plano, histórico e lembretes. */
export function TelaDaMeta({ metaId, area = "pessoa", pessoaId: doPainel }: { metaId: string; area?: Area; pessoaId?: string }) {
  const minha = usePessoaDaSessao();
  const pessoaId = doPainel ?? minha ?? "";
  const dados = usePessoa(pessoaId);
  const agora = useAgora();
  const [guardando, setGuardando] = useState(false);
  const [animar, setAnimar] = useState(false);
  const [recado, setRecado] = useState("");
  const [ajustando, setAjustando] = useState(false);
  if (!dados || !agora) return <Carregando />;

  const voltar = (
    <BotaoLink href={rotaDasMetas(area, pessoaId)} variante="link">
      <ChevronLeft aria-hidden="true" />
      Voltar às metas
    </BotaoLink>
  );
  const meta = dados.metas.find((m) => m.id === metaId);
  if (!meta) {
    return (
      <>
        {voltar}
        <Sub className="mt-3">Essa meta não existe mais.</Sub>
      </>
    );
  }

  const profissional = area === "responsavel";
  const s = situacaoDaMeta(meta, agora);
  const cor = corDaMeta(meta.cor, s.concluida);
  const recadoDoRitmo = s.concluida
    ? `Meta completa! ${profissional ? `${dados.persona.apelido} juntou` : "Você juntou"} ${reaisCurto(s.guardado)}.`
    : s.ritmo === "adiantada"
      ? "Você está à frente do plano. Ótimo ritmo!"
      : s.ritmo === "em-dia"
        ? "Você está em dia com o plano."
        : `Faltam ${reaisCurto(s.atrasado)} para ficar em dia. Tudo bem, dá para recuperar aos poucos.`;
  const depositos = [...meta.depositos].sort((a, b) => b.quando.localeCompare(a.quando));

  async function incentivar() {
    const r = await servicos.metas.incentivar(pessoaId, metaId);
    setRecado(`Incentivo enviado para ${dados!.persona.apelido} ${r.whatsapp ? "no WhatsApp e no app" : "no app"}.`);
  }

  async function lembrar() {
    const r = await servicos.metas.lembrar(pessoaId, metaId);
    setRecado(r.whatsapp ? "Lembrete enviado no seu WhatsApp." : "Lembrete enviado. Veja na aba Assistente.");
  }

  return (
    <>
      {voltar}
      <Recado texto={recado} />
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)] items-start gap-4 desk:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] desk:gap-5">
        <section
          className={`entrar rounded-[var(--radius-card)] border bg-surface p-[1.1rem] text-center ${s.concluida ? "border-[color-mix(in_srgb,var(--good)_45%,var(--line))]" : "border-line"}`}
        >
          <header className="flex items-center gap-2.5 text-left">
            <IconeDaMetaBadge icone={meta.icone} cor={cor} />
            <h2 className="text-[1.08rem] font-bold">{meta.nome}</h2>
          </header>
          <div className="mt-4.5 mb-3 flex justify-center">
            <Anel
              fracao={s.fracao}
              cor={cor}
              tamanho={220}
              espessura={24}
              animar={animar}
              centro={
                <>
                  <b className="text-[1.9rem]">{reaisCurto(meta.alvo)}</b>
                  <span className="mt-0.5 text-[0.75rem] text-muted">{Math.floor(s.fracao * 100)}% guardado</span>
                </>
              }
            />
          </div>
          <p className={`mb-3.5 flex items-center justify-center gap-1.5 font-bold ${s.concluida ? "text-good" : ""}`}>
            {s.concluida && <PartyPopper aria-hidden="true" className="size-5" />}
            {recadoDoRitmo}
          </p>
          <div className="my-4 grid grid-cols-2 gap-2 desk:grid-cols-4">
            <Numero rotulo="Guardado" valor={reaisCurto(s.guardado)} detalhe={meta.guardadoPeloBanco != null ? "pelo banco" : undefined} />
            <Numero rotulo="Faltam" valor={reaisCurto(s.falta)} />
            <Numero rotulo="Plano" valor={reaisCurto(meta.valorPorPeriodo)} detalhe={NOME_DA_FREQUENCIA[meta.frequencia].por} />
            <Numero
              rotulo={s.concluida ? "Concluída" : "Previsão"}
              valor={s.concluida ? "Sim" : s.previsao ? dataCurta(s.previsao.data) : "–"}
              detalhe={meta.prazo ? `prazo ${dataCurta(meta.prazo)}` : undefined}
            />
          </div>
          {profissional ? (
            <Botao bloco onClick={incentivar}>
              <Heart aria-hidden="true" />
              Mandar incentivo
            </Botao>
          ) : s.concluida ? null : guardando ? (
            <div className="text-left">
              <CaixaDeDeposito
                pessoaId={pessoaId}
                meta={meta}
                fechar={() => setGuardando(false)}
                aoGuardar={(m) => {
                  setAnimar(true);
                  setRecado(m);
                }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Botao onClick={() => setGuardando(true)}>
                <Plus aria-hidden="true" />
                Guardar dinheiro
              </Botao>
              <Botao variante="secundario" onClick={() => setAjustando(true)}>
                <PencilLine aria-hidden="true" />
                Ajustar
              </Botao>
              <Janela aberta={ajustando} fechar={() => setAjustando(false)} rotulo="Ajustar meta" larga>
                {ajustando && <TelaFormularioDaMeta metaId={meta.id} fechar={() => setAjustando(false)} />}
              </Janela>
            </div>
          )}
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <Painel titulo="Histórico" acao={<Sub>{`${depositos.length} ${depositos.length === 1 ? "depósito" : "depósitos"}`}</Sub>}>
            {depositos.length ? (
              <ul>
                {depositos.map((d) => (
                  <li key={d.id} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-0">
                    <span aria-hidden="true" className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-good-soft text-good">
                      <PiggyBank className="size-4" />
                    </span>
                    <span className="flex-1">
                      {nomeDoDia(chaveDoDia(new Date(d.quando)), agora)}
                      {d.via === "whatsapp" && <span className="text-[0.85rem] text-muted"> · pelo WhatsApp</span>}
                    </span>
                    <b className="text-good">+ {reaisCurto(d.valor)}</b>
                    {!profissional && (
                      <BotaoIcone leve aria-label={`Apagar depósito de ${reaisCurto(d.valor)}`} onClick={() => servicos.metas.apagarDeposito(pessoaId, meta.id, d.id)}>
                        <Trash2 aria-hidden="true" />
                      </BotaoIcone>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Sub>Nenhum depósito ainda.</Sub>
            )}
          </Painel>
          {!profissional && dados.banco.investimentos.length > 0 && (
            <LigarAoBanco pessoaId={pessoaId} metaId={meta.id} ligados={meta.investimentos ?? []} investimentos={dados.banco.investimentos} />
          )}
          {!profissional && (
            <Painel titulo="Lembretes">
              <Sub>
                {meta.lembrete
                  ? `Lembrete ligado: ${LEMBRETE[meta.frequencia]}. O envio automático no WhatsApp ainda não está pronto; por enquanto, peça abaixo.`
                  : "Lembretes desligados para esta meta."}
              </Sub>
              <Botao variante="secundario" tamanho="pequeno" className="mt-2.5" onClick={lembrar}>
                <Bell aria-hidden="true" />
                Receber um lembrete agora
              </Botao>
            </Painel>
          )}
        </div>
      </div>
    </>
  );
}

/** Meta ligada a investimentos do banco: o guardado passa a ser o saldo deles. */
function LigarAoBanco({ pessoaId, metaId, ligados, investimentos }: { pessoaId: string; metaId: string; ligados: string[]; investimentos: InvestimentoDoBanco[] }) {
  const marcar = (id: string) => {
    const novos = ligados.includes(id) ? ligados.filter((x) => x !== id) : [...ligados, id];
    servicos.banco.ligarInvestimentos(pessoaId, metaId, novos);
  };
  return (
    <Painel titulo="Ligar ao banco">
      <Sub className="mb-2">
        {ligados.length
          ? "O valor guardado acompanha o saldo do banco sozinho. Depósitos registrados aqui ficam só no histórico."
          : "Marque onde esse dinheiro está guardado. O valor da meta passa a acompanhar o saldo do banco sozinho."}
      </Sub>
      <ul className="grid gap-1.5">
        {investimentos.map((i) => (
          <li key={i.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-[12px] border border-line px-3 py-2 hover:border-primary">
              <input type="checkbox" checked={ligados.includes(i.id)} onChange={() => marcar(i.id)} className="size-4 accent-[var(--primary)]" />
              <span className="min-w-0 flex-1 truncate">{i.nome}</span>
              <b>{reaisCurto(i.saldo)}</b>
            </label>
          </li>
        ))}
      </ul>
    </Painel>
  );
}
