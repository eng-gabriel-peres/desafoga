/** Nome de banco normalizado, para reconhecer a mesma instituição escrita de jeitos diferentes. */

const CONHECIDAS: [RegExp, string][] = [
  [/ITAU|UNIBANCO/, "itau"],
  [/BRADESC/, "bradesco"],
  [/SANTANDER/, "santander"],
  [/CAIXA ECON|^CAIXA\b|\bCEF\b/, "caixa"],
  [/BANCO DO BRASIL|^BB\b|\bBB S/, "bb"],
  [/\bNU\s?(PAGAMENTOS|BANK|FINANCEIRA)|NUBANK/, "nubank"],
  [/\bINTER\b|BANCO INTER/, "inter"],
  [/\bC6\b/, "c6"],
  [/PICPAY/, "picpay"],
  [/MERCADO\s?PAGO/, "mercadopago"],
  [/\bPAN\b|PANAMERICANO/, "pan"],
  [/\bBMG\b/, "bmg"],
  [/SAFRA/, "safra"],
  [/ORIGINAL/, "original"],
  [/\bNEON\b/, "neon"],
  [/\bNEXT\b/, "next"],
  [/\bBTG\b/, "btg"],
  [/\bXP\b/, "xp"],
  [/SICOOB/, "sicoob"],
  [/SICREDI/, "sicredi"],
  [/BANRISUL/, "banrisul"],
  [/\bBRB\b/, "brb"],
  [/DIGIO/, "digio"],
  [/WILL\s?BANK/, "willbank"],
  [/AGIBANK|AGIPLAN/, "agibank"],
  [/DAYCOVAL/, "daycoval"],
  [/MERCANTIL/, "mercantil"],
  [/CREDICARD/, "credicard"],
  [/PORTO SEGURO/, "porto"],
];

export function chaveDaInstituicao(nome: string): string {
  const texto = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  const conhecida = CONHECIDAS.find(([padrao]) => padrao.test(texto));
  if (conhecida) return conhecida[1];
  return texto
    .replace(/\b(BANCO|BCO|S\.?\s?A\.?|S\/A|LTDA|ME|EPP|INSTITUICAO DE PAGAMENTO|SOCIEDADE DE CREDITO|FINANCEIRA)\b/g, " ")
    .replace(/[^A-Z0-9]/g, "")
    .toLowerCase();
}

const NOMES: Record<string, string> = {
  itau: "Itaú",
  bradesco: "Bradesco",
  santander: "Santander",
  caixa: "Caixa",
  bb: "Banco do Brasil",
  nubank: "Nubank",
  inter: "Inter",
  c6: "C6 Bank",
  picpay: "PicPay",
  mercadopago: "Mercado Pago",
  pan: "Banco Pan",
  bmg: "BMG",
  safra: "Safra",
  original: "Original",
  neon: "Neon",
  next: "Next",
  btg: "BTG",
  xp: "XP",
  sicoob: "Sicoob",
  sicredi: "Sicredi",
  banrisul: "Banrisul",
  brb: "BRB",
  digio: "Digio",
  willbank: "Will Bank",
  agibank: "Agibank",
  daycoval: "Daycoval",
  mercantil: "Mercantil",
  credicard: "Credicard",
  porto: "Porto Seguro",
};

/** Nome para mostrar: "ITAU UNIBANCO S.A." → "Itaú"; desconhecido fica como veio, sem caixa alta gritando. */
export function nomeDaInstituicao(nome: string): string {
  const conhecido = NOMES[chaveDaInstituicao(nome)];
  if (conhecido) return conhecido;
  const limpo = nome.trim();
  if (limpo !== limpo.toUpperCase()) return limpo;
  return limpo.toLowerCase().replace(/(^|\s)\p{L}/gu, (l) => l.toUpperCase());
}
