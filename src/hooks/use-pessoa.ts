"use client";

import { servicos, type Compra, type DadosDasContas, type DadosDaRotina, type Divida, type Fatura, type Meta, type Orcamento, type Persona, type Plano } from "@/services";
import { useConsulta } from "./use-consulta";

export interface DadosDaTela {
  persona: Persona;
  compras: Compra[];
  dividas: Divida[];
  plano: Plano;
  faturas: Fatura[];
  orcamentos: Orcamento[];
  metas: Meta[];
  contas: DadosDasContas;
  rotina: DadosDaRotina;
}

/** Tudo o que as telas de uma pessoa precisam, numa consulta só. */
export function usePessoa(pessoaId: string): DadosDaTela | undefined {
  return useConsulta(`pessoa:${pessoaId}`, async () => {
    const [persona, compras, dividas, plano, faturas, orcamentos, metas, contas, rotina] = await Promise.all([
      servicos.pessoas.obter(pessoaId),
      servicos.compras.listar(pessoaId),
      servicos.dividas.listar(pessoaId),
      servicos.dividas.plano(pessoaId),
      servicos.faturas.listar(pessoaId),
      servicos.orcamentos.listar(pessoaId),
      servicos.metas.listar(pessoaId),
      servicos.contas.listar(pessoaId),
      servicos.rotina.obter(pessoaId),
    ]);
    if (!persona) throw new Error(`Pessoa não encontrada: ${pessoaId}`);
    return { persona, compras, dividas, plano, faturas, orcamentos, metas, contas, rotina };
  });
}
