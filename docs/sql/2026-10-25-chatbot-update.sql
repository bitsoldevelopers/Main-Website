-- BITSOL Marketing: database update for the chatbot (25 October 2026)
--
-- Adds the tables the Admin → Chatbot module needs: conversations, messages,
-- events, the knowledge base, Chatbot Studio settings, lead profiles,
-- tickets & meetings and WhatsApp contacts. It only ADDS: no existing table,
-- column or row is changed or deleted.
--
-- HOW TO APPLY (hPanel > Databases > phpMyAdmin > the website's database)
--   1. Export tab > Go.            Keep the downloaded file: it is your backup.
--   2. Import tab > choose this file > Go.
--   3. Apply it ONCE. If phpMyAdmin stops with an error, do not run it again:
--      copy the error message and send it over.
--
-- Contains: 20261025120000_chatbot
--
-- The website keeps working before this is applied: the chat answers and
-- the admin panel shows "database unreachable" only inside Admin → Chatbot.

SET NAMES utf8mb4;

-- Prisma's record of which migrations were applied.
INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT '5d615cb8-a317-4463-a14f-606996d476a8', 'dd9324a0ab2671cee7a046d39bde832dca0b8241d8cecdaf2de375489ad429dc', NOW(3), '20261025120000_chatbot', NULL, NULL, NOW(3), 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20261025120000_chatbot');

-- ========================================================================
-- 20261025120000_chatbot
-- ========================================================================

-- Chatbot: conversations, knowledge base, Chatbot Studio configuration,
-- lead profiles, tickets & meetings, WhatsApp contacts.
-- Additive only: creates new tables and touches no existing table, column or
-- row. Table names are written in the exact case Prisma uses, so this runs on
-- case-sensitive (Linux) MySQL / MariaDB as well as on Windows.

-- CreateTable
CREATE TABLE `ChatbotSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `description` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatConversation` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL DEFAULT 'WEB',
    `title` VARCHAR(191) NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'EN',
    `contactPhone` VARCHAR(191) NULL,
    `contactName` VARCHAR(191) NULL,
    `capture` JSON NULL,
    `handedOff` BOOLEAN NOT NULL DEFAULT false,
    `handedOffAt` DATETIME(3) NULL,
    `handoverTeam` VARCHAR(191) NULL,
    `botPaused` BOOLEAN NOT NULL DEFAULT false,
    `trafficSource` VARCHAR(191) NULL,
    `campaign` VARCHAR(191) NULL,
    `adId` VARCHAR(191) NULL,
    `referral` JSON NULL,
    `rating` INTEGER NULL,
    `leadId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChatConversation_reference_key`(`reference`),
    INDEX `ChatConversation_channel_contactPhone_updatedAt_idx`(`channel`, `contactPhone`, `updatedAt`),
    INDEX `ChatConversation_createdAt_idx`(`createdAt`),
    INDEX `ChatConversation_updatedAt_idx`(`updatedAt`),
    INDEX `ChatConversation_handedOff_idx`(`handedOff`),
    INDEX `ChatConversation_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `language` VARCHAR(191) NULL,
    `latencyMs` INTEGER NULL,
    `externalId` VARCHAR(191) NULL,
    `authorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChatMessage_externalId_key`(`externalId`),
    INDEX `ChatMessage_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatEvent` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL DEFAULT 'WEB',
    `conversationId` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NULL,
    `intent` VARCHAR(191) NULL,
    `team` VARCHAR(191) NULL,
    `value` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatEvent_type_createdAt_idx`(`type`, `createdAt`),
    INDEX `ChatEvent_channel_createdAt_idx`(`channel`, `createdAt`),
    INDEX `ChatEvent_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatKnowledge` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'FAQ',
    `category` VARCHAR(191) NOT NULL,
    `question` TEXT NOT NULL,
    `answer` TEXT NOT NULL,
    `keywords` JSON NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'EN',
    `state` VARCHAR(191) NOT NULL DEFAULT 'PUBLISHED',
    `version` INTEGER NOT NULL DEFAULT 1,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChatKnowledge_slug_key`(`slug`),
    INDEX `ChatKnowledge_category_idx`(`category`),
    INDEX `ChatKnowledge_state_idx`(`state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatLeadProfile` (
    `leadId` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NULL,
    `score` INTEGER NOT NULL DEFAULT 0,
    `temperature` VARCHAR(191) NOT NULL DEFAULT 'COLD',
    `scoreReasons` JSON NOT NULL,
    `intent` VARCHAR(191) NULL,
    `serviceSlug` VARCHAR(191) NULL,
    `subService` VARCHAR(191) NULL,
    `businessType` VARCHAR(191) NULL,
    `website` VARCHAR(500) NULL,
    `budget` VARCHAR(191) NULL,
    `timeline` VARCHAR(191) NULL,
    `businessGoal` TEXT NULL,
    `challenge` TEXT NULL,
    `companySize` VARCHAR(191) NULL,
    `requirements` TEXT NULL,
    `trafficSource` VARCHAR(191) NULL,
    `campaign` VARCHAR(191) NULL,
    `adId` VARCHAR(191) NULL,
    `assignedTeam` VARCHAR(191) NULL,
    `conversationSummary` TEXT NULL,
    `nextAction` TEXT NULL,
    `lastMessage` TEXT NULL,
    `lastMessageAt` DATETIME(3) NULL,
    `optInStatus` VARCHAR(191) NOT NULL DEFAULT 'UNKNOWN',
    `followUpCount` INTEGER NOT NULL DEFAULT 0,
    `lastFollowUpAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChatLeadProfile_reference_key`(`reference`),
    INDEX `ChatLeadProfile_source_createdAt_idx`(`source`, `createdAt`),
    INDEX `ChatLeadProfile_temperature_idx`(`temperature`),
    INDEX `ChatLeadProfile_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`leadId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatRequest` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `category` VARCHAR(191) NULL,
    `team` VARCHAR(191) NULL,
    `subject` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `contactName` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `preferredDate` DATETIME(3) NULL,
    `preferredTime` VARCHAR(191) NULL,
    `mode` VARCHAR(191) NULL,
    `meetingLink` VARCHAR(500) NULL,
    `notes` TEXT NULL,
    `resolution` TEXT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `leadId` VARCHAR(191) NULL,
    `conversationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChatRequest_reference_key`(`reference`),
    INDEX `ChatRequest_kind_status_idx`(`kind`, `status`),
    INDEX `ChatRequest_createdAt_idx`(`createdAt`),
    INDEX `ChatRequest_leadId_idx`(`leadId`),
    INDEX `ChatRequest_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhatsappContact` (
    `id` VARCHAR(191) NOT NULL,
    `waId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `profileName` VARCHAR(191) NULL,
    `lastInboundAt` DATETIME(3) NULL,
    `lastOutboundAt` DATETIME(3) NULL,
    `optedOut` BOOLEAN NOT NULL DEFAULT false,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WhatsappContact_waId_key`(`waId`),
    INDEX `WhatsappContact_lastInboundAt_idx`(`lastInboundAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChatConversation` ADD CONSTRAINT `ChatConversation_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `ChatConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatEvent` ADD CONSTRAINT `ChatEvent_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `ChatConversation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatLeadProfile` ADD CONSTRAINT `ChatLeadProfile_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatRequest` ADD CONSTRAINT `ChatRequest_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatRequest` ADD CONSTRAINT `ChatRequest_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `ChatConversation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
