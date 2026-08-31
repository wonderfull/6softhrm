-- AlterTable
ALTER TABLE `Sponsorship` ADD COLUMN `cosSalary` DOUBLE NULL,
    ADD COLUMN `cosWeeklyHours` DOUBLE NULL,
    ADD COLUMN `jobTitleOnCos` VARCHAR(191) NULL,
    ADD COLUMN `socCode` VARCHAR(191) NULL,
    ADD COLUMN `workLocation` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `PayRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `grossPay` DOUBLE NOT NULL,
    `hoursWorked` DOUBLE NULL,
    `source` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PayRecord_tenantId_employeeId_periodStart_idx`(`tenantId`, `employeeId`, `periodStart`),
    UNIQUE INDEX `PayRecord_tenantId_employeeId_periodStart_key`(`tenantId`, `employeeId`, `periodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PayRecord` ADD CONSTRAINT `PayRecord_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayRecord` ADD CONSTRAINT `PayRecord_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
