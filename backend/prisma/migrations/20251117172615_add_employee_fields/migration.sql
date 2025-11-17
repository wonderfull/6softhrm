-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "niNumber" TEXT,
    "jobTitle" TEXT,
    "employeeType" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "department" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME
);
INSERT INTO "new_Employee" ("email", "endDate", "firstName", "id", "jobTitle", "lastName", "niNumber", "startDate") SELECT "email", "endDate", "firstName", "id", "jobTitle", "lastName", "niNumber", "startDate" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
