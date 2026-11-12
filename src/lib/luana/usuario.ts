/** Identificador gerado pelo navegador para separar os gastos de cada visitante. */
export function usuarioValido(valor: unknown): valor is string {
  return typeof valor === "string" && /^[A-Za-z0-9-]{8,64}$/.test(valor);
}
