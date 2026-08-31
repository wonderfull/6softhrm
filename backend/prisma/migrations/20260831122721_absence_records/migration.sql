-- CreateTable
CREATE TABLE `AbsenceRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `recordedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AbsenceRecord_tenantId_employeeId_date_idx`(`tenantId`, `employeeId`, `date`),
    INDEX `AbsenceRecord_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `AbsenceRecord_tenantId_employeeId_date_key`(`tenantId`, `employeeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AbsenceRecord` ADD CONSTRAINT `AbsenceRecord_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AbsenceRecord` ADD CONSTRAINT `AbsenceRecord_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
