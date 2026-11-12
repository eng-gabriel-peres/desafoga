# Sofia

Uma assistente no WhatsApp que organiza seus gastos. Você manda a fatura do cartão, um print das compras ou escreve o que gastou; ela separa por categoria, soma o dia e o mês, mostra quanto foi de juros e IOF e onde dá para economizar.

Projeto do Hack Brasil 2026, trilha Pagamentos & finanças.

## O que faz

- **Lê** fatura em PDF, foto ou print de compras do app do banco, e gastos escritos em texto ("almoço 35 e uber 18,50").
- **Classifica** cada lançamento: mercado, restaurantes, transporte, casa e contas, saúde, educação, lazer, compras, assinaturas.
- **Soma** o dia, o mês e o mês anterior, por categoria, e separa juros, IOF e tarifas dos gastos.
- **Orienta**: quanto custa pagar só o mínimo, qual categoria cortar, quanto guardar por mês a partir da renda.
- **Lembra** do que já anotou e não duplica uma fatura enviada duas vezes.

As respostas são orientação educativa, não recomendação de investimento ou crédito.

## Estado atual

- [x] Base do projeto, CI e fluxo de ambientes
- [x] Chat web e webhook do WhatsApp com a mesma conversa
- [x] Leitura de documentos e mensagens com o Gemini
- [x] Categorias, somas e sugestões calculadas pelo código, com testes
- [ ] Banco de dados (hoje os gastos ficam em arquivo local; na Vercel, só em memória)
- [ ] WhatsApp validado com número real da Meta
- [ ] Limite de uso por visitante

## Rodando localmente

Requisitos: Node 24 e pnpm 11.

```bash
pnpm install
cp .env.example .env.local   # preencha GEMINI_API_KEY
pnpm dev
```

Abra http://localhost:3000 e clique em **Ler fatura de exemplo**.

Outros comandos: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm gerar:faturas`.

## Arquitetura

A regra do projeto: **a IA lê e redige, o código calcula.** O modelo transcreve valores como estão escritos e escolhe a categoria; toda conversão, soma, percentual e sugestão numérica é feita em código testado.

| Camada | Onde | Função |
|---|---|---|
| Canais | `src/app/api` | WhatsApp (API Cloud da Meta) e chat web |
| Leitura | `src/lib/sofia/ler.ts` | Gemini transcreve documentos e interpreta mensagens em formato fixo |
| Contas | `src/lib/sofia/resumo.ts` | Totais por dia, mês e categoria, encargos, poupança |
| Conversa | `src/lib/sofia/sofia.ts` | Orquestra leitura, memória e resposta |
| Memória | `src/lib/sofia/repositorio.ts` | Gastos por pessoa (provisório, sem banco) |

Stack: Next.js 16, TypeScript, Tailwind, Vitest, Gemini, Vercel.

## Contribuindo

Fluxo de branches e ambientes em [CONTRIBUTING.md](CONTRIBUTING.md).

## Dados

Os exemplos do repositório e da demo são fictícios. Arquivos enviados são lidos pelo modelo e não são guardados; os lançamentos lidos ficam até a pessoa escrever "apagar tudo".

## Licença

[MIT](LICENSE)
