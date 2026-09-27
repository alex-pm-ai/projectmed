-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'R1',
    "gatewayId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plano" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "preco" INTEGER NOT NULL,
    "intervalo" TEXT NOT NULL,
    "gatewayId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assinatura" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "gatewaySubId" TEXT,
    "validoAte" TIMESTAMP(3) NOT NULL,
    "canceladaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "metodo" TEXT NOT NULL,
    "gatewayPayId" TEXT NOT NULL,
    "pixQrCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revisao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "grandeArea" TEXT NOT NULL,
    "subArea" TEXT NOT NULL,
    "dataRevisao" TEXT NOT NULL,
    "tempoEstudo" INTEGER NOT NULL DEFAULT 0,
    "questoesFeitas" INTEGER NOT NULL DEFAULT 0,
    "questoesAcertadas" INTEGER NOT NULL DEFAULT 0,
    "aproveitamento" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "proximaRevisao" TEXT,
    "gerarRevisaoInteligente" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revisao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simulado" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ano" TEXT NOT NULL,
    "dataRealizacao" TEXT NOT NULL,
    "tempoGasto" INTEGER NOT NULL DEFAULT 0,
    "questoesTotal" INTEGER NOT NULL,
    "questoesAcertadas" INTEGER NOT NULL,
    "nota" INTEGER NOT NULL,
    "detalhePorArea" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Simulado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarefa" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigAlgoritmo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "faixas" JSONB NOT NULL,

    CONSTRAINT "ConfigAlgoritmo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaSemanal" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "meta" INTEGER NOT NULL DEFAULT 150,

    CONSTRAINT "MetaSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_usuarioId_idx" ON "RefreshToken"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Assinatura_usuarioId_key" ON "Assinatura"("usuarioId");

-- CreateIndex
CREATE INDEX "Assinatura_status_idx" ON "Assinatura"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_gatewayPayId_key" ON "Pagamento"("gatewayPayId");

-- CreateIndex
CREATE INDEX "Pagamento_usuarioId_idx" ON "Pagamento"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_gatewayId_key" ON "WebhookEvent"("gatewayId");

-- CreateIndex
CREATE INDEX "Revisao_usuarioId_dataRevisao_idx" ON "Revisao"("usuarioId", "dataRevisao");

-- CreateIndex
CREATE INDEX "Revisao_usuarioId_status_idx" ON "Revisao"("usuarioId", "status");

-- CreateIndex
CREATE INDEX "Simulado_usuarioId_idx" ON "Simulado"("usuarioId");

-- CreateIndex
CREATE INDEX "Tarefa_usuarioId_idx" ON "Tarefa"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigAlgoritmo_usuarioId_key" ON "ConfigAlgoritmo"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaSemanal_usuarioId_key" ON "MetaSemanal"("usuarioId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assinatura" ADD CONSTRAINT "Assinatura_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assinatura" ADD CONSTRAINT "Assinatura_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "Plano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revisao" ADD CONSTRAINT "Revisao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulado" ADD CONSTRAINT "Simulado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigAlgoritmo" ADD CONSTRAINT "ConfigAlgoritmo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaSemanal" ADD CONSTRAINT "MetaSemanal_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
