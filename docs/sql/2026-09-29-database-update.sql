-- BITSOL Marketing: database update for the release of 29 September 2026
--
-- Adds the tables and columns the new admin panel needs. It only ADDS:
-- no table, column or row is deleted. The one change to something that
-- exists is two extra values (EDITOR, MANAGER) for the user role.
--
-- HOW TO APPLY (hPanel > Databases > phpMyAdmin > the website's database)
--   1. Export tab > Go.            Keep the downloaded file: it is your backup.
--   2. Import tab > choose this file > Go.
--   3. Apply it ONCE. If phpMyAdmin stops with an error, do not run it again:
--      copy the error message and send it over.
--
-- Contains, in order:
--   20260928190423_unified_platform
--   20260929150000_blog_images
--   20260929170000_social_accounts
--   20260929180000_lead_automation

SET NAMES utf8mb4;

-- Prisma's record of which migrations were applied. Created only if missing.
CREATE TABLE IF NOT EXISTS `_prisma_migrations` (
    `id` VARCHAR(36) NOT NULL,
    `checksum` VARCHAR(64) NOT NULL,
    `finished_at` DATETIME(3) NULL,
    `migration_name` VARCHAR(255) NOT NULL,
    `logs` TEXT NULL,
    `rolled_back_at` DATETIME(3) NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `applied_steps_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- The first migration created the tables the site already runs on.
INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT 'd6531648-d064-4f9d-8c8d-9752f033e30b', '01abc51570293d61ea2d6e581fcda812051638ad7faa1da370075408deaeb4c4', NOW(3), '20260522000000_init', NULL, NULL, NOW(3), 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260522000000_init');

-- ========================================================================
-- 20260928190423_unified_platform
-- ========================================================================

-- Table names are written as the init migration created them (`Lead`,
-- `User`). Prisma generated this file on Windows, where MySQL ignores case
-- and reported them in lower case; on Linux `lead` is a different, missing
-- table and the migration would fail.

-- AlterTable
ALTER TABLE `Lead` ADD COLUMN `assignedToId` VARCHAR(191) NULL,
    ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `company` VARCHAR(191) NULL,
    ADD COLUMN `country` VARCHAR(191) NULL,
    ADD COLUMN `followUpAt` DATETIME(3) NULL,
    ADD COLUMN `pageUrl` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `priority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'website',
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `utmCampaign` VARCHAR(191) NULL,
    ADD COLUMN `utmMedium` VARCHAR(191) NULL,
    ADD COLUMN `utmSource` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('STUDENT', 'ADMIN', 'CLIENT', 'EDITOR', 'MANAGER') NOT NULL DEFAULT 'STUDENT';

-- CreateTable
CREATE TABLE `LeadNote` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `author` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadNote_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` VARCHAR(191) NOT NULL,
    `actor` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `detail` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLog_createdAt_idx`(`createdAt`),
    INDEX `ActivityLog_entity_idx`(`entity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Testimonial` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `company` VARCHAR(191) NULL,
    `quote` TEXT NOT NULL,
    `avatar` VARCHAR(191) NULL,
    `rating` INTEGER NOT NULL DEFAULT 5,
    `order` INTEGER NOT NULL DEFAULT 0,
    `published` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Faq` (
    `id` VARCHAR(191) NOT NULL,
    `question` TEXT NOT NULL,
    `answer` TEXT NOT NULL,
    `page` VARCHAR(191) NOT NULL DEFAULT 'home',
    `order` INTEGER NOT NULL DEFAULT 0,
    `published` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Faq_page_idx`(`page`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Media` (
    `id` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `alt` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Media_path_key`(`path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Redirect` (
    `id` VARCHAR(191) NOT NULL,
    `fromPath` VARCHAR(191) NOT NULL,
    `toPath` VARCHAR(191) NOT NULL,
    `permanent` BOOLEAN NOT NULL DEFAULT true,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `hits` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Redirect_fromPath_key`(`fromPath`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campaign` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL DEFAULT 'META',
    `objective` VARCHAR(191) NULL,
    `budget` DOUBLE NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `landingPage` VARCHAR(191) NULL,
    `utmSource` VARCHAR(191) NULL,
    `utmMedium` VARCHAR(191) NULL,
    `utmCampaign` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Campaign_utmCampaign_idx`(`utmCampaign`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Lead_status_idx` ON `Lead`(`status`);

-- CreateIndex
CREATE INDEX `Lead_utmCampaign_idx` ON `Lead`(`utmCampaign`);

-- CreateIndex
CREATE INDEX `Lead_assignedToId_idx` ON `Lead`(`assignedToId`);

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadNote` ADD CONSTRAINT `LeadNote_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT '434eb682-c543-4b2c-9d46-540b0d8e286a', 'adff8f6ae05e9266ad715c7f81ed7ccd18304f2c7c9b7a62c7fff16981795807', NOW(3), '20260928190423_unified_platform', NULL, NULL, NOW(3), 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260928190423_unified_platform');

-- ========================================================================
-- 20260929150000_blog_images
-- ========================================================================

-- Hero images for blog posts published by the content automation.
-- Additive only: creates one new table and touches no existing data.

-- CreateTable
CREATE TABLE `BlogImage` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `data` MEDIUMBLOB NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BlogImage_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT '07fbc7d9-51d0-4406-9326-66152c6ae4c3', 'baf198c26c0472cfee6d7f4a08d2886f2a8b3eca811ec92ccda59ec30ac19aff', NOW(3), '20260929150000_blog_images', NULL, NULL, NOW(3), 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260929150000_blog_images');

-- ========================================================================
-- 20260929170000_social_accounts
-- ========================================================================

-- Social accounts connected from Admin > Social and the posts published to them.
-- Additive only: creates two new tables and touches no existing data.

-- CreateTable
CREATE TABLE `SocialAccount` (
    `id` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `accessToken` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `connectedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SocialAccount_platform_externalId_key`(`platform`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SocialPost` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NULL,
    `platform` VARCHAR(191) NOT NULL,
    `accountName` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `link` TEXT NULL,
    `status` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NULL,
    `permalink` TEXT NULL,
    `error` TEXT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SocialPost_createdAt_idx`(`createdAt`),
    INDEX `SocialPost_accountId_idx`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SocialPost` ADD CONSTRAINT `SocialPost_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `SocialAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT '65407d12-19ab-4499-a74e-2265f718be26', '3817222aed69d1dc84c1858c0a0bf7b3435fef740b2fdc05f64cb6a43a582548', NOW(3), '20260929170000_social_accounts', NULL, NULL, NOW(3), 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260929170000_social_accounts');

-- ========================================================================
-- 20260929180000_lead_automation
-- ========================================================================

-- Lead import + email automation.
-- Additive only: adds nullable/defaulted columns and indexes to `Lead` and
-- creates new tables. No existing column, row or table is changed or removed.
-- Table names are written in the exact case the init migration created them
-- with, so this runs on case-sensitive (Linux) MySQL as well as on Windows.

-- AlterTable
ALTER TABLE `Lead` ADD COLUMN `firstName` VARCHAR(191) NULL,
    ADD COLUMN `lastName` VARCHAR(191) NULL,
    ADD COLUMN `jobTitle` VARCHAR(300) NULL,
    ADD COLUMN `website` VARCHAR(500) NULL,
    ADD COLUMN `linkedinUrl` VARCHAR(500) NULL,
    ADD COLUMN `contactLocation` VARCHAR(300) NULL,
    ADD COLUMN `companyDescription` TEXT NULL,
    ADD COLUMN `companyId` VARCHAR(191) NULL,
    ADD COLUMN `linkedinKey` VARCHAR(191) NULL,
    ADD COLUMN `identityKey` VARCHAR(191) NULL,
    ADD COLUMN `outreachEmail` VARCHAR(191) NULL,
    ADD COLUMN `outreachEmailReason` VARCHAR(191) NULL,
    ADD COLUMN `outreachLocked` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `personalization` TEXT NULL,
    ADD COLUMN `sourceName` VARCHAR(300) NULL,
    ADD COLUMN `sourceWorksheet` VARCHAR(300) NULL,
    ADD COLUMN `sourceRow` INTEGER NULL,
    ADD COLUMN `sourceImportId` VARCHAR(191) NULL,
    ADD COLUMN `leadSourceId` VARCHAR(191) NULL,
    ADD COLUMN `lastContactedAt` DATETIME(3) NULL,
    ADD COLUMN `nextFollowUpAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Lead_companyId_idx` ON `Lead`(`companyId`);

-- CreateIndex
CREATE INDEX `Lead_linkedinKey_idx` ON `Lead`(`linkedinKey`);

-- CreateIndex
CREATE INDEX `Lead_identityKey_idx` ON `Lead`(`identityKey`);

-- CreateIndex
CREATE INDEX `Lead_source_idx` ON `Lead`(`source`);

-- CreateIndex
CREATE INDEX `Lead_sourceImportId_idx` ON `Lead`(`sourceImportId`);


-- CreateTable
CREATE TABLE `Company` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `nameKey` VARCHAR(191) NOT NULL,
    `website` VARCHAR(500) NULL,
    `domain` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `phone` VARCHAR(191) NULL,
    `location` VARCHAR(300) NULL,
    `industry` VARCHAR(191) NULL,
    `employees` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Company_nameKey_key`(`nameKey`),
    INDEX `Company_domain_idx`(`domain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadEmail` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `emailKey` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `validity` VARCHAR(191) NOT NULL DEFAULT 'UNCHECKED',
    `validityReason` VARCHAR(191) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `isOutreach` BOOLEAN NOT NULL DEFAULT false,
    `bouncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadEmail_emailKey_idx`(`emailKey`),
    UNIQUE INDEX `LeadEmail_leadId_type_key`(`leadId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadPhone` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `phoneKey` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadPhone_phoneKey_idx`(`phoneKey`),
    UNIQUE INDEX `LeadPhone_leadId_type_key`(`leadId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadActivity` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `detail` TEXT NULL,
    `actor` VARCHAR(191) NOT NULL DEFAULT 'System',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadActivity_leadId_createdAt_idx`(`leadId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadSource` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LeadSource_key_key`(`key`),
    INDEX `LeadSource_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Tag_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadTag` (
    `leadId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadTag_tagId_idx`(`tagId`),
    PRIMARY KEY (`leadId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SuppressionEntry` (
    `id` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SuppressionEntry_value_key`(`value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoogleSheetConnection` (
    `id` VARCHAR(191) NOT NULL,
    `googleEmail` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `accessToken` TEXT NOT NULL,
    `refreshToken` TEXT NOT NULL,
    `tokenExpiresAt` DATETIME(3) NOT NULL,
    `scopes` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `lastError` TEXT NULL,
    `connectedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GoogleSheetConnection_googleEmail_key`(`googleEmail`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoogleSheetWorksheet` (
    `id` VARCHAR(191) NOT NULL,
    `connectionId` VARCHAR(191) NOT NULL,
    `leadSourceId` VARCHAR(191) NULL,
    `spreadsheetId` VARCHAR(191) NOT NULL,
    `spreadsheetName` VARCHAR(300) NOT NULL,
    `worksheetId` INTEGER NOT NULL,
    `worksheetTitle` VARCHAR(300) NOT NULL,
    `mapping` JSON NOT NULL,
    `duplicateMode` VARCHAR(191) NOT NULL DEFAULT 'UPDATE',
    `autoStartAutomation` BOOLEAN NOT NULL DEFAULT false,
    `automationId` VARCHAR(191) NULL,
    `assignmentMode` VARCHAR(191) NOT NULL DEFAULT 'UNASSIGNED',
    `assigneeId` VARCHAR(191) NULL,
    `assignmentTeam` VARCHAR(191) NULL,
    `tags` JSON NOT NULL,
    `syncIntervalMinutes` INTEGER NOT NULL DEFAULT 0,
    `syncStatus` VARCHAR(191) NOT NULL DEFAULT 'IDLE',
    `lastSyncAt` DATETIME(3) NULL,
    `nextSyncAt` DATETIME(3) NULL,
    `lastSuccessfulSyncAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `rowsProcessed` INTEGER NOT NULL DEFAULT 0,
    `rowsCreated` INTEGER NOT NULL DEFAULT 0,
    `rowsUpdated` INTEGER NOT NULL DEFAULT 0,
    `rowsSkipped` INTEGER NOT NULL DEFAULT 0,
    `rowsFailed` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GoogleSheetWorksheet_nextSyncAt_idx`(`nextSyncAt`),
    UNIQUE INDEX `GoogleSheetWorksheet_spreadsheetId_worksheetId_key`(`spreadsheetId`, `worksheetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadImport` (
    `id` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `leadSourceId` VARCHAR(191) NULL,
    `worksheetId` VARCHAR(191) NULL,
    `label` VARCHAR(300) NOT NULL,
    `trigger` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
    `settings` JSON NOT NULL,
    `payload` LONGTEXT NULL,
    `totalRows` INTEGER NOT NULL DEFAULT 0,
    `createdCount` INTEGER NOT NULL DEFAULT 0,
    `updatedCount` INTEGER NOT NULL DEFAULT 0,
    `duplicateCount` INTEGER NOT NULL DEFAULT 0,
    `invalidCount` INTEGER NOT NULL DEFAULT 0,
    `skippedCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `automationStarted` INTEGER NOT NULL DEFAULT 0,
    `quality` JSON NULL,
    `error` TEXT NULL,
    `startedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,

    INDEX `LeadImport_worksheetId_createdAt_idx`(`worksheetId`, `createdAt`),
    INDEX `LeadImport_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadImportRow` (
    `id` VARCHAR(191) NOT NULL,
    `importId` VARCHAR(191) NOT NULL,
    `worksheetId` VARCHAR(191) NULL,
    `rowNumber` INTEGER NOT NULL,
    `sourceKey` VARCHAR(191) NOT NULL,
    `sourceHash` VARCHAR(191) NOT NULL,
    `raw` JSON NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `outcome` VARCHAR(191) NOT NULL,
    `matchLevel` VARCHAR(191) NULL,
    `message` TEXT NULL,
    `lastSyncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadImportRow_importId_outcome_idx`(`importId`, `outcome`),
    INDEX `LeadImportRow_worksheetId_sourceKey_idx`(`worksheetId`, `sourceKey`),
    INDEX `LeadImportRow_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(300) NOT NULL,
    `body` TEXT NOT NULL,
    `ctaLabel` VARCHAR(191) NULL,
    `ctaUrl` VARCHAR(500) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailSequence` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailSequenceStep` (
    `id` VARCHAR(191) NOT NULL,
    `sequenceId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `delayDays` INTEGER NOT NULL DEFAULT 0,
    `templateId` VARCHAR(191) NOT NULL,

    INDEX `EmailSequenceStep_sequenceId_order_idx`(`sequenceId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailMessage` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NULL,
    `templateId` VARCHAR(191) NULL,
    `stepOrder` INTEGER NULL,
    `toEmail` VARCHAR(320) NOT NULL,
    `fromEmail` VARCHAR(191) NOT NULL,
    `replyTo` VARCHAR(191) NULL,
    `subject` VARCHAR(500) NOT NULL,
    `bodyText` TEXT NOT NULL,
    `bodyHtml` MEDIUMTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
    `provider` VARCHAR(191) NOT NULL,
    `providerMessageId` VARCHAR(191) NULL,
    `error` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `openedAt` DATETIME(3) NULL,
    `clickedAt` DATETIME(3) NULL,
    `repliedAt` DATETIME(3) NULL,
    `bouncedAt` DATETIME(3) NULL,
    `openCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailMessage_leadId_createdAt_idx`(`leadId`, `createdAt`),
    INDEX `EmailMessage_providerMessageId_idx`(`providerMessageId`),
    INDEX `EmailMessage_status_idx`(`status`),
    INDEX `EmailMessage_sentAt_idx`(`sentAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailEvent` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `providerEventId` VARCHAR(191) NULL,
    `payload` JSON NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailEvent_providerEventId_key`(`providerEventId`),
    INDEX `EmailEvent_messageId_idx`(`messageId`),
    INDEX `EmailEvent_type_occurredAt_idx`(`type`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Automation` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `trigger` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `sequenceId` VARCHAR(191) NOT NULL,
    `createTask` BOOLEAN NOT NULL DEFAULT true,
    `taskTitle` VARCHAR(300) NULL,
    `taskNote` TEXT NULL,
    `taskDueDays` INTEGER NOT NULL DEFAULT 1,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationStep` (
    `id` VARCHAR(191) NOT NULL,
    `automationId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sequenceStepId` VARCHAR(191) NULL,
    `waitDays` INTEGER NULL,

    INDEX `AutomationStep_automationId_order_idx`(`automationId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationCondition` (
    `id` VARCHAR(191) NOT NULL,
    `automationId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `field` VARCHAR(191) NOT NULL,
    `operator` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NULL,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AutomationCondition_automationId_idx`(`automationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationRun` (
    `id` VARCHAR(191) NOT NULL,
    `automationId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `stepIndex` INTEGER NOT NULL DEFAULT 0,
    `nextRunAt` DATETIME(3) NULL,
    `stopReason` VARCHAR(191) NULL,
    `emailsSent` INTEGER NOT NULL DEFAULT 0,
    `startedBy` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AutomationRun_leadId_idx`(`leadId`),
    INDEX `AutomationRun_automationId_status_idx`(`automationId`, `status`),
    INDEX `AutomationRun_status_nextRunAt_idx`(`status`, `nextRunAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationJob` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `refId` VARCHAR(191) NOT NULL,
    `runAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 5,
    `lockedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(191) NULL,
    `lastError` TEXT NULL,
    `result` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,

    INDEX `AutomationJob_status_runAt_idx`(`status`, `runAt`),
    INDEX `AutomationJob_type_refId_idx`(`type`, `refId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FollowUp` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'EMAIL',
    `title` VARCHAR(300) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SCHEDULED',
    `stepOrder` INTEGER NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `FollowUp_status_dueAt_idx`(`status`, `dueAt`),
    INDEX `FollowUp_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `runId` VARCHAR(191) NULL,
    `title` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `dueAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `assignedToId` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `Task_status_dueAt_idx`(`status`, `dueAt`),
    INDEX `Task_leadId_idx`(`leadId`),
    INDEX `Task_assignedToId_idx`(`assignedToId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_leadSourceId_fkey` FOREIGN KEY (`leadSourceId`) REFERENCES `LeadSource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadEmail` ADD CONSTRAINT `LeadEmail_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadPhone` ADD CONSTRAINT `LeadPhone_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadActivity` ADD CONSTRAINT `LeadActivity_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadTag` ADD CONSTRAINT `LeadTag_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadTag` ADD CONSTRAINT `LeadTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoogleSheetWorksheet` ADD CONSTRAINT `GoogleSheetWorksheet_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `GoogleSheetConnection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoogleSheetWorksheet` ADD CONSTRAINT `GoogleSheetWorksheet_leadSourceId_fkey` FOREIGN KEY (`leadSourceId`) REFERENCES `LeadSource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadImport` ADD CONSTRAINT `LeadImport_leadSourceId_fkey` FOREIGN KEY (`leadSourceId`) REFERENCES `LeadSource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadImport` ADD CONSTRAINT `LeadImport_worksheetId_fkey` FOREIGN KEY (`worksheetId`) REFERENCES `GoogleSheetWorksheet`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadImportRow` ADD CONSTRAINT `LeadImportRow_importId_fkey` FOREIGN KEY (`importId`) REFERENCES `LeadImport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadImportRow` ADD CONSTRAINT `LeadImportRow_worksheetId_fkey` FOREIGN KEY (`worksheetId`) REFERENCES `GoogleSheetWorksheet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadImportRow` ADD CONSTRAINT `LeadImportRow_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailSequenceStep` ADD CONSTRAINT `EmailSequenceStep_sequenceId_fkey` FOREIGN KEY (`sequenceId`) REFERENCES `EmailSequence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailSequenceStep` ADD CONSTRAINT `EmailSequenceStep_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `EmailTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailMessage` ADD CONSTRAINT `EmailMessage_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailMessage` ADD CONSTRAINT `EmailMessage_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `AutomationRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailMessage` ADD CONSTRAINT `EmailMessage_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `EmailTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailEvent` ADD CONSTRAINT `EmailEvent_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `EmailMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Automation` ADD CONSTRAINT `Automation_sequenceId_fkey` FOREIGN KEY (`sequenceId`) REFERENCES `EmailSequence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationStep` ADD CONSTRAINT `AutomationStep_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationStep` ADD CONSTRAINT `AutomationStep_sequenceStepId_fkey` FOREIGN KEY (`sequenceStepId`) REFERENCES `EmailSequenceStep`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationCondition` ADD CONSTRAINT `AutomationCondition_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationRun` ADD CONSTRAINT `AutomationRun_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationRun` ADD CONSTRAINT `AutomationRun_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `AutomationRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `AutomationRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
SELECT '0fa9134a-69d0-4746-bec7-db0233562e92', 'f644bab09e0127dd09c3f0579354d4f6e820313920d8c2889d01c4c98f74d1b5', NOW(3), '20260929180000_lead_automation', NULL, NULL, NOW(3), 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` = '20260929180000_lead_automation');

-- Done. The website picks the new tables up straight away; no restart needed.
