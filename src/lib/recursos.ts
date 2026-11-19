/**
 * Recursos que dá para esconder sem apagar o código (para a apresentação do
 * hackathon). Desligado, o recurso some do menu e da Hoje, a tela volta para
 * o início, a API recusa as ações dele e os avisos automáticos dele param.
 * Os dados no banco ficam como estão.
 *
 * NEXT_PUBLIC_RECURSOS_DESLIGADOS (lida no servidor e no navegador):
 * - sem a variável: valem os desligados da apresentação (abaixo);
 * - vazia: tudo ligado;
 * - "eventos,conteudos": desliga só esses.
 */
export const RECURSOS = ["conteudos", "eventos", "conquistas"] as const;
export type Recurso = (typeof RECURSOS)[number];

/** Escondidos na apresentação do hackathon. */
export const RECURSOS_DESLIGADOS_PADRAO: Recurso[] = ["conteudos", "eventos", "conquistas"];

export function desligadosDe(variavel: string | undefined): Set<Recurso> {
  if (variavel === undefined) return new Set(RECURSOS_DESLIGADOS_PADRAO);
  const nomes = variavel.split(",").map((s) => s.trim());
  return new Set(RECURSOS.filter((r) => nomes.includes(r)));
}

// Escrito por extenso para o Next embutir o valor no código do navegador; lido a cada
// chamada para os testes poderem ligar e desligar.
export const recursoLigado = (r: Recurso): boolean => !desligadosDe(process.env.NEXT_PUBLIC_RECURSOS_DESLIGADOS).has(r);
