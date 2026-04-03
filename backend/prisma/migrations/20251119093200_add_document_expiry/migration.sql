-- AlterTable
ALTER TABLE `Document` ADD COLUMN `expiryDate` DATETIME(3) NULL,
    ADD COLUMN `type` VARCHAR(191) NULL;
