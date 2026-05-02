-- CreateTable
CREATE TABLE `SponsorshipComplianceEvidence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sponsorshipId` INTEGER NOT NULL,
    `documentId` INTEGER NULL,
    `evidenceType` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `verifiedAt` DATETIME(3) NULL,
    `verifiedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SponsorshipComplianceEvidence` ADD CONSTRAINT `SponsorshipComplianceEvidence_sponsorshipId_fkey` FOREIGN KEY (`sponsorshipId`) REFERENCES `Sponsorship`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SponsorshipComplianceEvidence` ADD CONSTRAINT `SponsorshipComplianceEvidence_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
