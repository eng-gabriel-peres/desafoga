/**
 * Número de WhatsApp informado no cadastro. Guardamos só dígitos, com o 55 e
 * com o nono dígito: "(11) 99999-8888" -> "5511999998888".
 */
export function normalizarTelefone(texto: string): string | null {
  let d = texto.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!/^55\d{10,11}$/.test(d)) return null;
  // Celular sem o nono dígito (55 + DDD + 8 dígitos começando em 6 a 9).
  const m = d.match(/^55(\d{2})([6-9]\d{7})$/);
  return m ? `55${m[1]}9${m[2]}` : d;
}

/** "5511999998888" -> "(11) 99999-8888" */
export function telefoneLegivel(d: string): string {
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d;
}
