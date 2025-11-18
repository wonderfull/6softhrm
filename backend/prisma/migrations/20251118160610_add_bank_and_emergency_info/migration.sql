-- AlterTable
ALTER TABLE `Employee` ADD COLUMN `accountNumber` VARCHAR(191) NULL,
    ADD COLUMN `bankName` VARCHAR(191) NULL,
    ADD COLUMN `emergencyContactAddress` VARCHAR(191) NULL,
    ADD COLUMN `emergencyContactName` VARCHAR(191) NULL,
    ADD COLUMN `emergencyContactPhone` VARCHAR(191) NULL,
    ADD COLUMN `emergencyContactRelation` VARCHAR(191) NULL,
    ADD COLUMN `sortCode` VARCHAR(191) NULL;
