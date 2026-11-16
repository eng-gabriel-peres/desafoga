/**
 * Leitura das mensagens do chat por regras locais. Na etapa com IA real, o
 * modelo substitui estas regras; os números continuam vindo do código.
 */
import { lerValorEmReais } from "@/lib/dinheiro";
import type { Categoria, Emocao, Necessidade } from "@/lib/finance";

/** Remove acentos e passa para minúsculas, para comparar texto. */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const SOFRIMENTO_INTENSO = [
  /me matar/,
  /suicid/,
  /tirar (a )?minha (propria )?vida/,
  /nao quero (mais )?viver/,
  /quero morrer/,
  /me machucar/,
  /acabar com tudo/,
  /sumir para sempre/,
  /nao vejo (mais )?saida/,
];

/** Indica sofrimento intenso. Não é diagnóstico: só aciona acolhimento e aviso. */
export function indicaSofrimentoIntenso(texto: string): boolean {
  const t = normalizar(texto);
  return SOFRIMENTO_INTENSO.some((r) => r.test(t));
}

export type Intencao =
  | { tipo: "sofrimento" }
  | { tipo: "plano" }
  | { tipo: "extra"; valor: number }
  | { tipo: "juros" }
  | { tipo: "resumo" }
  | { tipo: "compra"; item: string; valor: number | null }
  /** Dinheiro guardado numa meta. */
  | { tipo: "guardar"; valor: number }
  /** "paguei luz 87,50", "paguei o aluguel", "paguei": conta fixa ou parcela do mês. */
  | { tipo: "pagar"; nome: string; valor: number | null }
  /** "minhas metas", "como está minha meta" */
  | { tipo: "metas" }
  | { tipo: "vontade-de-comprar" }
  | { tipo: "livre" };

const PALAVRA_SOLTA = "comprei|gastei|paguei|um|uma|uns|umas|de|do|da|dos|das|no|na|em|com|reais|real|por|pra|para|o|a|os|as";
const NO_COMECO = new RegExp(`^(${PALAVRA_SOLTA})\\s+`);
const NO_FIM = new RegExp(`\\s+(${PALAVRA_SOLTA})$`);

/** "comprei um tênis de corrida 399" -> "Tênis de corrida" (sem o verbo e sem o valor). */
export function nomeDaCompra(texto: string): string {
  let nome = texto
    .toLowerCase()
    .replace(/r\$\s*/g, " ")
    .replace(/\d[\d.,]*\s*(mil\b|k\b)?/g, " ")
    .replace(/[?!.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Tira verbos, artigos e preposições soltos nas pontas: "em maquiagem", "pão de".
  for (let antes = ""; antes !== nome; ) {
    antes = nome;
    nome = nome.replace(NO_COMECO, "").replace(NO_FIM, "");
  }
  if (new RegExp(`^(${PALAVRA_SOLTA})?$`).test(nome)) return "Compra";
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/** Palavras que indicam o lugar onde a pessoa junta dinheiro. */
const LUGAR_DE_GUARDAR = /\b(cofr?inho|cofre|meta|poupanca|reserva|caixinha|porquinho)\b/;
/** "guardei 50", "juntei 30", "economizei 20", "separei 100": sempre é para uma meta. */
const GUARDEI = /^(eu )?(ja )?(guardei|juntei|economizei|separei|poupei)\b/;
/** "transferi 1000 pro cofrinho", "vou transferir 1k da conta para a viagem": só com a meta citada. */
const TRANSFERI = /^(eu )?(vou |acabei de |ja )?(transfer|deposit|coloc|coloq|mand|botei|pus)\w*\b/;

/** O texto tem esta palavra (ou expressão) inteira? Compara palavras, sem montar regex com o texto da pessoa. */
export function temPalavra(texto: string, palavra: string): boolean {
  const t = ` ${texto.replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  const p = palavra.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return Boolean(p) && t.includes(` ${p} `);
}

/** Como a pessoa chama a meta: o nome inteiro ou a primeira palavra ("reserva", "viagem"). */
export function apelidosDaMeta(nome: string): string[] {
  const n = normalizar(nome);
  const primeira = n.split(/\s+/).find((p) => p.length >= 4);
  return primeira && primeira !== n ? [n, primeira] : [n];
}

/**
 * Dinheiro guardado numa meta. A transferência para o cofrinho conta direto
 * na meta, sem registrar duas vezes. `nomesDasMetas` reconhece a meta pelo nome.
 */
function lerGuardar(t: string, nomesDasMetas: string[]): Intencao | null {
  const valor = lerValorEmReais(t);
  if (!valor) return null;
  const citaMeta = LUGAR_DE_GUARDAR.test(t) || nomesDasMetas.some((n) => n && apelidosDaMeta(n).some((a) => temPalavra(t, a)));
  if (GUARDEI.test(t) || (TRANSFERI.test(t) && citaMeta)) return { tipo: "guardar", valor };
  return null;
}

export function entender(texto: string, nomesDasMetas: string[] = []): Intencao {
  const t = normalizar(texto);
  if (indicaSofrimentoIntenso(t)) return { tipo: "sofrimento" };
  const guardar = lerGuardar(t, nomesDasMetas);
  if (guardar) return guardar;
  if (/^(meu )?plano\b|como (eu )?saio das dividas/.test(t)) return { tipo: "plano" };

  const valor = lerValorEmReais(t);
  const ehCompra = /^(comprei|gastei)\b/.test(t);
  if (!ehCompra && valor && /(a mais|extra|e se eu pagar|pagar mais)/.test(t)) {
    return { tipo: "extra", valor };
  }
  if (!ehCompra && /(juros|divida|fatura|rotativo)/.test(t)) return { tipo: "juros" };
  if (/^resumo\b|nota do dia|como (foi|esta) (o )?meu dia/.test(t)) return { tipo: "resumo" };
  if (/^(minhas? metas?|metas?)$|como (esta|vai|anda)m? (a |as )?minhas? metas?/.test(t)) return { tipo: "metas" };

  // "paguei luz 87,50": a conversa decide se é uma conta do mês ou uma compra ("paguei 30 no uber").
  if (/^(eu )?(ja )?paguei\b/.test(t)) {
    const nome = nomeDaCompra(texto);
    return { tipo: "pagar", nome: nome === "Compra" ? "" : nome, valor };
  }

  const palavras = t.split(/\s+/).length;
  if (ehCompra || (valor !== null && palavras <= 5)) {
    return { tipo: "compra", item: nomeDaCompra(texto), valor };
  }
  if (/(vontade de comprar|quero comprar|vou comprar|to querendo comprar|pensando em comprar)/.test(t)) {
    return { tipo: "vontade-de-comprar" };
  }
  return { tipo: "livre" };
}

/** "1", "muito triste", "feliz"… -> emoção de 1 a 5, ou null. */
export function lerEmocao(texto: string): Emocao | null {
  const t = normalizar(texto);
  const n = t.match(/^[1-5]\b/);
  if (n) return Number(n[0]) as Emocao;
  if (/muito triste/.test(t)) return 1;
  if (/muito feliz/.test(t)) return 5;
  if (/triste|mal\b/.test(t)) return 2;
  if (/feliz|bem\b/.test(t)) return 4;
  if (/normal|neutr/.test(t)) return 3;
  return null;
}

/** "Sim", "Não", "Não sei" -> necessidade, ou null. */
export function lerNecessidade(texto: string): Necessidade | null {
  const t = normalizar(texto);
  if (/nao sei|talvez|sei la/.test(t)) return "talvez";
  if (/^nao\b|^n$/.test(t)) return "nao";
  if (/^sim\b|^s$|^era\b/.test(t)) return "sim";
  return null;
}

const CATEGORIAS: [RegExp, Categoria][] = [
  [/pao|padaria|mercado|feira|leite|cafe|hortifruti|acougue/, "Mercado"],
  [/roupa|blusa|calca|tenis|sapato|vestido|camiseta|jaqueta/, "Roupa"],
  [/lanche|pizza|ifood|delivery|hamburguer|doce|chocolate|restaurante/, "Comida pronta"],
  [/farmacia|remedio|vitamina|protetor/, "Farmácia"],
  [/casa|limpeza|panela|lampada|movel/, "Casa"],
  [/jogo|cinema|show|ingresso|streaming|bar\b/, "Lazer"],
  [/presente|lembrancinha|aniversario/, "Presente"],
];

/** Palpite de categoria pelo nome da compra feita no chat. */
export function adivinharCategoria(item: string): Categoria {
  const t = normalizar(item);
  return CATEGORIAS.find(([r]) => r.test(t))?.[1] ?? "Outro";
}
