-- Migration Script: Add Order Approval Status
-- Adds 'Pending Approval' and 'Rejected' statuses to orders table
-- Run this script to update the orders table with approval workflow support

-- Step 1: Update any existing orders that might need migration
-- (No existing orders need to be changed as this is a new feature)

-- Step 2: Update the enum to include new statuses
-- Note: MySQL doesn't support direct enum modification, so we need to recreate the column
ALTER TABLE orders 
MODIFY COLUMN status 
ENUM('Pending Approval', 'Waiting Payment', 'Processing', 'Ready', 'Rejected') 
NOT NULL DEFAULT 'Pending Approval';

-- Step 2.5: Update payment_method to allow NULL (remove default 'On-Site')
-- This allows orders to be created without a payment method until approval
ALTER TABLE orders 
MODIFY COLUMN payment_method 
ENUM('GCash','On-Site') 
NULL DEFAULT NULL;

-- Step 2.6: Fix existing orders - set payment_method to NULL for orders that are pending approval or rejected
UPDATE orders 
SET payment_method = NULL 
WHERE status = 'Pending Approval' OR status = 'Rejected';

-- Step 3: Add rejection_reason field (optional, for storing rejection reasons)
ALTER TABLE orders 
ADD COLUMN rejection_reason TEXT NULL AFTER last_updated;

-- Step 4: Add approval tracking fields (optional, for audit trail)
ALTER TABLE orders 
ADD COLUMN approved_at DATETIME NULL AFTER rejection_reason,
ADD COLUMN rejected_at DATETIME NULL AFTER approved_at,
ADD COLUMN approved_by INT(11) NULL AFTER rejected_at;

-- Add foreign key constraint for approved_by (references users table)
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_approved_by 
FOREIGN KEY (approved_by) REFERENCES users(User_ID) ON DELETE SET NULL;

-- Verify the change
-- SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = 'u634157906_matarik' 
-- AND TABLE_NAME = 'orders' 
-- AND COLUMN_NAME = 'status';

