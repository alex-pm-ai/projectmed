# Fluxos de contratação, vínculo com o Mercado Pago e conta do usuário

> Status: **proposta para revisão** (2026-09-30). Nada deste documento foi implementado ainda.
> Relacionados: [PLANO-BANCO-E-SEGURANCA.md](PLANO-BANCO-E-SEGURANCA.md), [TERMOS-DE-USO.md](TERMOS-DE-USO.md).

---

## 1. Princípio que simplifica tudo

**O vínculo com o pagamento é feito pelo nosso ID interno do usuário, nunca pelo e-mail nem pelo CPF.**

| Onde | O que guarda | Muda algum dia? |
|---|---|---|
| Nosso banco — `Usuario.id` | ID interno (ex.: `cmukgzk3b...`) | **Nunca** |
| Nosso banco — `Assinatura.gatewaySubId` | ID da assinatura no Mercado Pago (`preapproval_id`) | Só se a pessoa assinar de novo |
| Mercado Pago — `external_reference` da assinatura | O nosso `Usuario.id` | **Nunca** |
| Mercado Pago — `payer_email` | E-mail da conta no momento da contratação | Não importa para o vínculo |

Consequências (menos trabalho para nós):
- **Trocar e-mail ou senha não mexe em nada do pagamento** — o elo é o ID.
- **Não guardamos CPF nem cartão.** O Mercado Pago coleta os dados do titular na página de pagamento dele. Menos dado sensível = menos obrigação de LGPD e nenhuma criptografia extra para manter.
- **Não precisamos criar "cliente" no Mercado Pago** (a etapa `criarCliente` do código atual fica dispensada). A assinatura já carrega tudo.
- Todo aviso (webhook) do Mercado Pago traz o `external_reference` ou o `preapproval_id` → achamos o usuário direto, sem busca por e-mail.

> ⚠️ **A validar no teste:** o Mercado Pago exige um `payer_email` ao criar a assinatura. Em algumas contas ele exige que quem paga use uma conta Mercado Pago com **esse mesmo e-mail**. Se isso acontecer no teste, adicionamos na tela de assinatura um campo opcional "E-mail da sua conta Mercado Pago" (pré-preenchido com o e-mail do cadastro). O vínculo continua sendo o ID.

---

## 2. Cenário: contratação (cadastro → pagamento → acesso liberado)

### 2.1 Caminho feliz

```
Site (/planos) ──► escolhe plano ──► Cadastro ──► Pagamento no Mercado Pago ──► volta ao app ──► acesso liberado ──► e-mail de boas-vindas
```

1. **Visitante escolhe o plano** em `/planos` (Mensal ou Anual).
2. **Cadastro** (`/login?modo=register&plano=...`):
   - nome, e-mail, senha;
   - ☑ **obrigatório:** "Li e aceito os [Termos de Uso] e a [Política de Privacidade]" → gravamos `termosAceitosEm` + `termosVersao`;
   - ☐ **opcional:** "Quero receber dicas de estudo e novidades por e-mail" → gravamos o consentimento de marketing (LGPD exige que seja separado e opcional).
   - A conta é criada **sem acesso** ao conteúdo (assinatura inexistente).
3. **Tela "Assinar"** mostra o plano escolhido, o valor, "renova automaticamente, cancele quando quiser" e o botão **"Pagar com cartão no Mercado Pago"**.
4. **Backend cria a assinatura no Mercado Pago** (`POST /preapproval`, status `pending`) com:
   - `external_reference` = nosso `Usuario.id`;
   - `payer_email` = e-mail do cadastro;
   - `reason` = "Mindfast — Plano Mensal";
   - `auto_recurring` = valor do plano, frequência (1 mês / 12 meses), moeda BRL;
   - `back_url` = `https://<domínio>/app/assinatura/retorno`.
   - Guardamos `Assinatura(status=pendente, gatewaySubId=<id>)`.
   - O Mercado Pago devolve o link da página de pagamento (`init_point`).
5. **Pessoa paga com cartão na página do Mercado Pago** (nosso app nunca vê o cartão).
6. **Mercado Pago redireciona de volta** para `/app/assinatura/retorno`.
7. **Backend confirma direto na API do Mercado Pago** (`GET /preapproval/{id}`) — não confiamos em parâmetros da URL:
   - `authorized` → `Assinatura.status = ativa`, `validoAte = próxima data de cobrança` → **acesso liberado**;
   - ainda processando → tela "Estamos confirmando seu pagamento…" que consulta de novo a cada poucos segundos.
8. **E-mail de boas-vindas** é enviado na primeira vez que a assinatura vira `ativa` (ver seção 4).

Em produção, o **webhook** do Mercado Pago (`subscription_preapproval` e `subscription_authorized_payment`) faz a mesma confirmação do passo 7 em segundo plano — é ele que garante o status mesmo se a pessoa fechar o navegador antes de voltar ao app.

### 2.2 Desvios

| Situação | O que acontece |
|---|---|
| Cartão recusado na página do MP | A própria página do MP avisa e deixa tentar outro cartão. Se a pessoa desistir, volta ao app sem acesso, com o botão "Tentar novamente". |
| Pessoa fecha a página sem pagar | Assinatura fica `pendente`. Ao entrar de novo no app, vê a tela "Assinar" (reaproveitamos a assinatura pendente ou criamos outra). |
| Pessoa já tem conta e assinatura ativa | Não vê a tela de assinar; vai direto ao app. |
| Master (admin) | Continua entrando sem assinatura. |

### 2.3 Renovação e inadimplência

Regra simples que **não exige lógica extra**: o acesso vale até `validoAte` (fim do período pago). O bloqueio já existente no servidor olha essa data.

| Evento do Mercado Pago | Nosso efeito |
|---|---|
| Cobrança da renovação aprovada | `validoAte` avança para o fim do novo período |
| Cobrança recusada | Nada muda na hora. O MP faz **até 4 novas tentativas numa janela de ~10 dias**. Se nenhuma aprovar até `validoAte`, o acesso **bloqueia sozinho**; se uma aprovar depois, **libera sozinho** |
| 3 parcelas seguidas recusadas | O MP **cancela a assinatura automaticamente** → marcamos `cancelada`; para voltar, a pessoa assina de novo |
| Cartão vencido/desatualizado | O MP pode pausar a assinatura → mostramos no app "Atualize seu cartão" com link para o MP |

E-mails automáticos nesses eventos (seção 4): "pagamento recusado — atualize seu cartão" e "sua assinatura foi cancelada".

### 2.4 Cancelamento e arrependimento

- **Cancelar** (área "Minha assinatura"): cancelamos no MP; o acesso **continua até o fim do período já pago** e não renova.
- **Direito de arrependimento (7 dias, art. 49 do CDC):** cancelamento nos primeiros 7 dias da contratação → **reembolso integral** (estorno pelo MP) e bloqueio imediato. Fica previsto nos Termos de Uso.

---

## 3. Cenário: esqueci a senha / troca de e-mail (sem perder o vínculo)

Como o pagamento está ligado ao `Usuario.id`, **nenhum destes fluxos toca na assinatura**.

### 3.1 Esqueci minha senha

1. Tela "Esqueci minha senha" → pessoa digita o e-mail.
2. Resposta **sempre igual**: "Se houver uma conta com esse e-mail, enviamos um link" (não revela quem tem conta).
3. Se existir, enviamos link de **uso único, válido por 1 hora** (tabela `TokenUsoUnico`, já criada, guarda só o hash).
4. Pessoa define a nova senha (mesmas regras do cadastro).
5. **Todas as sessões abertas são encerradas** e enviamos o aviso "Sua senha foi alterada — se não foi você, fale conosco".
6. Assinatura: **inalterada**.

### 3.2 Troca de e-mail (dentro do app, logado)

1. "Minha conta" → "Alterar e-mail" → pede o **novo e-mail + senha atual**.
2. Enviamos link de confirmação para o **novo** e-mail (uso único, 24 h) e um aviso para o **antigo** ("pediram para trocar o e-mail desta conta — se não foi você, altere sua senha").
3. Ao clicar no link, o e-mail muda. Até lá, o antigo continua valendo.
4. Assinatura: **inalterada** — o Mercado Pago continua ligado pelo ID.
5. Observação para o usuário: recibos de cobrança são enviados pelo **Mercado Pago** para o e-mail da conta Mercado Pago dele — isso é gerenciado no próprio Mercado Pago.

### 3.3 Perdeu acesso ao e-mail antigo

Atendimento manual pelo suporte (usuário master): confirma a identidade (ex.: últimos dígitos do cartão e data da contratação, vistos no painel do MP) e altera o e-mail. Uma tela de administração para isso pode vir depois.

---

## 4. E-mails (boas-vindas e demais)

### 4.1 Como enviar — recomendação

| Tipo | Exemplos | Como |
|---|---|---|
| **Transacionais** (obrigatórios para o serviço funcionar) | boas-vindas, confirmar e-mail, redefinir senha, troca de e-mail, pagamento recusado, assinatura cancelada | **SMTP do e-mail profissional da Hostinger** (ex.: `contato@<domínio-do-app>`), com modelos HTML no visual Mindfast |
| **Marketing** (novidades, dicas, promoções) | newsletters | Ferramenta de e-mail marketing — só para quem marcou o consentimento opcional. Pode ficar para depois |

- O **Hostinger Reach** (e-mail marketing da Hostinger) **não está ativo na sua conta** hoje (verificado pela API). Se contratar depois, o boas-vindas pode virar uma automação editável sem programador.
- O e-mail profissional que você tem hoje (Starter Business Email) precisa estar **no domínio do app** para os e-mails não caírem no spam — a definir quando o domínio for comprado (configuramos SPF/DKIM/DMARC).

### 4.2 E-mail de boas-vindas

- **Quando:** na primeira vez que a assinatura vira `ativa` (guardamos `boasVindasEnviadoEm` para nunca enviar duas vezes, mesmo se o webhook chegar repetido).
- **Conteúdo sugerido** (estilo e-mail marketing, com a identidade visual):
  - Assunto: "Bem-vindo(a) à Mindfast, {nome}! Seu plano {Mensal/Anual} está ativo 🎯"
  - Saudação + o que dá para fazer primeiro: 1) configurar o algoritmo de revisão, 2) montar o cronograma no Foco Prova, 3) registrar o primeiro estudo.
  - Botão "Começar agora" → `/app`.
  - Resumo do plano: valor, próxima cobrança, "cancele quando quiser em Minha assinatura".
  - Rodapé: contato de suporte, links dos Termos e da Política de Privacidade.

---

## 5. O que muda no sistema (resumo técnico)

| Parte | Mudança |
|---|---|
| Banco | `Usuario`: `consentimentoMarketingEm`, `boasVindasEnviadoEm`, `emailPendente` (troca de e-mail). `TokenUsoUnico.tipo` ganha `trocar_email`. Os campos de termos já existem |
| Backend | `MercadoPagoGateway` (criar/consultar/cancelar assinatura, validar webhook com a chave secreta do MP); rota `/billing/retorno`; rotas de esqueci senha, redefinir, trocar e-mail; envio de e-mails (SMTP + modelos) |
| Frontend | Cadastro com os dois checkboxes; tela Assinar com botão do MP; tela de retorno; "Minha conta" (e-mail/senha) e "Minha assinatura" (status, próxima cobrança, cancelar); telas de esqueci/redefinir senha; páginas públicas de Termos e Privacidade |
| Configuração (`.env`) | `MERCADOPAGO_ACCESS_TOKEN` (✔ já está), `MERCADOPAGO_WEBHOOK_SECRET` (na publicação), `APP_URL`, dados SMTP |

## 6. Ordem sugerida

1. Termos de Uso + Política de Privacidade (texto) e aceite no cadastro.
2. Integração Mercado Pago: contratação, retorno, renovação/inadimplência, cancelamento — testada com cartões de teste.
3. Envio de e-mail (SMTP) + boas-vindas.
4. Esqueci a senha e troca de e-mail.
5. Webhooks em produção (junto com a publicação na Hostinger).

## 7. Decisões pendentes

- Nome da empresa/responsável, CNPJ ou CPF do titular, e-mail de suporte e cidade/UF — para completar os Termos.
- Domínio do app (para e-mail e para o endereço de retorno do Mercado Pago).
- Oferecer **período grátis** (ex.: 7 dias)? O Mercado Pago suporta `free_trial` nativamente.
