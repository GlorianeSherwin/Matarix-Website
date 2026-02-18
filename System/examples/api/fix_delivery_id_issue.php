<?php
/**
 * Fix Delivery_ID Issue
 * This script fixes the duplicate entry '0' for key 'PRIMARY' error
 * by removing the problematic record and ensuring AUTO_INCREMENT is enabled
 * 
 * Access via: http://localhost/MatarixWEBs/api/fix_delivery_id_issue.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    $pdo->beginTransaction();
    
    // Step 1: Delete the problematic record with Delivery_ID = 0
    $stmt = $pdo->prepare("DELETE FROM deliveries WHERE Delivery_ID = 0");
    $stmt->execute();
    $deleted = $stmt->rowCount();
    
    // Step 2: Get the current max Delivery_ID (excluding 0)
    $stmt = $pdo->query("SELECT MAX(Delivery_ID) as max_id FROM deliveries WHERE Delivery_ID > 0");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $maxId = $result['max_id'] ?? 0;
    
    // Step 3: Ensure Delivery_ID has AUTO_INCREMENT enabled
    // First, check if it's already set
    $stmt = $pdo->query("SHOW CREATE TABLE deliveries");
    $tableInfo = $stmt->fetch(PDO::FETCH_ASSOC);
    $hasAutoIncrement = strpos($tableInfo['Create Table'] ?? '', 'AUTO_INCREMENT') !== false;
    
    if (!$hasAutoIncrement) {
        try {
            // Set AUTO_INCREMENT value before modifying the column
            $nextId = max(1, $maxId + 1);
            $pdo->exec("ALTER TABLE deliveries AUTO_INCREMENT = " . $nextId);
            
            // Now modify the column to add AUTO_INCREMENT
            $pdo->exec("
                ALTER TABLE deliveries 
                MODIFY COLUMN Delivery_ID int(11) NOT NULL AUTO_INCREMENT
            ");
            $autoIncrementSet = true;
        } catch (PDOException $e) {
            $autoIncrementSet = false;
            error_log("AUTO_INCREMENT setup error: " . $e->getMessage());
            throw $e;
        }
    } else {
        $autoIncrementSet = true;
        // Just update the AUTO_INCREMENT value
        $nextId = max(1, $maxId + 1);
        try {
            $pdo->exec("ALTER TABLE deliveries AUTO_INCREMENT = " . $nextId);
        } catch (PDOException $e) {
            error_log("Setting AUTO_INCREMENT value: " . $e->getMessage());
        }
    }
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Delivery_ID issue fixed successfully',
        'deleted_records' => $deleted,
        'auto_increment_enabled' => $autoIncrementSet,
        'max_delivery_id' => (int)$maxId,
        'next_auto_increment' => $maxId + 1
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Fix Delivery_ID Issue Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fix issue: ' . $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
?>

