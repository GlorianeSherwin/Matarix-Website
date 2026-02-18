<?php
/**
 * Fix Phone_Number Column Type
 * 
 * This script fixes the Phone_Number column in the users table
 * by changing it from INT to VARCHAR(15) to prevent integer overflow.
 * 
 * Run this script once to fix the database schema issue.
 */

// Database connection
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    echo "Starting Phone_Number column fix...\n\n";
    
    // Step 1: Check current column type
    echo "Step 1: Checking current column type...\n";
    $checkStmt = $pdo->query("SHOW COLUMNS FROM `users` WHERE Field = 'Phone_Number'");
    $columnInfo = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($columnInfo) {
        echo "Current type: " . $columnInfo['Type'] . "\n";
        echo "Current Null: " . $columnInfo['Null'] . "\n";
        echo "Current Default: " . ($columnInfo['Default'] ?? 'NULL') . "\n\n";
        
        // Check if already VARCHAR
        if (strpos(strtolower($columnInfo['Type']), 'varchar') !== false) {
            echo "✅ Column is already VARCHAR. No changes needed.\n";
            echo "However, checking for corrupted data...\n\n";
        } else {
            // Step 2: Alter column to VARCHAR(15)
            echo "Step 2: Changing column type from INT to VARCHAR(15)...\n";
            $pdo->exec("ALTER TABLE `users` MODIFY COLUMN `Phone_Number` VARCHAR(15) DEFAULT NULL");
            echo "✅ Column type changed successfully!\n\n";
        }
    } else {
        echo "❌ Error: Phone_Number column not found!\n";
        exit(1);
    }
    
    // Step 3: Clean up corrupted data (overflow values)
    echo "Step 3: Cleaning up corrupted phone numbers (2147483647)...\n";
    $updateStmt = $pdo->prepare("UPDATE `users` SET `Phone_Number` = NULL WHERE `Phone_Number` = '2147483647' OR `Phone_Number` = 2147483647");
    $affectedRows = $updateStmt->execute() ? $updateStmt->rowCount() : 0;
    echo "✅ Cleaned up $affectedRows corrupted phone number(s).\n\n";
    
    // Step 4: Show results
    echo "Step 4: Verifying fix...\n";
    $verifyStmt = $pdo->query("SELECT User_ID, First_Name, Last_Name, Phone_Number FROM `users` ORDER BY User_ID");
    $users = $verifyStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "\nCurrent phone numbers in database:\n";
    echo str_repeat("-", 80) . "\n";
    printf("%-10s %-20s %-20s %-20s\n", "User_ID", "First_Name", "Last_Name", "Phone_Number");
    echo str_repeat("-", 80) . "\n";
    
    foreach ($users as $user) {
        $phone = $user['Phone_Number'] ?? 'NULL';
        printf("%-10s %-20s %-20s %-20s\n", 
            $user['User_ID'], 
            $user['First_Name'] ?? 'NULL',
            $user['Last_Name'] ?? 'NULL',
            $phone
        );
    }
    
    echo str_repeat("-", 80) . "\n";
    echo "\n✅ Phone_Number column fix completed successfully!\n";
    echo "\nNote: Corrupted phone numbers (2147483647) have been set to NULL.\n";
    echo "Users will need to update their phone numbers through the profile page.\n";
    
} catch (PDOException $e) {
    echo "❌ Database Error: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}

