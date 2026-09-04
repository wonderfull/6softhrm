-- AlterTable
ALTER TABLE `Employee` ADD COLUMN `leaveAllowanceDays` DOUBLE NULL,
    ADD COLUMN `leaveCarriedOverDays` DOUBLE NULL,
    ADD COLUMN `managerId` INTEGER NULL;

-- AlterTable
ALTER TABLE `LeaveRequest` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `days` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `decidedAt` DATETIME(3) NULL,
    ADD COLUMN `decidedBy` VARCHAR(191) NULL,
    ADD COLUMN `decisionNote` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `TenantSettings` ADD COLUMN `carryoverCapDays` DOUBLE NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Employee_tenantId_managerId_idx` ON `Employee`(`tenantId`, `managerId`);

-- CreateIndex
CREATE INDEX `LeaveRequest_tenantId_employeeId_startDate_idx` ON `LeaveRequest`(`tenantId`, `employeeId`, `startDate`);

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Normalise the leave-type vocabulary. Early rows were written with the human
-- label rather than the code, and PERSONAL was dropped in favour of OTHER;
-- from here the API validates against the codes.
UPDATE `LeaveRequest` SET `type` = 'ANNUAL' WHERE `type` IN ('Annual Leave', 'annual', 'Annual', 'HOLIDAY', 'Holiday');
UPDATE `LeaveRequest` SET `type` = 'SICK' WHERE `type` IN ('Sick Leave', 'sick', 'Sick');
UPDATE `LeaveRequest` SET `type` = 'UNPAID' WHERE `type` IN ('Unpaid Leave', 'unpaid', 'Unpaid');
UPDATE `LeaveRequest` SET `type` = 'MATERNITY' WHERE `type` IN ('Maternity Leave', 'maternity');
UPDATE `LeaveRequest` SET `type` = 'PATERNITY' WHERE `type` IN ('Paternity Leave', 'paternity');
UPDATE `LeaveRequest` SET `type` = 'COMPASSIONATE' WHERE `type` IN ('Compassionate Leave', 'compassionate');
UPDATE `LeaveRequest` SET `type` = 'OTHER' WHERE `type` NOT IN ('ANNUAL', 'SICK', 'UNPAID', 'MATERNITY', 'PATERNITY', 'COMPASSIONATE');

-- Decision trail for rows decided before it was recorded: the row was decided,
-- we just never captured when or by whom.
UPDATE `LeaveRequest` SET `decidedAt` = `createdAt` WHERE `status` <> 'PENDING' AND `decidedAt` IS NULL;
