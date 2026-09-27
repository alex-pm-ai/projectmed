# DALK — Documentação do Backend

> Stack recomendada: **Node.js + Fastify + Prisma + PostgreSQL**  
> Auth: **JWT (access token 1h + refresh token 7d)**  
> Deploy: **Railway (API + PostgreSQL)**

---

## Schema do banco (Prisma)

```prisma
model Usuario {
  id        String   @id @default(cuid())
  nome      String
  email     String   @unique
  senha     String
  tipo      String   @default("R1")
  createdAt DateTime @default(now())

  revisoes        Revisao[]
  simulados       Simulado[]
  tarefas         Tarefa[]
  configAlgoritmo ConfigAlgoritmo?
  metaSemanal     MetaSemanal?
}

model Revisao {
  id                      String   @id @default(cuid())
  usuarioId               String
  tipo                    String   // Questoes | Flashcards | Aula | Simulado
  grandeArea              String
  subArea                 String
  dataRevisao             String   // YYYY-MM-DD
  tempoEstudo             Int      @default(0)
  questoesFeitas          Int      @default(0)
  questoesAcertadas       Int      @default(0)
  aproveitamento          Int      @default(0)
  status                  String   // Pendente | Concluída | Atrasada
  proximaRevisao          String?
  gerarRevisaoInteligente Boolean  @default(true)
  createdAt               DateTime @default(now())

  usuario Usuario @relation(fields: [usuarioId], references: [id])
}

model Simulado {
  id                String   @id @default(cuid())
  usuarioId         String
  titulo            String
  ano               String
  dataRealizacao    String
  tempoGasto        Int      @default(0)
  questoesTotal     Int
  questoesAcertadas Int
  nota              Int
  detalhePorArea    Json     // DetalheAreaSimulado[]
  createdAt         DateTime @default(now())

  usuario Usuario @relation(fields: [usuarioId], references: [id])
}

model Tarefa {
  id        String   @id @default(cuid())
  usuarioId String
  texto     String
  concluida Boolean  @default(false)
  createdAt DateTime @default(now())

  usuario Usuario @relation(fields: [usuarioId], references: [id])
}

model ConfigAlgoritmo {
  id        String @id @default(cuid())
  usuarioId String @unique
  faixas    Json   // FaixaAlgoritmo[]

  usuario Usuario @relation(fields: [usuarioId], references: [id])
}

model MetaSemanal {
  id        String @id @default(cuid())
  usuarioId String @unique
  meta      Int    @default(150)

  usuario Usuario @relation(fields: [usuarioId], references: [id])
}
```

---

## Rotas da API

### Auth

| Método | Rota              | Descrição                        |
|--------|-------------------|----------------------------------|
| POST   | /auth/register    | Cadastro de novo usuário         |
| POST   | /auth/login       | Login, retorna access + refresh  |
| POST   | /auth/refresh     | Gera novo access token           |
| POST   | /auth/logout      | Invalida refresh token           |
| GET    | /auth/me          | Dados do usuário autenticado     |
| PATCH  | /auth/me          | Atualizar nome, tipo, senha      |

**Body POST /auth/register:**
```json
{ "nome": "João", "email": "joao@email.com", "senha": "senha123", "tipo": "R1" }
```

**Response POST /auth/login:**
```json
{ "accessToken": "...", "refreshToken": "...", "usuario": { "id": "...", "nome": "...", "tipo": "..." } }
```

---

### Revisões

> Todas protegidas por JWT (`Authorization: Bearer <token>`)

| Método | Rota                          | Descrição                                         |
|--------|-------------------------------|---------------------------------------------------|
| GET    | /revisoes                     | Listar todas as revisões do usuário               |
| GET    | /revisoes?status=Pendente     | Filtrar por status                                |
| GET    | /revisoes?area=Pediatria      | Filtrar por grande área                           |
| GET    | /revisoes?from=2026-06-01&to=2026-06-30 | Filtrar por período                   |
| POST   | /revisoes                     | Criar nova revisão (+ gerar pendente inteligente) |
| PATCH  | /revisoes/:id                 | Atualizar revisão                                 |
| DELETE | /revisoes/:id                 | Deletar revisão                                   |
| POST   | /revisoes/:id/concluir        | Concluir revisão pendente com performance         |
| POST   | /revisoes/redistribuir        | Redistribuir todas as revisões atrasadas          |

**Body POST /revisoes:**
```json
{
  "tipo": "Questoes",
  "grandeArea": "Pediatria",
  "subArea": "ITU",
  "dataRevisao": "2026-06-15",
  "tempoEstudo": 45,
  "questoesFeitas": 12,
  "questoesAcertadas": 10,
  "gerarRevisaoInteligente": true
}
```

**Body POST /revisoes/:id/concluir:**
```json
{ "questoesFeitas": 12, "questoesAcertadas": 10, "tempoEstudo": 45 }
```

**Response POST /revisoes (com gerarRevisaoInteligente: true):**
```json
{
  "revisaoConcluida": { ... },
  "proximaRevisaoAgendada": { "id": "...", "dataRevisao": "2026-07-01", "status": "Pendente" }
}
```

---

### Simulados

| Método | Rota              | Descrição                     |
|--------|-------------------|-------------------------------|
| GET    | /simulados        | Listar todos os simulados     |
| POST   | /simulados        | Criar novo simulado           |
| PATCH  | /simulados/:id    | Atualizar simulado            |
| DELETE | /simulados/:id    | Deletar simulado              |

**Body POST /simulados:**
```json
{
  "titulo": "ENAMED",
  "ano": "2026",
  "dataRealizacao": "2026-05-27",
  "tempoGasto": 150,
  "questoesTotal": 100,
  "questoesAcertadas": 71,
  "detalhePorArea": [
    { "area": "Clínica Médica", "acertos": 24, "total": 40 },
    { "area": "Pediatria", "acertos": 22, "total": 40 }
  ]
}
```

---

### Tarefas

| Método | Rota                      | Descrição                          |
|--------|---------------------------|------------------------------------|
| GET    | /tarefas                  | Listar todas as tarefas            |
| POST   | /tarefas                  | Criar nova tarefa                  |
| PATCH  | /tarefas/:id              | Atualizar tarefa (texto, concluida)|
| DELETE | /tarefas/:id              | Deletar tarefa                     |
| DELETE | /tarefas/concluidas       | Deletar todas as concluídas        |

---

### Configuração do Algoritmo

| Método | Rota           | Descrição                           |
|--------|----------------|-------------------------------------|
| GET    | /config        | Buscar config atual do usuário      |
| PUT    | /config        | Salvar/atualizar config completa    |

**Body PUT /config:**
```json
{
  "faixas": [
    { "min": 0,  "max": 29,  "dias": 1,  "label": "Atenção" },
    { "min": 30, "max": 39,  "dias": 3,  "label": "Atenção" },
    { "min": 40, "max": 49,  "dias": 4,  "label": "Atenção" },
    { "min": 50, "max": 54,  "dias": 5,  "label": "Atenção" },
    { "min": 55, "max": 59,  "dias": 7,  "label": "Atenção" },
    { "min": 60, "max": 64,  "dias": 14, "label": "Bom" },
    { "min": 65, "max": 69,  "dias": 18, "label": "Bom" },
    { "min": 70, "max": 74,  "dias": 22, "label": "Bom" },
    { "min": 75, "max": 79,  "dias": 26, "label": "Bom" },
    { "min": 80, "max": 89,  "dias": 35, "label": "Excelente" },
    { "min": 90, "max": 100, "dias": 45, "label": "Excelente" }
  ]
}
```

---

### Meta Semanal

| Método | Rota   | Descrição               |
|--------|--------|-------------------------|
| GET    | /meta  | Buscar meta do usuário  |
| PUT    | /meta  | Atualizar meta          |

---

### Analytics (endpoints de leitura)

| Método | Rota                     | Descrição                                         |
|--------|--------------------------|---------------------------------------------------|
| GET    | /analytics/dashboard     | Dados do dashboard: stats semana, calendar semana |
| GET    | /analytics/desempenho    | Acurácia geral, horas totais, questões totais     |
| GET    | /analytics/por-area      | Questões e tempo agrupados por grande área        |
| GET    | /analytics/streak        | Número de dias consecutivos estudados             |
| GET    | /analytics/semana        | Questões/tempo por dia dos últimos 7 dias         |
| GET    | /analytics/mes           | Questões/tempo por semana do mês atual            |

---

## Middlewares

```
POST /auth/register  → validateBody → hash password → createUser → issueTokens
POST /auth/login     → validateBody → findUser → compareHash → issueTokens
*todas as demais*    → verifyJWT → attachUser → handler
```

---

## Lógica de negócio (backend)

### calcularProximaRevisao
```typescript
function calcularProximaRevisao(aproveitamento: number, dataRevisao: string, faixas: FaixaAlgoritmo[]): string {
  const faixa = faixas.find(f => aproveitamento >= f.min && aproveitamento <= f.max);
  const dias = faixa?.dias ?? 7;
  const data = new Date(dataRevisao + 'T12:00:00');
  data.setDate(data.getDate() + dias);
  return data.toISOString().split('T')[0];
}
```

### redistribuirAtrasadas
Pega todas as revisões com `status IN ('Pendente', 'Atrasada')` e `dataRevisao < TODAY`.  
Distribui a partir de amanhã em grupos de `Math.ceil(total / 7)` revisões por dia.

### Job de atualização de status
Rodar diariamente (cron) ou sob demanda:
- `UPDATE revisoes SET status = 'Atrasada' WHERE status = 'Pendente' AND dataRevisao < NOW() AND usuarioId = ?`

---

## Variáveis de ambiente

```env
DATABASE_URL=postgresql://user:pass@host:5432/dalk
JWT_SECRET=sua_chave_secreta_aqui
JWT_REFRESH_SECRET=outra_chave_secreta
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
NODE_ENV=production
```

---

## Migração do localStorage para o backend

Na migração, o frontend deve:
1. Ao logar, fazer `GET /revisoes`, `GET /simulados`, `GET /tarefas`, `GET /config`, `GET /meta`
2. Popular o store Zustand com os dados retornados (substituindo o persist do localStorage)
3. Trocar todas as actions do store por chamadas à API (manter a mesma interface de funções)
4. O campo `_seeded` e os dados de seed são eliminados — o backend provê os dados reais

A interface do store permanece idêntica; apenas a camada de persistência muda de `localStorage` para chamadas HTTP.
```
