-- DropIndex
DROP INDEX `Employee_email_key` ON `Employee`;

-- DropIndex
DROP INDEX `Project_code_key` ON `Project`;

-- AlterTable
ALTER TABLE `AuditLog` ADD COLUMN `tenantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `DataConsent` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Document` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Employee` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `LeaveRequest` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Project` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Sponsorship` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `SponsorshipComplianceEvidence` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `SponsorshipReportableEvent` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Timesheet` ADD COLUMN `tenantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `tenantId` INTEGER NOT NULL,
    ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `Tenant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'TRIAL',
    `plan` VARCHAR(191) NOT NULL DEFAULT 'CORE',
    `seatLimit` INTEGER NULL,
    `features` JSON NULL,
    `logoUrl` VARCHAR(191) NULL,
    `primaryColor` VARCHAR(191) NULL DEFAULT '#1d4f66',
    `trialEndsAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Tenant_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantSettings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `leaveYearStart` VARCHAR(191) NOT NULL DEFAULT '01-01',
    `defaultLeaveDays` DOUBLE NOT NULL DEFAULT 28,
    `bankHolidayRegion` VARCHAR(191) NOT NULL DEFAULT 'england-and-wales',
    `workingDays` VARCHAR(191) NOT NULL DEFAULT '1,2,3,4,5',
    `sponsorLicenceNo` VARCHAR(191) NULL,
    `companyAddress` VARCHAR(191) NULL,

    UNIQUE INDEX `TenantSettings_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlatformAdmin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `totpSecret` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PlatformAdmin_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_idx` ON `AuditLog`(`tenantId`);

-- CreateIndex
CREATE INDEX `DataConsent_tenantId_idx` ON `DataConsent`(`tenantId`);

-- CreateIndex
CREATE INDEX `Document_tenantId_idx` ON `Document`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `Employee_tenantId_email_key` ON `Employee`(`tenantId`, `email`);

-- CreateIndex
CREATE INDEX `LeaveRequest_tenantId_idx` ON `LeaveRequest`(`tenantId`);

-- CreateIndex
CREATE UNIQUE INDEX `Project_tenantId_code_key` ON `Project`(`tenantId`, `code`);

-- CreateIndex
CREATE INDEX `Sponsorship_tenantId_idx` ON `Sponsorship`(`tenantId`);

-- CreateIndex
CREATE INDEX `SponsorshipComplianceEvidence_tenantId_idx` ON `SponsorshipComplianceEvidence`(`tenantId`);

-- CreateIndex
CREATE INDEX `SponsorshipReportableEvent_tenantId_idx` ON `SponsorshipReportableEvent`(`tenantId`);

-- CreateIndex
CREATE INDEX `Timesheet_tenantId_idx` ON `Timesheet`(`tenantId`);

-- CreateIndex
CREATE INDEX `User_tenantId_idx` ON `User`(`tenantId`);

-- AddForeignKey
ALTER TABLE `TenantSettings` ADD CONSTRAINT `TenantSettings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sponsorship` ADD CONSTRAINT `Sponsorship_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SponsorshipComplianceEvidence` ADD CONSTRAINT `SponsorshipComplianceEvidence_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SponsorshipReportableEvent` ADD CONSTRAINT `SponsorshipReportableEvent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Timesheet` ADD CONSTRAINT `Timesheet_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataConsent` ADD CONSTRAINT `DataConsent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

