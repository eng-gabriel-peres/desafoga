import { describe, expect, it } from "vitest";
import { conquistada, progressoDaConquista, tituloAutomatico } from "./conquistas";
import type { Compra, Conquista, Emocao, Necessidade } from "./tipos";

const HOJE = new Date(2026, 10, 18, 15, 0); // 18/11/2026, 15h

let n = 0;
function compra(diasAtras: number, emocao: Emocao, necessidade: Necessidade): Compra {
  const d = new Date(HOJE);
  d.setDate(d.getDate() - diasAtras);
  d.setHours(10, 0, 0, 0);
  return { id: `c${n++}`, item: "x", categoria: "Outro", valor: 1000, emocao, necessidade, quando: d.toISOString(), via: "app", avaliacaoProfissional: null } as Compra;
}

function conquista(tipo: Conquista["tipo"], alvo: number, criadaHaDias = 10, extra: Partial<Conquista> = {}): Conquista {
  const d = new Date(HOJE);
  d.setDate(d.getDate() - criadaHaDias);
  d.setHours(9, 0, 0, 0);
  return { id: "q", icone: "broto", titulo: "t", tipo, alvo, premio: "", criadaEm: d.toISOString(), concluidaEm: null, autor: "Paula", ...extra };
}

describe("progresso das conquistas", () => {
  it("compras registradas: conta só as feitas depois de criada", () => {
    const l = [compra(20, 3, "sim"), compra(5, 3, "sim"), compra(1, 2, "nao")];
    expect(progressoDaConquista(conquista("registrar", 20), l, HOJE)).toBe(2);
  });

  it("dias com nota 3 ou mais, desde a criação", () => {
    const l = [compra(12, 5, "sim"), compra(4, 4, "sim"), compra(4, 3, "sim"), compra(3, 1, "nao"), compra(2, 3, "sim"), compra(2, 2, "sim")];
    // Dia 4: nota 3,5; dia 3: 1; dia 2: 2,5. Só um dia bom depois de criada.
    expect(progressoDaConquista(conquista("nota-boa", 5), l, HOJE)).toBe(1);
  });

  it("dias seguidos sem compra não necessária: de hoje para trás, até a criação", () => {
    const l = [compra(4, 2, "nao"), compra(2, 3, "sim")];
    // Hoje, ontem, anteontem e 3 dias atrás sem "não": 4 dias.
    expect(progressoDaConquista(conquista("sem-impulso", 7), l, HOJE)).toBe(4);
    // Criada há 1 dia: só ontem e hoje contam.
    expect(progressoDaConquista(conquista("sem-impulso", 7, 1), l, HOJE)).toBe(2);
    expect(progressoDaConquista(conquista("sem-impulso", 7), [...l, compra(0, 1, "nao")], HOJE)).toBe(0);
  });

  it("depois de conquistada, fica conquistada", () => {
    const c = conquista("sem-impulso", 3, 10, { concluidaEm: HOJE.toISOString() });
    expect(conquistada(c, [compra(0, 1, "nao")], HOJE)).toBe(true);
    expect(conquistada(conquista("registrar", 1), [compra(0, 3, "sim")], HOJE)).toBe(true);
    expect(conquistada(conquista("registrar", 2), [compra(0, 3, "sim")], HOJE)).toBe(false);
  });

  it("título automático no singular e no plural", () => {
    expect(tituloAutomatico("sem-impulso", 3)).toBe("3 dias sem compra por impulso");
    expect(tituloAutomatico("registrar", 1)).toBe("Anotar 1 compra");
    expect(tituloAutomatico("nota-boa", 5)).toBe("5 dias comprando de bem com a vida");
  });
});
