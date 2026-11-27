export class IaIndisponivel extends Error {}
/** O serviço do modelo está sobrecarregado ou lento; vale tentar de novo depois. */
export class IaSobrecarregada extends IaIndisponivel {}
