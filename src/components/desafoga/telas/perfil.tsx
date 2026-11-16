"use client";

import { Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConsulta } from "@/hooks/use-consulta";
import { telefoneLegivel } from "@/lib/desafoga/telefone";
import { servicos } from "@/services";
import { BotaoWhatsapp } from "../chat/conectar-whatsapp";
import { useEu } from "../sessao";
import { Avatar, Painel, Sub, TituloCelular } from "../ui/blocos";
import { Botao } from "../ui/botao";

const CAMPO = "min-h-12 w-full rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 outline-none campo focus:border-primary";

/** Perfil da pessoa: WhatsApp, quem acompanha e os próprios dados (LGPD). */
export function TelaPerfil() {
  const eu = useEu();
  const pessoa = eu.pessoa;
  const telefone = useConsulta(`whatsapp:${pessoa?.id}`, () => (pessoa ? servicos.pessoas.whatsapp(pessoa.id) : Promise.resolve(null)));
  if (!pessoa) return null;

  return (
    <div className="mx-auto grid max-w-[720px] gap-4">
      <TituloCelular titulo="Perfil" />
      <Painel>
        <div className="flex items-center gap-3">
          <Avatar nome={pessoa.nome} cor={pessoa.cor} tamanho="lg" />
          <div>
            <b className="block text-[1.15rem]">{pessoa.nome}</b>
            <span className="text-muted">
              {pessoa.apelido}
              {pessoa.idade ? `, ${pessoa.idade} anos` : ""}
              {eu.demo ? " · demonstração" : ""}
            </span>
          </div>
        </div>
      </Painel>

      <Painel titulo="WhatsApp">
        <Sub className="mb-3">
          {telefone
            ? `Conectado: ${telefoneLegivel(telefone)}. Compras, faturas e áudios mandados para a Luana por esse número entram aqui.`
            : "Converse com a Luana pelo WhatsApp: o que você mandar por lá entra aqui no app."}
        </Sub>
        <BotaoWhatsapp pessoaId={pessoa.id} />
      </Painel>

      <Acompanhamento />
      {!eu.demo && <MeusDados />}
    </div>
  );
}

function Acompanhamento() {
  const eu = useEu();
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function aceitar(e: React.FormEvent) {
    e.preventDefault();
    setEstado(null);
    try {
      const p = await servicos.sessao.aceitarConvite(codigo);
      setEstado({ tipo: "ok", texto: `Pronto: ${p.nome} (${p.papel}) agora acompanha você.` });
      setCodigo("");
    } catch (falha) {
      setEstado({ tipo: "erro", texto: falha instanceof Error ? falha.message : "Não consegui aceitar o convite." });
    }
  }

  return (
    <Painel titulo="Quem me acompanha">
      {eu.acompanhantes.length ? (
        <ul className="mb-3">
          {eu.acompanhantes.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
              <Avatar nome={p.nome} cor={p.cor} tamanho="sm" />
              <span>
                <b>{p.nome}</b> <span className="text-muted">· {p.papel}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Sub className="mb-3">Ninguém ainda. Um psicólogo ou economista pode te acompanhar pelo Desafoga: ele vê suas compras, emoções e dívidas e ajuda a Luana a conversar melhor com você.</Sub>
      )}
      <form onSubmit={aceitar} className="flex flex-wrap items-end gap-2.5">
        <label className="min-w-[10rem] flex-1">
          <span className="mb-1 block font-bold">Código de convite</span>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
            placeholder="Ex.: K7P2QX"
            autoComplete="off"
            className={`${CAMPO} font-bold tracking-widest`}
          />
        </label>
        <Botao type="submit" variante="secundario" tamanho="pequeno" className="min-h-12" disabled={codigo.length < 4}>
          <UserPlus aria-hidden="true" />
          Aceitar acompanhamento
        </Botao>
      </form>
      <Sub className="mt-1.5">Ao aceitar, você autoriza esse profissional a ver seus dados no Desafoga.</Sub>
      <div role="status" aria-live="polite">
        {estado && <p className={`mt-2 font-bold ${estado.tipo === "ok" ? "text-good" : "text-bad"}`}>{estado.texto}</p>}
      </div>
    </Painel>
  );
}

/** LGPD: apagar a conta e tudo dela. */
function MeusDados() {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  return (
    <Painel titulo="Meus dados">
      <Sub>Você pode apagar sua conta quando quiser. Isso apaga de vez compras, emoções, dívidas, faturas, conversas com a Luana e o WhatsApp conectado.</Sub>
      {confirmando ? (
        <div className="mt-3 grid gap-2.5 rounded-xl bg-bad-soft p-3.5">
          <p className="font-bold text-bad">Tem certeza? Não dá para desfazer.</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Botao variante="secundario" onClick={() => setConfirmando(false)}>
              Cancelar
            </Botao>
            <Botao
              className="border-bad! bg-bad! text-white!"
              onClick={async () => {
                await servicos.sessao.apagarConta();
                router.replace("/");
              }}
            >
              Apagar tudo
            </Botao>
          </div>
        </div>
      ) : (
        <Botao variante="secundario" className="mt-3" onClick={() => setConfirmando(true)}>
          <Trash2 aria-hidden="true" />
          Apagar minha conta
        </Botao>
      )}
    </Painel>
  );
}
