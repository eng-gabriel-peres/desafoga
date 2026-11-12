# Luana

Uma assistente no WhatsApp que organiza seus gastos. Você manda a fatura do cartão, um print das compras ou escreve o que gastou; ela separa por categoria, soma o dia e o mês, mostra quanto foi de juros e IOF e onde dá para economizar.

Projeto do Hack Brasil 2026, trilha Pagamentos & finanças.

**Demo:** https://desafoga-nine.vercel.app

## O que faz

- **Lê** fatura de cartão e extrato de conta em PDF, foto ou print de compras do app do banco, e gastos escritos em texto ("almoço 35 e uber 18,50").
- **Classifica** cada lançamento: mercado, restaurantes, transporte, casa e contas, saúde, educação, lazer, compras, assinaturas.
- **Soma** o dia, o mês e o mês anterior, por categoria; mostra quanto entrou, quanto saiu e quanto sobrou; separa juros, IOF e tarifas dos gastos.
- **Orienta**: quanto custa pagar só o mínimo, qual categoria cortar, quanto guardar por mês a partir da renda.
- **Ouve** mensagem de voz: você conta o que gastou ou pergunta por áudio.
- **Responde "posso comprar?"**: compara a parcela com a sua renda e as suas contas e mostra a conta feita.
- **Mostra um painel**: toque no nome da Luana para ver entradas, saídas e categorias de cada mês e os documentos enviados.
- **Lembra** do que já anotou e não duplica uma fatura enviada duas vezes.

As respostas são orientação educativa, não recomendação de investimento ou crédito.

## Estado atual

- [x] Base do projeto, CI e fluxo de ambientes
- [x] Chat web e webhook do WhatsApp com a mesma conversa
- [x] Leitura de documentos e mensagens com o Gemini
- [x] Categorias, somas e sugestões calculadas pelo código, com testes
- [x] Banco de dados (Postgres no Neon; sem `DATABASE_URL`, arquivo local para desenvolver)
- [x] Vercel e Neon conectados ao repositório
- [ ] WhatsApp validado com número real da Meta
- [ ] Limite de uso por visitante

## Rodando localmente

Requisitos: Node 24 e pnpm 11.

```bash
pnpm install
cp .env.example .env.local   # preencha GEMINI_API_KEY; DATABASE_URL é opcional
pnpm dev
```

Abra http://localhost:3000 e clique em **Ler fatura de exemplo**.

Outros comandos: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm gerar:faturas`.

## Arquitetura

A regra do projeto: **a IA lê e redige, o código calcula.** O modelo transcreve valores como estão escritos e escolhe a categoria; toda conversão, soma, percentual e sugestão numérica é feita em código testado.

| Camada | Onde | Função |
|---|---|---|
| Canais | `src/app/api` | WhatsApp (API Cloud da Meta) e chat web |
| Leitura | `src/lib/luana/ler.ts` | Gemini transcreve documentos e interpreta mensagens em formato fixo |
| Contas | `src/lib/luana/resumo.ts` | Totais por dia, mês e categoria, encargos, poupança |
| Conversa | `src/lib/luana/luana.ts` | Orquestra leitura, memória e resposta |
| Memória | `src/lib/luana/repositorio.ts` | Gastos por pessoa no Postgres (tabela `contas`, criada sozinha) |

Stack: Next.js 16, TypeScript, Tailwind, Vitest, Gemini, Postgres (Neon), Vercel.

## Contribuindo

Fluxo de branches e ambientes em [CONTRIBUTING.md](CONTRIBUTING.md).

## Dados

Os exemplos do repositório e da demo são fictícios. Arquivos enviados são lidos pelo modelo e não são guardados; os lançamentos lidos ficam até a pessoa escrever "apagar tudo".

## Licença

[MIT](LICENSE)
