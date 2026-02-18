-- ==========================================
-- Product Archive System Migration
-- Adds archive functionality to products table
-- ==========================================

-- Add archive columns to products table
ALTER TABLE `products` 
ADD COLUMN `is_archived` TINYINT(1) DEFAULT 0 NOT NULL AFTER `weight_unit`,
ADD COLUMN `archived_at` TIMESTAMP NULL DEFAULT NULL AFTER `is_archived`,
ADD COLUMN `archived_by` INT(11) NULL DEFAULT NULL AFTER `archived_at`;

-- Add index for better query performance
ALTER TABLE `products` 
ADD INDEX `idx_is_archived` (`is_archived`),
ADD INDEX `idx_archived_at` (`archived_at`);

-- Update existing products to ensure they are not archived
UPDATE `products` SET `is_archived` = 0 WHERE `is_archived` IS NULL;

