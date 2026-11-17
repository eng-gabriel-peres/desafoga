"use client";

import { FileSearch, LoaderCircle, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { servicos } from "@/services";
import { Sub } from "../ui/blocos";
import { Botao } from "../ui/botao";
import { Janela } from "../ui/janela";

const TEXTOS = {
  registrato: {
    titulo: "Enviar Registrato",
    explicacao:
      "O Registrato do Banco Central lista todos os seus empréstimos, financiamentos, cheque especial e rotativo do cartão, em todos os bancos. Entre em registrato.bcb.gov.br com a conta gov.br, baixe o “Relatório de Empréstimos e Financiamentos” em PDF e envie aqui.",
  },
  contrato: {
    titulo: "Enviar contrato ou print",
    explicacao: "Mande o contrato do empréstimo ou um print da tela do empréstimo no app do banco (saldo, parcela, taxa). A gente lê e você confere antes de entrar.",
  },
} as const;

/** Janela para enviar Registrato ou contrato: a leitura vira sugestões de dívida para conferir. */
export function EnviarDocumento({ pessoaId, tipo, aberta, fechar, demo }: { pessoaId: string; tipo: "registrato" | "contrato"; aberta: boolean; fechar: () => void; demo: boolean }) {
  const [estado, setEstado] = useState<{ etapa: "envio" } | { etapa: "lendo" } | { etapa: "pronto"; texto: string } | { etapa: "erro"; texto: string }>({ etapa: "envio" });
  const entrada = useRef<HTMLInputElement>(null);
  const t = TEXTOS[tipo];

  async function ler(arquivo: File | null, exemplo?: "registrato" | "contrato") {
    setEstado({ etapa: "lendo" });
    try {
      const r = await servicos.documentos.ler(pessoaId, arquivo, exemplo);
      if (r.tipo === "dividas") {
        const n = r.sugestoes.length;
        setEstado({ etapa: "pronto", texto: `Achei ${n} ${n === 1 ? "dívida" : "dívidas"}. Confira no topo de Dívidas e adicione as que forem suas.` });
      } else {
        setEstado({ etapa: "erro", texto: "Isso parece uma fatura ou um extrato. Envie em Dívidas › Faturas e extratos." });
      }
    } catch (e) {
      setEstado({ etapa: "erro", texto: e instanceof Error ? e.message : "Não consegui ler esse arquivo. Tente de novo." });
    }
  }

  const sair = () => {
    setEstado({ etapa: "envio" });
    fechar();
  };

  return (
    <Janela aberta={aberta} fechar={sair} rotulo={t.titulo}>
      <div className="grid gap-3">
        <h2 className="flex items-center gap-2 text-[1.3rem] font-bold">
          <FileSearch aria-hidden="true" className="size-5 text-primary" /> {t.titulo}
        </h2>
        <Sub>{t.explicacao}</Sub>
        <div aria-live="polite">
          {estado.etapa === "lendo" && (
            <p className="flex items-center gap-2 text-muted">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Lendo o documento…
            </p>
          )}
          {estado.etapa === "pronto" && <p className="rounded-[14px] bg-good-soft p-3">{estado.texto}</p>}
          {estado.etapa === "erro" && (
            <p role="alert" className="rounded-[14px] bg-bad-soft p-3 text-bad">
              {estado.texto}
            </p>
          )}
        </div>
        <input
          ref={entrada}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={`Arquivo do ${tipo === "registrato" ? "Registrato" : "contrato"}`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) ler(f);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap justify-end gap-2">
          {demo && (
            <Botao variante="secundario" onClick={() => ler(null, tipo)} disabled={estado.etapa === "lendo"}>
              Usar exemplo
            </Botao>
          )}
          {estado.etapa === "pronto" ? (
            <Botao onClick={sair}>Ver as dívidas</Botao>
          ) : (
            <Botao onClick={() => entrada.current?.click()} disabled={estado.etapa === "lendo"}>
              <Upload aria-hidden="true" />
              Escolher arquivo
            </Botao>
          )}
        </div>
      </div>
    </Janela>
  );
}
