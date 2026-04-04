-- AlterTable
ALTER TABLE `Document`
    ADD COLUMN `shareToken` VARCHAR(191) NULL,
    ADD COLUMN `sharedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Document_shareToken_key` ON `Document`(`shareToken`);
