-- Drop the public share-link feature: shareToken + sharedAt columns.
DROP INDEX `Document_shareToken_key` ON `Document`;

ALTER TABLE `Document`
    DROP COLUMN `shareToken`,
    DROP COLUMN `sharedAt`;
