<?php
/**
 * Fix Fleet Table Issue
 * This script fixes the duplicate entry '0' for key 'PRIMARY' error for fleet table
 * by removing problematic records and ensuring AUTO_INCREMENT is enabled
 * 
 * Access via: http://localhost/MatarixWEBs/api/fix_fleet_table.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    $results = [
        'steps_completed' => [],
        'errors' => [],
        'warnings' => []
    ];
    
    $pdo->beginTransaction();
    
    try {
        // ==========================================
        // STEP 1: Delete record with Vehicle_ID = 0
        // ==========================================
        $stmt = $pdo->prepare("DELETE FROM fleet WHERE Vehicle_ID = 0");
        $stmt->execute();
        $deleted = $stmt->rowCount();
        
        if ($deleted > 0) {
            $results['steps_completed'][] = "Deleted {$deleted} record(s) with Vehicle_ID = 0";
        } else {
            $results['steps_completed'][] = "No records with Vehicle_ID = 0 found (already clean)";
        }
        
        // ==========================================
        // STEP 2: Get max Vehicle_ID
        // ==========================================
        $stmt = $pdo->query("SELECT MAX(Vehicle_ID) as max_id FROM fleet WHERE Vehicle_ID > 0");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $maxId = (int)($result['max_id'] ?? 0);
        $nextId = max(1, $maxId + 1);
        
        $results['steps_completed'][] = "Current max Vehicle_ID: {$maxId}, Next ID will be: {$nextId}";
        
        // ==========================================
        // STEP 3: Check current table structure
        // ==========================================
        $stmt = $pdo->query("SHOW CREATE TABLE fleet");
        $tableInfo = $stmt->fetch(PDO::FETCH_ASSOC);
        $createTable = $tableInfo['Create Table'] ?? '';
        $hasAutoIncrement = strpos($createTable, 'AUTO_INCREMENT') !== false;
        
        // ==========================================
        // STEP 4: Set AUTO_INCREMENT value first (before modifying column)
        // ==========================================
        try {
            $pdo->exec("ALTER TABLE fleet AUTO_INCREMENT = {$nextId}");
            $results['steps_completed'][] = "Set AUTO_INCREMENT value to {$nextId}";
        } catch (PDOException $e) {
            $results['warnings'][] = "Could not set AUTO_INCREMENT value: " . $e->getMessage();
        }
        
        // ==========================================
        // STEP 5: Enable AUTO_INCREMENT on Vehicle_ID column
        // ==========================================
        if (!$hasAutoIncrement) {
            try {
                $pdo->exec("
                    ALTER TABLE fleet 
                    MODIFY COLUMN Vehicle_ID int(20) NOT NULL AUTO_INCREMENT
                ");
                $results['steps_completed'][] = "Enabled AUTO_INCREMENT on Vehicle_ID column";
            } catch (PDOException $e) {
                $results['errors'][] = "Failed to enable AUTO_INCREMENT: " . $e->getMessage();
                throw $e;
            }
        } else {
            $results['steps_completed'][] = "AUTO_INCREMENT already enabled on Vehicle_ID";
        }
        
        // ==========================================
        // STEP 6: Verify the fix
        // ==========================================
        $stmt = $pdo->query("SHOW CREATE TABLE fleet");
        $tableInfo = $stmt->fetch(PDO::FETCH_ASSOC);
        $createTableAfter = $tableInfo['Create Table'] ?? '';
        $hasAutoIncrementAfter = strpos($createTableAfter, 'AUTO_INCREMENT') !== false;
        
        $stmt = $pdo->query("SHOW TABLE STATUS LIKE 'fleet'");
        $tableStatus = $stmt->fetch(PDO::FETCH_ASSOC);
        $autoIncrementValue = $tableStatus['Auto_increment'] ?? 'NULL';
        
        // ==========================================
        // STEP 7: Test insert (then rollback)
        // ==========================================
        try {
            // Create a savepoint for testing
            $pdo->exec("SAVEPOINT test_insert");
            
            // Try to insert a test record (we'll rollback)
            $testStmt = $pdo->prepare("
                INSERT INTO fleet (vehicle_model, status)
                VALUES ('Test Vehicle', 'Available')
            ");
            $testStmt->execute();
            $testVehicleId = $pdo->lastInsertId();
            
            if ($testVehicleId > 0) {
                $results['steps_completed'][] = "Test insert successful! Generated Vehicle_ID: {$testVehicleId}";
            } else {
                $results['errors'][] = "Test insert failed: lastInsertId() returned 0 or false";
            }
            
            // Rollback the test insert
            $pdo->exec("ROLLBACK TO SAVEPOINT test_insert");
            $pdo->exec("RELEASE SAVEPOINT test_insert");
            
        } catch (PDOException $e) {
            $results['errors'][] = "Test insert failed: " . $e->getMessage();
            try {
                $pdo->exec("ROLLBACK TO SAVEPOINT test_insert");
            } catch (Exception $e2) {
                // Ignore
            }
        }
        
        // Commit all changes
        $pdo->commit();
        
        // Final verification
        $results['verification'] = [
            'auto_increment_enabled' => $hasAutoIncrementAfter,
            'auto_increment_value' => $autoIncrementValue,
            'max_vehicle_id' => $maxId,
            'next_auto_increment' => $nextId
        ];
        
        $results['success'] = count($results['errors']) === 0;
        $results['message'] = count($results['errors']) === 0 
            ? 'Fleet table fixed successfully!' 
            : 'Fix completed with some errors. Please review.';
        
        echo json_encode($results, JSON_PRETTY_PRINT);
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Fix Fleet Table Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
}
?>

