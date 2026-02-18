-- Fix Phone_Number column type from INT to VARCHAR
-- This fixes the issue where phone numbers overflow to 2147483647 (max 32-bit integer)

-- Step 1: Check current column type (run this first to verify)
-- DESCRIBE users;

-- Step 2: Alter the column to VARCHAR(15) to store phone numbers as text
ALTER TABLE `users` 
MODIFY COLUMN `Phone_Number` VARCHAR(15) DEFAULT NULL;

-- Step 3: Clean up corrupted data (set overflow values to NULL)
-- This will set all phone numbers that are 2147483647 (the overflow value) to NULL
UPDATE `users` 
SET `Phone_Number` = NULL 
WHERE `Phone_Number` = '2147483647' OR `Phone_Number` = 2147483647;

-- Step 4: Verify the fix
-- SELECT User_ID, First_Name, Last_Name, Phone_Number FROM users;

