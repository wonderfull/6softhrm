/*
  Warnings:

  - You are about to drop the column `sponsorLicenceNo` on the `TenantSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Employee` ADD COLUMN `anonymisedAt` DATETIME(3) NULL,
    ADD COLUMN `dbsCertificateNumber` TEXT NULL,
    ADD COLUMN `dbsIssueDate` DATETIME(3) NULL,
    ADD COLUMN `dbsLevel` VARCHAR(191) NULL,
    ADD COLUMN `dbsRecheckDate` DATETIME(3) NULL,
    ADD COLUMN `retainUntil` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Sponsorship` ADD COLUMN `cosAssignedDate` DATETIME(3) NULL,
    ADD COLUMN `cosStartBy` DATETIME(3) NULL,
    ADD COLUMN `cosType` VARCHAR(191) NULL,
    ADD COLUMN `iscAmount` DOUBLE NULL;

-- CreateTable
CREATE TABLE `SponsorLicence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `licenceNumber` VARCHAR(191) NULL,
    `rating` VARCHAR(191) NOT NULL DEFAULT 'A',
    `expiryDate` DATETIME(3) NULL,
    `authorisingOfficer` VARCHAR(191) NULL,
    `authorisingOfficerEmail` VARCHAR(191) NULL,
    `keyContact` VARCHAR(191) NULL,
    `keyContactEmail` VARCHAR(191) NULL,
    `level1Users` JSON NULL,
    `level2Users` JSON NULL,
    `cosDefinedAllocated` INTEGER NOT NULL DEFAULT 0,
    `cosUndefinedAllocated` INTEGER NOT NULL DEFAULT 0,
    `allocationYearStart` DATETIME(3) NULL,
    `actionPlanIssuedAt` DATETIME(3) NULL,
    `actionPlanDueAt` DATETIME(3) NULL,
    `actionPlanNotes` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SponsorLicence_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Carry any licence number typed into the old settings field across to the
-- new SponsorLicence row before the column goes.
INSERT INTO `SponsorLicence` (`tenantId`, `licenceNumber`, `updatedAt`)
SELECT `tenantId`, `sponsorLicenceNo`, NOW(3)
FROM `TenantSettings`
WHERE `sponsorLicenceNo` IS NOT NULL AND `sponsorLicenceNo` <> '';

-- AlterTable
ALTER TABLE `TenantSettings` DROP COLUMN `sponsorLicenceNo`;

-- CreateTable
CREATE TABLE `RightToWorkCheck` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `checkDate` DATETIME(3) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `shareCode` TEXT NULL,
    `outcome` VARCHAR(191) NOT NULL DEFAULT 'PASS',
    `timeLimited` BOOLEAN NOT NULL DEFAULT false,
    `recheckDue` DATETIME(3) NULL,
    `documentId` INTEGER NULL,
    `checkedBy` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RightToWorkCheck_tenantId_employeeId_checkDate_idx`(`tenantId`, `employeeId`, `checkDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NULL,
    `link` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_tenantId_userId_readAt_idx`(`tenantId`, `userId`, `readAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SponsorLicence` ADD CONSTRAINT `SponsorLicence_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RightToWorkCheck` ADD CONSTRAINT `RightToWorkCheck_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RightToWorkCheck` ADD CONSTRAINT `RightToWorkCheck_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RightToWorkCheck` ADD CONSTRAINT `RightToWorkCheck_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
