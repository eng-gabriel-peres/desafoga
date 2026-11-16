import type { Servicos } from "./contratos";
import { servicosSimulados } from "./mock";

export type * from "./contratos";
export type * from "./tipos";

/**
 * Ponto único de acesso aos dados. Para usar a API real, troque a
 * implementação aqui; as telas não mudam.
 */
export const servicos: Servicos = servicosSimulados;
