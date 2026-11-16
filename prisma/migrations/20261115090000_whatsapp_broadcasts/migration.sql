-- WhatsApp templates and broadcasts (Admin → Chatbot → Templates / Broadcasts).
-- Additive only: creates three new tables and touches no existing table, column
-- or row. Table names are written in the exact case Prisma uses, so this runs on
-- case-sensitive (Linux) MySQL / MariaDB as well as on Windows.

-- CreateTable
CREATE TABLE `WhatsappTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `metaName` VARCHAR(191) NOT NULL,
    `metaId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `languageCode` VARCHAR(191) NOT NULL DEFAULT 'en',
    `category` ENUM('MARKETING', 'UTILITY', 'AUTHENTICATION') NOT NULL DEFAULT 'UTILITY',
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED') NOT NULL DEFAULT 'PENDING',
    `body` TEXT NOT NULL,
    `headerText` VARCHAR(191) NULL,
    `headerFormat` VARCHAR(191) NULL,
    `footerText` VARCHAR(191) NULL,
    `buttons` JSON NULL,
    `components` JSON NULL,
    `variables` JSON NOT NULL,
    `rejectedReason` TEXT NULL,
    `qualityScore` VARCHAR(191) NULL,
    `syncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WhatsappTemplate_metaId_key`(`metaId`),
    INDEX `WhatsappTemplate_status_idx`(`status`),
    UNIQUE INDEX `WhatsappTemplate_metaName_languageCode_key`(`metaName`, `languageCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Broadcast` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `audience` JSON NULL,
    `templateId` VARCHAR(191) NULL,
    `templateName` VARCHAR(191) NULL,
    `languageCode` VARCHAR(191) NULL,
    `headerMediaUrl` VARCHAR(2048) NULL,
    `parameters` JSON NULL,
    `scheduledAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `recipients` INTEGER NOT NULL DEFAULT 0,
    `sent` INTEGER NOT NULL DEFAULT 0,
    `delivered` INTEGER NOT NULL DEFAULT 0,
    `readCount` INTEGER NOT NULL DEFAULT 0,
    `failed` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Broadcast_reference_key`(`reference`),
    INDEX `Broadcast_status_idx`(`status`),
    INDEX `Broadcast_createdAt_idx`(`createdAt`),
    INDEX `Broadcast_templateId_idx`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BroadcastRecipient` (
    `id` VARCHAR(191) NOT NULL,
    `broadcastId` VARCHAR(191) NOT NULL,
    `contactId` VARCHAR(191) NULL,
    `waId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `parameters` JSON NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `messageId` VARCHAR(191) NULL,
    `error` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BroadcastRecipient_messageId_key`(`messageId`),
    INDEX `BroadcastRecipient_broadcastId_status_idx`(`broadcastId`, `status`),
    INDEX `BroadcastRecipient_contactId_idx`(`contactId`),
    UNIQUE INDEX `BroadcastRecipient_broadcastId_waId_key`(`broadcastId`, `waId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Broadcast` ADD CONSTRAINT `Broadcast_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `WhatsappTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BroadcastRecipient` ADD CONSTRAINT `BroadcastRecipient_broadcastId_fkey` FOREIGN KEY (`broadcastId`) REFERENCES `Broadcast`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BroadcastRecipient` ADD CONSTRAINT `BroadcastRecipient_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `WhatsappContact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

