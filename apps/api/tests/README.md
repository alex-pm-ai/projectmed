# Testes automatizados — DALK API

Testes de integração da API com **Vitest** + `app.inject()` do Fastify
(injeção de requisições em memória — não abre porta de rede).

## Como rodar

```bash
# pré-requisito: Postgres no ar
docker compose up -d

# rodar toda a suíte
npm test

# modo watch
npm run test:watch
```

## Banco de teste isolado

Os testes usam o **mesmo Postgres** do dev, porém em um **schema separado
(`test`)** — assim nunca tocam nos dados de desenvolvimento (`public`).
O `globalSetup` aplica as migrations no schema `test` uma vez; cada caso roda
após um `TRUNCATE` de todas as tabelas (banco limpo a cada teste).

## O que cada arquivo cobre

### `auth.test.ts` — Autenticação
| Teste | Verifica |
|-------|----------|
| registra novo usuário | 201 + access/refresh token; senha nunca é retornada |
| e-mail duplicado | bloqueia cadastro repetido (409) |
| validação de corpo | senha curta é rejeitada (400) |
| login correto | autentica e devolve token (200) |
| login senha errada | rejeita (401) |
| `/auth/me` conta nova | retorna usuário + `assinatura: sem_assinatura` |
| `/auth/me` sem token | exige autenticação (401) |
| refresh válido | gera novo access token |
| refresh inválido | rejeita (401) |

### `billing.test.ts` — Pagamento e gate de acesso
| Teste | Verifica |
|-------|----------|
| lista planos | rota pública `/billing/planos` |
| **gate bloqueia** | `/app/*` sem assinatura ativa → **402** |
| checkout | cria cobrança Pix pendente e **não** libera o acesso |
| **webhook aprova** | pagamento confirmado ativa a assinatura → `/app` passa a **200** |
| idempotência | webhook duplicado é ignorado (`status: duplicado`) |
| estorno | webhook de estorno cancela a assinatura e revoga o acesso |

### `revisoes.test.ts` — Revisões e repetição espaçada
| Teste | Verifica |
|-------|----------|
| criar + listar | revisão criada aparece para o dono |
| **revisão inteligente** | concluir gera automaticamente a próxima pendente; aproveitamento calculado (9/10 = 90%) |
| inteligente desligada | `gerarRevisaoInteligente: false` não gera próxima |
| redistribuir | atrasadas são movidas para datas futuras |
| deletar | remove a revisão (204) |
| **isolamento** | um usuário não vê nem deleta revisão de outro (404) |

### `conteudo.test.ts` — Tarefas, Config, Meta e Simulados
| Teste | Verifica |
|-------|----------|
| tarefas CRUD | criar, alternar concluída, deletar |
| limpar concluídas | apaga só as tarefas marcadas como feitas |
| config padrão | retorna as 11 faixas padrão quando não personalizado |
| config persiste | salvar faixas customizadas e recuperá-las |
| meta padrão/update | padrão 150 e atualização persistida |
| simulados | criar com detalhe por área e listar |

## Cobertura de segurança embutida

- **Autorização por login** (JWT) — rotas protegidas exigem token válido.
- **Autorização por pagamento** (gate) — `/app/*` exige assinatura ativa.
- **Isolamento entre usuários** — cada um só acessa os próprios dados.
- **Idempotência de webhook** — pagamentos não são processados em dobro.
