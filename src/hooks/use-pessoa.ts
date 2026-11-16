"use client";

import { servicos, type Compra, type Divida, type Fatura, type Meta, type Orcamento, type Persona, type Plano } from "@/services";
import { useConsulta } from "./use-consulta";

export interface DadosDaTela {
  persona: Persona;
  compras: Compra[];
  dividas: Divida[];
  plano: Plano;
  faturas: Fatura[];
  orcamentos: Orcamento[];
  metas: Meta[];
}

/** Tudo o que as telas de uma pessoa precisam, numa consulta só. */
export function usePessoa(pessoaId: string): DadosDaTela | undefined {
  return useConsulta(`pessoa:${pessoaId}`, async () => {
    const [persona, compras, dividas, plano, faturas, orcamentos, metas] = await Promise.all([
      servicos.pessoas.obter(pessoaId),
      servicos.compras.listar(pessoaId),
      servicos.dividas.listar(pessoaId),
      servicos.dividas.plano(pessoaId),
      servicos.faturas.listar(pessoaId),
      servicos.orcamentos.listar(pessoaId),
      servicos.metas.listar(pessoaId),
    ]);
    if (!persona) throw new Error(`Pessoa não encontrada: ${pessoaId}`);
    return { persona, compras, dividas, plano, faturas, orcamentos, metas };
  });
}
