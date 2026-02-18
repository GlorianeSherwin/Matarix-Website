-- Migration Script: Update Delivery Status Enum (Standardized)
-- Run this script to update the deliveries table with standardized status values
-- 
-- Standardized statuses:
-- 1. Pending - Order placed, waiting to be processed
-- 2. Preparing - Order is being prepared/packed
-- 3. Out for Delivery - Order is on the way to customer (consolidated from "On the Way")
-- 4. Delivered - Order has been delivered
-- 5. Cancelled - Order was cancelled
--
-- Note: This will convert any existing "On the Way" records to "Out for Delivery"

-- Step 1: Update any existing "On the Way" records to "Out for Delivery"
UPDATE deliveries 
SET Delivery_Status = 'Out for Delivery', Updated_At = NOW()
WHERE Delivery_Status = 'On the Way';

-- Step 2: Update the enum to remove "On the Way" and standardize capitalization
ALTER TABLE deliveries 
MODIFY COLUMN Delivery_Status 
ENUM('Pending', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled') 
DEFAULT 'Pending';

-- Verify the change
-- SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = 'u634157906_matarik' 
-- AND TABLE_NAME = 'deliveries' 
-- AND COLUMN_NAME = 'Delivery_Status';

