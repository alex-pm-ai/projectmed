-- AlterTable
ALTER TABLE `Revisao` ADD COLUMN `origem` VARCHAR(191) NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE `Usuario` ADD COLUMN `areasIniciadasEm` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `Area` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `cor` VARCHAR(191) NOT NULL DEFAULT '#a3a3a3',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Area_usuarioId_nome_key`(`usuarioId`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conteudo` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `areaId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Conteudo_usuarioId_idx`(`usuarioId`),
    UNIQUE INDEX `Conteudo_areaId_nome_key`(`areaId`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Revisao_usuarioId_origem_idx` ON `Revisao`(`usuarioId`, `origem`);

-- AddForeignKey
ALTER TABLE `Area` ADD CONSTRAINT `Area_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conteudo` ADD CONSTRAINT `Conteudo_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conteudo` ADD CONSTRAINT `Conteudo_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `Area`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

