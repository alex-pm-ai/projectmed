# DALK API

Backend do DALK — **Fastify + Prisma + PostgreSQL**, com autenticação JWT e
camada de **billing/assinatura** provider-agnostic (gate de acesso por pagamento).

## Stack

- **Fastify 5** — HTTP
- **Prisma 6 + PostgreSQL** — dados
- **JWT** (access 1h + refresh 7d com rotação)
- **Zod** — validação na borda
- **PaymentGateway** — interface trocável (mock → Asaas/Stripe/Mercado Pago)

## Estrutura

```
src/
├── server.ts            # bootstrap
├── app.ts               # Fastify, CORS, rate-limit, error handler, rotas
├── shared/              # env, prisma, jwt, errors, middlewares (gate)
└── modules/
    ├── auth/            # register, login, refresh, logout, me
    └── billing/         # planos, checkout, webhook, cancelar
        └── gateway/     # PaymentGateway (interface) + MockGateway
```

## Setup

```bash
# 1. dependências
npm install

# 2. subir o Postgres (Docker)
docker compose up -d

# 3. variáveis de ambiente
cp .env.example .env

# 4. criar as tabelas + gerar o client
npm run prisma:migrate -- --name init
npm run db:seed         # cria os planos Mensal/Anual

# 5. rodar
npm run dev
```

API em `http://localhost:3333`.

## Conceito do gate de acesso

- **Autenticação** (`/auth`): quem é você → JWT.
- **Autorização de acesso** (gate): você pagou e está em dia → `Assinatura.status === 'ativa' && validoAte > agora`.
- A verdade do pagamento vem **do webhook do provedor**, nunca do cliente.

Rotas e proteção:

| Grupo        | Login? | Assinatura? |
|--------------|--------|-------------|
| `/auth/*`    | não*   | não         |
| `/billing/*` | sim**  | **não** (senão ninguém pagaria) |
| `/billing/webhook` | não (provedor) | não |
| `/app/*`     | sim    | **sim** (gate) |

\* exceto `/auth/me`  ·  \** exceto `/billing/planos`

## Fluxo de pagamento

1. `POST /auth/register` ou `/auth/login` → tokens.
2. Usuário cai na paywall → `GET /billing/planos`.
3. `POST /billing/checkout { planoId }` → devolve `pixQrCode` (mock) e cria
   `Assinatura(pendente)` + `Pagamento(pendente)`. **Acesso ainda bloqueado.**
4. Usuário paga → o **provedor** chama `POST /billing/webhook`.
5. Webhook aprova → `Assinatura.status = 'ativa'`, `validoAte = hoje + intervalo`.
6. Front faz polling em `GET /auth/me` até `assinatura.ativa === true` → libera.

### Simular pagamento aprovado (mock)

Pegue o `gatewayPayId` devolvido pelo checkout e poste:

```bash
curl -X POST http://localhost:3333/billing/webhook \
  -H "Content-Type: application/json" \
  -d '{ "tipo": "pagamento.aprovado", "gatewayPayId": "mock_pay_...", "eventId": "evt_1" }'
```

Depois, `GET /app/ping` com o `Bearer <accessToken>` deve passar (200).
Antes de pagar, a mesma rota devolve **402 assinatura_inativa**.

## Trocar o provedor de pagamento

1. Crie `src/modules/billing/gateway/AsaasGateway.ts` implementando `PaymentGateway`.
2. Plugue no `switch` de `gateway/index.ts`.
3. Defina `PAYMENT_PROVIDER=asaas` no `.env`.

Nada mais muda — service, rotas e banco permanecem iguais.

## Próximas etapas

- Migrar domínio (revisoes, simulados, tarefas, config, meta) para `/app/*`.
- Cron diário: marcar revisões `Atrasada` e reconciliar assinaturas `expirada`.
- Trocar `MockGateway` pelo provedor real.
- Conectar o front (trocar `persist` do Zustand por chamadas HTTP).
