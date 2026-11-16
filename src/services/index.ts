import { servicosDaApi } from "./api";
import type { Servicos } from "./contratos";
import { servicosLocais } from "./mock";

export type * from "./contratos";
export type * from "./tipos";

/**
 * Ponto único de acesso aos dados. Por padrão, a API do servidor (banco, IA e
 * WhatsApp). Com NEXT_PUBLIC_DESAFOGA_DADOS=local, tudo fica no navegador,
 * sem IA. As telas não mudam em nenhum dos dois casos.
 */
export const servicos: Servicos = process.env.NEXT_PUBLIC_DESAFOGA_DADOS === "local" ? servicosLocais : servicosDaApi;
