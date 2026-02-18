-- Create Missing Delivery Records
-- Run this SQL script in phpMyAdmin to create delivery records for all existing orders
-- This fixes the empty deliveries table issue

-- Step 1: Ensure Delivery_ID has AUTO_INCREMENT (if not already set)
-- Remove any problematic row with ID 0 first
DELETE FROM deliveries WHERE Delivery_ID = 0;

-- Add AUTO_INCREMENT to Delivery_ID (if not already set)
ALTER TABLE deliveries 
MODIFY COLUMN Delivery_ID int(11) NOT NULL AUTO_INCREMENT;

-- Step 2: Create delivery records for all orders that don't have one
INSERT INTO deliveries (Order_ID, Delivery_Status, Created_At, Updated_At)
SELECT 
    o.Order_ID,
    'Pending' as Delivery_Status,
    NOW() as Created_At,
    NOW() as Updated_At
FROM orders o
LEFT JOIN deliveries d ON o.Order_ID = d.Order_ID
WHERE d.Delivery_ID IS NULL
ORDER BY o.Order_ID;

-- Step 3: Verify the results
SELECT 
    COUNT(*) as total_deliveries,
    COUNT(DISTINCT Order_ID) as unique_orders
FROM deliveries;

-- Step 4: Show sample of created records
SELECT * FROM deliveries ORDER BY Delivery_ID DESC LIMIT 10;

