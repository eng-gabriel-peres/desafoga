// Gera as faturas fictícias em PDF usadas na demo, a partir de fixtures/personas.
// Uso: pnpm gerar:faturas
import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const brl = (centavos) =>
  (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const data = (iso) => iso.split("-").reverse().join("/");

for (const id of ["ana", "carlos", "marina"]) {
  const { persona, fatura, dividas } = JSON.parse(
    readFileSync(new URL(`../fixtures/personas/${id}.json`, import.meta.url), "utf8"),
  );
  const rotativo = dividas.find((d) => d.tipo === "cartao_rotativo");
  // Quem não está no rotativo vê na fatura a taxa que seria cobrada se entrasse.
  const taxa = ((rotativo?.taxaMensal ?? 0.139) * 100).toFixed(2).replace(".", ",");

  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595, 842]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cinza = rgb(0.35, 0.4, 0.45);
  let y = 790;
  const linha = (esq, dir, { fonte = normal, tam = 10, cor = rgb(0.08, 0.13, 0.17) } = {}) => {
    pagina.drawText(esq, { x: 50, y, size: tam, font: fonte, color: cor });
    if (dir) {
      const largura = fonte.widthOfTextAtSize(dir, tam);
      pagina.drawText(dir, { x: 545 - largura, y, size: tam, font: fonte, color: cor });
    }
    y -= tam + 8;
  };
  const regua = () => {
    pagina.drawLine({ start: { x: 50, y: y + 6 }, end: { x: 545, y: y + 6 }, thickness: 0.5, color: cinza });
    y -= 8;
  };

  linha(fatura.emissor, "FATURA DO CARTÃO", { fonte: negrito, tam: 16 });
  linha("DOCUMENTO FICTÍCIO PARA DEMONSTRAÇÃO - SEM VALOR", "", { tam: 8, cor: cinza });
  y -= 10;
  linha(`Titular: ${persona.nome}`, `Vencimento: ${data(fatura.vencimento)}`);
  regua();
  linha("Total desta fatura", `R$ ${brl(fatura.total)}`, { fonte: negrito, tam: 13 });
  linha("Pagamento mínimo", `R$ ${brl(fatura.pagamentoMinimo)}`);
  linha("Juros do crédito rotativo", `${taxa}% ao mês`);
  y -= 10;
  linha("LANÇAMENTOS", "VALOR (R$)", { fonte: negrito, tam: 9, cor: cinza });
  regua();
  for (const l of fatura.lancamentos) linha(`${data(l.data)}   ${l.descricao}`, brl(l.valor));
  if (fatura.encargos.length > 0) {
    y -= 10;
    linha("ENCARGOS", "VALOR (R$)", { fonte: negrito, tam: 9, cor: cinza });
    regua();
    for (const e of fatura.encargos) linha(e.descricao, brl(e.valor));
  }

  writeFileSync(new URL(`../public/exemplos/fatura-${id}.pdf`, import.meta.url), await pdf.save());
  console.log(`public/exemplos/fatura-${id}.pdf`);
}

// Extrato de conta fictício, a partir de fixtures/extratos.
for (const id of ["ana"]) {
  const extrato = JSON.parse(readFileSync(new URL(`../fixtures/extratos/${id}.json`, import.meta.url), "utf8"));

  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595, 842]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cinza = rgb(0.35, 0.4, 0.45);
  let y = 790;
  const linha = (esq, dir, { fonte = normal, tam = 10, cor = rgb(0.08, 0.13, 0.17) } = {}) => {
    pagina.drawText(esq, { x: 50, y, size: tam, font: fonte, color: cor });
    if (dir) {
      const largura = fonte.widthOfTextAtSize(dir, tam);
      pagina.drawText(dir, { x: 545 - largura, y, size: tam, font: fonte, color: cor });
    }
    y -= tam + 8;
  };
  const regua = () => {
    pagina.drawLine({ start: { x: 50, y: y + 6 }, end: { x: 545, y: y + 6 }, thickness: 0.5, color: cinza });
    y -= 8;
  };

  const saldoFinal = extrato.movimentos.reduce(
    (s, m) => s + (m.tipo === "credito" ? m.valor : -m.valor),
    extrato.saldoInicial,
  );

  linha(extrato.banco, "EXTRATO DE CONTA CORRENTE", { fonte: negrito, tam: 16 });
  linha("DOCUMENTO FICTÍCIO PARA DEMONSTRAÇÃO - SEM VALOR", "", { tam: 8, cor: cinza });
  y -= 10;
  linha(`Titular: ${extrato.titular}`, `Período: ${data(extrato.periodo.inicio)} a ${data(extrato.periodo.fim)}`);
  regua();
  linha("Saldo inicial", `R$ ${brl(extrato.saldoInicial)}`);
  y -= 10;
  linha("MOVIMENTAÇÕES", "VALOR (R$)", { fonte: negrito, tam: 9, cor: cinza });
  regua();
  for (const m of extrato.movimentos) {
    linha(`${data(m.data)}   ${m.descricao}`, `${m.tipo === "credito" ? "+" : "-"} ${brl(m.valor)}`);
  }
  regua();
  linha("Saldo final disponível", `R$ ${brl(saldoFinal)}`, { fonte: negrito, tam: 12 });

  writeFileSync(new URL(`../public/exemplos/extrato-${id}.pdf`, import.meta.url), await pdf.save());
  console.log(`public/exemplos/extrato-${id}.pdf`);
}
