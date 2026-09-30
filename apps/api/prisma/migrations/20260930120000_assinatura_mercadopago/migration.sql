-- AlterTable
ALTER TABLE `Assinatura` ADD COLUMN `ativadaEm` DATETIME(3) NULL,
    ADD COLUMN `checkoutUrl` TEXT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Assinatura_gatewaySubId_key` ON `Assinatura`(`gatewaySubId`);

