# Plano — Banco de dados, cadastro e proteção de dados (ProjectMed / Mindfast)

> Status: **proposta para revisão** (2026-09-27). Nada deste plano foi implementado ainda.

## 1. O que já existe hoje (ponto de partida)

O backend em `apps/api` (Fastify + Prisma) já tem:

| Parte | Situação atual |
|---|---|
| Banco | PostgreSQL via Prisma, com tabelas de usuário, sessões, planos, assinaturas, pagamentos, webhooks, revisões, simulados, tarefas, configurações |
| Cadastro/login | Funciona. Senha guardada com **bcrypt** (custo 10), nunca em texto puro |
| Sessão | Access token JWT (1h) + refresh token (7 dias) com **rotação** a cada uso |
| Pagamentos | Estrutura pronta (plano → assinatura → pagamento → webhook), mas só com um gateway **simulado** (`MockGateway`) |
| Acesso ao conteúdo | Rotas `/app/*` exigem login **e** assinatura ativa |
| Dados do app | Revisões, simulados, tarefas etc. já são salvos no banco (não mais no navegador) |

Ou seja: não é "do zero" — é **reforçar e completar**.

## 2. Decisão principal: qual banco, dado que a hospedagem é a Hostinger

Seu plano atual na Hostinger é o **Unlimited Web Hosting** (hospedagem compartilhada). Nele:

- O banco disponível é **MySQL/MariaDB** — **não há PostgreSQL**.
- Aplicações Node.js são suportadas pelo painel (o site da marcenaria já roda como app Node nesse plano), mas **é preciso confirmar** se o plano permite uma API Node rodando continuamente (processo servidor), e não só "buildar" um site.

Opções:

| Opção | Como fica | Prós | Contras |
|---|---|---|---|
| **A. MySQL da Hostinger** (recomendada) | Site + API + banco, tudo na Hostinger | Tudo num lugar só, sem custo extra, backups pelo painel | Precisa adaptar o schema de PostgreSQL → MySQL (pequeno, o Prisma cuida quase tudo) |
| B. PostgreSQL externo (Neon/Supabase, plano gratuito) | Site + API na Hostinger, banco fora | Não muda o schema | Mais um serviço/conta para administrar; latência entre Hostinger e o banco |
| C. VPS Hostinger | Tudo num servidor próprio | Controle total, PostgreSQL | Custo extra e **você** passa a cuidar de atualizações, firewall e segurança do servidor — pesado para quem está começando |

**Recomendação: A.** A troca para MySQL é pequena: ajustar o `provider` no `schema.prisma`, marcar textos longos (ex.: QR Code Pix) como `@db.Text` e recriar as migrations. Localmente você passaria a usar MySQL/MariaDB também, para o ambiente ser igual ao de produção.

## 3. Senhas

| Hoje | Proposta |
|---|---|
| bcrypt, custo 10 | **Argon2id** (padrão atual recomendado pela OWASP) via `@node-rs/argon2` (já vem compilado, funciona em hospedagem compartilhada) |
| Mínimo 6 caracteres | Mínimo **8**, máximo 128; bloquear senhas muito comuns ("12345678", "senha123"…) |
| — | **Migração transparente**: quem tem hash bcrypt antigo continua entrando; no primeiro login bem-sucedido, o hash é refeito em Argon2id |
| Login sem limite próprio | Limite específico no login/cadastro/esqueci-senha (ex.: 5 tentativas/min por IP+e-mail) e bloqueio temporário após várias falhas |
| — | Mensagens genéricas ("e-mail ou senha inválidos") — não revelar se o e-mail existe |

A senha **nunca** é "descriptografada": ela vira um hash de mão única. Nem você, como dono, consegue ver a senha de ninguém.

## 4. Sessões e tokens

| Hoje | Proposta |
|---|---|
| Refresh token salvo **em texto puro** no banco | Salvar só o **hash SHA-256** do token (se o banco vazar, os tokens não servem) |
| Tokens guardados no `localStorage` do navegador | Refresh token em **cookie `httpOnly` + `Secure` + `SameSite`** (JavaScript malicioso não consegue ler). Access token fica só em memória |
| E-mail aceito como veio | Normalizar (minúsculas, sem espaços) antes de salvar/buscar — evita contas duplicadas "Alex@…" e "alex@…" |
| — | "Sair de todos os dispositivos" (revoga todos os refresh tokens) e revogação automática ao trocar a senha |
| Segredos JWT fracos em dev | Em produção: segredos aleatórios de 64 bytes, obrigatórios (a API não sobe sem eles) |

## 5. Dados pessoais dos usuários (LGPD)

**Princípio: guardar o mínimo possível.**

| Dado | Precisa? | Como guardar |
|---|---|---|
| Nome, e-mail | Sim (conta) | Texto normal no banco, protegido pelo acesso ao banco + HTTPS. O e-mail precisa ser buscável para o login |
| Senha | Sim | Só o hash Argon2id |
| CPF | Só se o gateway de pagamento exigir para Pix (Asaas e Mercado Pago costumam exigir) | **Criptografado** no banco (AES-256-GCM) + um "hash de busca" (HMAC) para evitar CPF duplicado sem precisar descriptografar |
| Telefone | Só se for usado | Criptografado, igual ao CPF |
| Cartão de crédito | **Nunca** | Os dados do cartão vão direto para o gateway; guardamos só o ID que ele devolve |
| Dados de estudo (revisões, simulados) | Sim (é o produto) | Normal, sempre filtrados pelo dono (`usuarioId`) |

**Chave de criptografia**: uma variável `DATA_ENCRYPTION_KEY` (32 bytes aleatórios) configurada no painel da Hostinger, **fora do código e fora do GitHub**, com número de versão para permitir trocar a chave no futuro. Se essa chave for perdida, os CPFs criptografados ficam ilegíveis — ela precisa de uma cópia guardada em local seguro (ex.: gerenciador de senhas).

**Direitos do titular (LGPD)**, novos endpoints:
- **Aceite de termos**: guardar data e versão dos Termos/Política de Privacidade aceitos no cadastro.
- **Exportar meus dados**: baixar tudo em JSON.
- **Excluir minha conta**: apaga os dados de estudo e a conta; os **registros de pagamento** são mantidos anonimizados pelo prazo fiscal (≈5 anos), sem nome/e-mail.

## 6. Cadastro — fluxo completo proposto

1. Cadastro (nome, e-mail, senha, aceite dos termos).
2. **Confirmação de e-mail**: envia link com token de uso único (válido 24h). Usando o e-mail da Hostinger (você já tem o *Starter Business Email*) via SMTP.
3. Login só libera o app após e-mail confirmado (ou libera com aviso — a decidir).
4. **Esqueci minha senha**: link de uso único, válido 1h; ao trocar, derruba todas as sessões.
5. Escolha do plano e pagamento (próxima etapa — gateway real).

Tokens de e-mail e de redefinição de senha também são guardados **só como hash**.

## 7. Mudanças no banco (resumo)

```
Usuario
  + email normalizado (único)
  ~ senha → senhaHash (Argon2id; aceita bcrypt legado)
  + emailVerificadoEm       DateTime?
  + cpfCriptografado        String?   (AES-256-GCM)
  + cpfHash                 String? @unique (HMAC, para detectar duplicado)
  + termosAceitosEm         DateTime
  + termosVersao            String
  + tentativasLoginFalhas   Int  @default(0)
  + bloqueadoAte            DateTime?
  + ultimoLoginEm           DateTime?

RefreshToken
  ~ token → tokenHash (SHA-256, único)

TokenUsoUnico (novo)        — confirmação de e-mail e redefinição de senha
  id, usuarioId, tipo (verificar_email | redefinir_senha),
  tokenHash (único), expiraEm, usadoEm

Pagamento
  ~ usuarioId passa a ser opcional (onDelete: SetNull) para manter o
    registro fiscal anonimizado quando a conta é excluída
  ~ pixQrCode → @db.Text

Status em texto livre ("ativa", "pendente"…) → enums do Prisma
```

## 8. Ordem de implementação sugerida (cada etapa = uma branch e um commit revisado)

1. **Banco**: decidir A/B/C; se A, instalar MySQL/MariaDB local e converter o schema.
2. **Senhas**: Argon2id + migração transparente + regras de senha + limites de tentativa.
3. **Sessões**: hash dos refresh tokens + cookie httpOnly + normalização de e-mail.
4. **Criptografia de campos**: utilitário AES-256-GCM + HMAC, com testes.
5. **Cadastro completo**: aceite de termos, confirmação de e-mail, esqueci a senha.
6. **LGPD**: exportar dados e excluir conta.
7. **Pagamentos reais** (Asaas ou Mercado Pago) — plano separado.
8. **Publicação na Hostinger** — plano separado (site estático + API Node + MySQL + HTTPS).

## 9. Perguntas em aberto

- Confirmar a opção de banco (A, B ou C).
- Qual domínio o app vai usar? (o domínio registrado hoje é para a marcenaria ou para o app?)
- Qual gateway de pagamento: Asaas, Mercado Pago ou outro? (define se o CPF é necessário)
- Bloquear o app até o e-mail ser confirmado, ou só mostrar um aviso?
