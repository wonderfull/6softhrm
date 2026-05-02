-- CreateTable
CREATE TABLE `SponsorshipReportableEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sponsorshipId` INTEGER NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `eventDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `notes` TEXT NULL,
    `reportedAt` DATETIME(3) NULL,
    `reportedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SponsorshipReportableEvent` ADD CONSTRAINT `SponsorshipReportableEvent_sponsorshipId_fkey` FOREIGN KEY (`sponsorshipId`) REFERENCES `Sponsorship`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
