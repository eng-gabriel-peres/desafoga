/**
 * Dados fictícios da demonstração do Desafoga. Nenhum dado real.
 */
import type { Profissional } from "@/services/tipos";
import { ana } from "./ana";
import { carlos, lucia, rafael } from "./outras-pessoas";
import type { SementeFatura, SementePessoa } from "./sementes";

export { materializar, materializarFatura, type DadosDaPessoa, type SementePessoa } from "./sementes";

/** A pessoa do modo "Pessoa" é sempre a primeira. */
export const SEMENTES: SementePessoa[] = [ana, carlos, lucia, rafael];

/** Quem acompanha as pessoas. A responsável da demonstração é a Paula. */
export const PROFISSIONAIS: Profissional[] = [
  { id: "paula", nome: "Paula Reis", papel: "Psicóloga", cor: "#0F766E" },
  { id: "marcos", nome: "Marcos Andrade", papel: "Economista", cor: "#B45309" },
];

export const RESPONSAVEL_DA_DEMO = "paula";

/**
 * Documento usado no lugar do arquivo enviado em "Enviar fatura". Duas compras
 * batem com o que a Ana já registrou; três são novas e pedem classificação.
 */
export const FATURA_DE_EXEMPLO: SementeFatura = {
  id: "exemplo-extrato",
  tipo: "extrato",
  origem: "Extrato da conta corrente",
  lancamentos: [
    { id: "e1", dias: 13, descricao: "PIX RECEBIDO SALARIO", valor: 280000, tipo: "pagamento" },
    { id: "e2", dias: 11, descricao: "TARIFA PACOTE SERVICOS", valor: 3490, tipo: "tarifa" },
    { id: "e3", dias: 7, descricao: "ASSINATURA NUVEM FOTOS", valor: 990, tipo: "assinatura" },
    { id: "e4", dias: 3, descricao: "PADARIA DO BAIRRO", valor: 2200, tipo: "compra", categoria: "Mercado", compraId: "ana-c7" },
    { id: "e5", dias: 2, descricao: "HORTIFRUTI FEIRA LIVRE", valor: 9600, tipo: "compra", categoria: "Mercado", compraId: "ana-c9" },
    { id: "e6", dias: 5, descricao: "PERFUMARIA SHOPPING", valor: 18990, tipo: "compra", categoria: "Outro" },
    { id: "e7", dias: 2, descricao: "TRANSPORTE APP", valor: 2750, tipo: "compra", categoria: "Outro" },
    { id: "e8", dias: 1, descricao: "LOJA DE DOCES", valor: 3400, tipo: "compra", categoria: "Comida pronta" },
    { id: "e9", dias: 2, descricao: "JUROS CHEQUE ESPECIAL", valor: 4898, tipo: "juros" },
    { id: "e10", dias: 2, descricao: "IOF CHEQUE ESPECIAL", valor: 210, tipo: "iof" },
  ],
};
