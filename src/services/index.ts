import { servicosDaApi } from "./api";
import type { Servicos } from "./contratos";

export type * from "./contratos";
export type * from "./tipos";

/**
 * Ponto único de acesso aos dados: a API do servidor, que guarda tudo no
 * Postgres, confere a sessão e usa a IA e o WhatsApp. As telas só conhecem
 * os contratos.
 */
export const servicos: Servicos = servicosDaApi;
