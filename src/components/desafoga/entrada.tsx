"use client";

import { ChevronRight, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConsulta } from "@/hooks/use-consulta";
import { servicos, type NovaConta, type PerfilDaDemo } from "@/services";
import { Marca } from "./moldura/partes";
import { Avatar, Chip, Painel, Sub } from "./ui/blocos";
import { Botao } from "./ui/botao";

const CAMPO = "min-h-12 w-full rounded-[var(--radius-ctl)] border-2 border-line bg-surface px-3.5 outline-none campo focus:border-primary";

/**
 * Entrada do Desafoga. Sem senha (decisão do hackathon): quem avalia testa
 * a demonstração com um toque, e quem quer usar de verdade cria a conta.
 */
export function Entrada() {
  const router = useRouter();
  const eu = useConsulta("eu", () => servicos.sessao.eu());
  const [entrando, setEntrando] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  async function demo(perfil: PerfilDaDemo, destino: string) {
    setErro("");
    setEntrando(perfil);
    try {
      await servicos.sessao.entrarNaDemo(perfil);
      router.push(destino);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui entrar agora.");
      setEntrando(null);
    }
  }

  const atual = eu?.pessoa ?? eu?.profissional ?? null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <Marca />
      </div>
      <h1 className="text-[1.9rem] leading-tight font-bold">Respire. Suas compras e dívidas, sem peso.</h1>
      <p className="mt-2 text-muted">
        O Desafoga junta a emoção de cada compra, o raio-x das dívidas e um profissional acompanhando.
      </p>

      {eu && atual && !eu.demo && (
        <Painel className="mt-6">
          <div className="flex items-center gap-3">
            <Avatar nome={atual.nome} cor={atual.cor} tamanho="lg" />
            <div className="min-w-0 flex-1">
              <b className="block">{atual.nome}</b>
              <span className="text-[0.92rem] text-muted">Você já está com a sua conta aberta neste navegador.</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Botao onClick={() => router.push(eu.pessoa ? "/app/hoje" : "/painel")}>Continuar</Botao>
            <Botao
              variante="secundario"
              onClick={async () => {
                await servicos.sessao.sair();
                router.refresh();
              }}
            >
              <LogOut aria-hidden="true" />
              Sair
            </Botao>
          </div>
        </Painel>
      )}

      <h2 className="mt-8 text-[1.15rem] font-bold">Testar sem cadastro</h2>
      <Sub className="mt-0.5">
        Demonstração com dados fictícios. Cada visita ganha a sua cópia, e dá para trocar de pessoa (menu do perfil › Trocar de perfil) vendo os mesmos dados.
      </Sub>
      <ul className="mt-3 grid gap-3">
        <li>
          <CartaoDeEntrada
            titulo="Entrar como Ana"
            descricao="App de quem usa: nota do dia, registro de compras, assistente e dívidas."
            nome="Ana Souza"
            cor="#2350C8"
            carregando={entrando === "ana"}
            onClick={() => demo("ana", "/app/hoje")}
          />
        </li>
        <li>
          <CartaoDeEntrada
            titulo="Entrar como Paula Reis"
            descricao="Painel de quem acompanha (psicóloga): pacientes, resumo, dívidas e memória da assistente."
            nome="Paula Reis"
            cor="#0F766E"
            carregando={entrando === "paula"}
            onClick={() => demo("paula", "/painel")}
          />
        </li>
      </ul>

      <h3 className="mt-6 font-bold">Outros pacientes da Paula</h3>
      <Sub className="mt-0.5">A Paula escolhe o tom da Luana para cada paciente. Entre como um deles para ver a diferença na conversa.</Sub>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {OUTROS.map((o) => (
          <li key={o.perfil}>
            <button
              type="button"
              onClick={() => demo(o.perfil, "/app/assistente")}
              disabled={entrando !== null}
              aria-label={`Entrar como ${o.nome}: ${o.descricao}. Luana com tom ${o.tom.toLowerCase()}.`}
              className="flex h-full w-full flex-col items-start gap-2 rounded-[var(--radius-card)] border-2 border-line bg-surface p-3.5 text-left hover:border-primary disabled:opacity-70"
            >
              <span className="flex items-center gap-2.5">
                <Avatar nome={o.nome} cor={o.cor} />
                <b>{entrando === o.perfil ? "Preparando…" : o.apelido}</b>
              </span>
              <span className="text-[0.88rem] text-muted">{o.descricao}</span>
              <span className="mt-auto rounded-full bg-primary-soft px-2.5 py-0.5 text-[0.8rem] font-bold text-primary">Luana {o.tom.toLowerCase()}</span>
            </button>
          </li>
        ))}
      </ul>

      {erro && (
        <p role="alert" className="mt-3 font-bold text-bad">
          {erro}
        </p>
      )}

      <h2 className="mt-9 text-[1.15rem] font-bold">Usar de verdade</h2>
      <Sub className="mt-0.5">Seus dados ficam só na sua conta. Sem senha: este navegador lembra de você, então evite computador compartilhado.</Sub>
      <CriarConta />
    </main>
  );
}

/** Os outros pacientes da demonstração, cada um com um tom da Luana definido pela Paula. */
const OUTROS: { perfil: PerfilDaDemo; nome: string; apelido: string; cor: string; descricao: string; tom: string }[] = [
  { perfil: "carlos", nome: "Carlos Lima", apelido: "Carlos", cor: "#17804F", descricao: "41 anos, sem dívidas, montando uma reserva", tom: "Direta" },
  { perfil: "lucia", nome: "Lúcia Andrade", apelido: "Lúcia", cor: "#8E44AD", descricao: "72 anos, aposentada, com consignado", tom: "Acolhedora" },
  { perfil: "rafael", nome: "Rafael Torres", apelido: "Rafael", cor: "#C2410C", descricao: "23 anos, compra de madrugada quando ansioso", tom: "Motivadora" },
];

function CartaoDeEntrada({
  titulo,
  descricao,
  nome,
  cor,
  carregando,
  onClick,
}: {
  titulo: string;
  descricao: string;
  nome: string;
  cor: string;
  carregando: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={carregando}
      className="grid min-h-24 w-full grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-[var(--radius-card)] border-2 border-line bg-surface p-4 text-left hover:border-primary disabled:opacity-70"
    >
      <Avatar nome={nome} cor={cor} tamanho="lg" />
      <span>
        <b className="block text-[1.1rem]">{carregando ? "Preparando a demonstração…" : titulo}</b>
        <span className="text-[0.92rem] text-muted">{descricao}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-6 text-muted" />
    </button>
  );
}

function CriarConta() {
  const router = useRouter();
  const [tipo, setTipo] = useState<NovaConta["tipo"]>("pessoa");
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [idade, setIdade] = useState("");
  const [papel, setPapel] = useState("");
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) return setErro("Escreva o seu nome.");
    if (tipo === "pessoa" && !apelido.trim()) return setErro("Escreva como você prefere ser chamada ou chamado.");
    if (tipo === "profissional" && !papel.trim()) return setErro("Escreva a sua profissão.");
    if (!aceito) return setErro("Para criar a conta, é preciso concordar com o uso dos dados.");
    const anos = idade.trim() ? Number.parseInt(idade, 10) : null;
    if (anos !== null && (!Number.isFinite(anos) || anos < 14 || anos > 120)) return setErro("Idade entre 14 e 120 anos, ou deixe em branco.");
    setCriando(true);
    try {
      await servicos.sessao.criarConta(
        tipo === "pessoa" ? { tipo, nome: nome.trim(), apelido: apelido.trim(), idade: anos } : { tipo, nome: nome.trim(), papel: papel.trim() },
      );
      router.push(tipo === "pessoa" ? "/app/hoje" : "/painel");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui criar a conta.");
      setCriando(false);
    }
  }

  return (
    <Painel className="mt-3">
      <div role="group" aria-label="Tipo de conta" className="mb-3 flex flex-wrap gap-2">
        <Chip marcado={tipo === "pessoa"} onClick={() => setTipo("pessoa")}>
          Quero organizar meu dinheiro
        </Chip>
        <Chip marcado={tipo === "profissional"} onClick={() => setTipo("profissional")}>
          Sou profissional
        </Chip>
      </div>
      <form onSubmit={criar} className="grid gap-3" noValidate>
        <label>
          <span className="mb-1 block font-bold">Nome completo</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" className={CAMPO} />
        </label>
        {tipo === "pessoa" ? (
          <>
            <label>
              <span className="mb-1 block font-bold">Como prefere ser chamada ou chamado</span>
              <input value={apelido} onChange={(e) => setApelido(e.target.value)} autoComplete="nickname" className={CAMPO} />
            </label>
            <label>
              <span className="mb-1 block font-bold">Idade (opcional)</span>
              <input value={idade} onChange={(e) => setIdade(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" className={CAMPO} />
            </label>
          </>
        ) : (
          <label>
            <span className="mb-1 block font-bold">Profissão</span>
            <input value={papel} onChange={(e) => setPapel(e.target.value)} placeholder="Ex.: Psicóloga, Economista" className={CAMPO} />
          </label>
        )}
        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--primary)]" />
          <span className="text-[0.92rem]">
            {tipo === "pessoa"
              ? "Concordo que o Desafoga guarde minhas compras, emoções, dívidas e conversas para funcionar. Só eu e quem eu aceitar como acompanhante vemos esses dados, e posso apagar tudo quando quiser."
              : "Concordo que o Desafoga guarde meus dados e as anotações que eu fizer sobre quem acompanho, que só eu e os outros profissionais da pessoa vemos."}
          </span>
        </label>
        {erro && (
          <p role="alert" className="font-bold text-bad">
            {erro}
          </p>
        )}
        <Botao type="submit" disabled={criando}>
          {criando ? "Criando…" : "Criar minha conta"}
        </Botao>
      </form>
    </Painel>
  );
}
