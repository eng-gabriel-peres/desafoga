"use client";

import { useState } from "react";
import { IconeLua, IconePaleta, IconeSol } from "./icones";

export const CHAVE_DO_TEMA = "luana-tema";
export const CHAVE_DA_COR = "luana-cor";

/** Cores do chat; os tons de cada uma, por tema, ficam em globals.css. */
export const CORES = [
  { id: "azul", nome: "Azul", amostra: "#3f9fcb" },
  { id: "roxo", nome: "Roxo", amostra: "#9370e0" },
  { id: "verde", nome: "Verde", amostra: "#3faa78" },
  { id: "amarelo", nome: "Amarelo", amostra: "#d4a514" },
  { id: "rosa", nome: "Rosa", amostra: "#dc5f98" },
  { id: "laranja", nome: "Laranja", amostra: "#e07a2c" },
];

export function preferencia(chave: string, padrao: string): string {
  try {
    return localStorage.getItem(chave) ?? padrao;
  } catch {
    return padrao;
  }
}

/** Marca o <html> com a preferência e a guarda neste navegador. */
export function aplicar(chave: string, atributo: "tema" | "cor", valor: string) {
  document.documentElement.dataset[atributo] = valor;
  try {
    localStorage.setItem(chave, valor);
  } catch {
    // Sem armazenamento: vale até recarregar a página.
  }
}

const redondo = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full";

/** Botões de cor e de tema para telas que não são a conversa. Só no navegador. */
export function Aparencia() {
  const [tema, setTema] = useState(() => preferencia(CHAVE_DO_TEMA, "escuro"));
  const [cor, setCor] = useState(() => preferencia(CHAVE_DA_COR, "azul"));
  const [escolhendo, setEscolhendo] = useState(false);
  const outroTema = tema === "claro" ? "escuro" : "claro";

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => setEscolhendo((aberto) => !aberto)}
        aria-expanded={escolhendo}
        title="Cor do painel"
        aria-label="Cor do painel"
        className={`${redondo} text-muted hover:bg-accent-soft hover:text-accent`}
      >
        <IconePaleta />
      </button>
      <button
        type="button"
        onClick={() => {
          setTema(outroTema);
          aplicar(CHAVE_DO_TEMA, "tema", outroTema);
        }}
        title={`Mudar para o tema ${outroTema}`}
        aria-label={`Mudar para o tema ${outroTema}`}
        className={`${redondo} text-muted hover:bg-accent-soft hover:text-accent`}
      >
        {tema === "claro" ? <IconeLua /> : <IconeSol />}
      </button>
      {escolhendo && (
        <div
          className="absolute right-0 top-full z-10 mt-2 flex gap-2 rounded-2xl border border-line bg-surface p-2"
          role="radiogroup"
          aria-label="Cor do painel"
        >
          {CORES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={cor === c.id}
              onClick={() => {
                setCor(c.id);
                aplicar(CHAVE_DA_COR, "cor", c.id);
              }}
              title={c.nome}
              aria-label={c.nome}
              className={`h-8 w-8 shrink-0 rounded-full border-2 ${cor === c.id ? "border-foreground" : "border-transparent"}`}
              style={{ backgroundColor: c.amostra }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
