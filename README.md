# Desafoga

Mande sua fatura no WhatsApp e descubra quanto de juros você paga e como parar de pagar.

Projeto do Hack Brasil 2026, trilha Pagamentos & finanças. Nome provisório.

## O que faz

- Lê a fatura do cartão enviada no chat (PDF ou foto).
- Mostra quanto foi pago de juros e encargos no mês e a projeção em 12 meses.
- Monta um plano de quitação, da dívida mais cara para a mais barata.
- Responde simulações como "e se eu pagar R$ 200 a mais por mês?".

As respostas são simulações educativas, não recomendação de crédito ou investimento.

## Estado atual

- [x] Base do projeto, CI e fluxo de ambientes
- [x] Motor de juros e simulação de quitação (`src/lib/motor`)
- [x] Três personas fictícias (`fixtures/personas`)
- [x] Webhook do WhatsApp e chat web (respostas por regras, sem IA ainda)
- [x] Leitura de fatura por IA em PDF ou foto (falta validar com chave real)
- [ ] Agente de conversa

## Rodando localmente

Requisitos: Node 24 e pnpm 11.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Outros comandos: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## Arquitetura

| Camada | Função |
|---|---|
| Canais | WhatsApp (API Cloud da Meta) e chat web no mesmo webhook |
| Ingestão | Converte PDF, foto e extrato em transações padronizadas |
| Motor financeiro | Juros, simulações e plano. Código puro com testes, sem IA |
| Agente | Entende a pergunta, chama o motor e redige a resposta |
| Dados | Postgres (Neon) |

Stack: Next.js 16, TypeScript, Tailwind, Vitest, API da Anthropic, Vercel.

## Contribuindo

Fluxo de branches e ambientes em [CONTRIBUTING.md](CONTRIBUTING.md).

## Dados

Todos os dados do repositório e da demo são fictícios.

## Licença

[MIT](LICENSE)
