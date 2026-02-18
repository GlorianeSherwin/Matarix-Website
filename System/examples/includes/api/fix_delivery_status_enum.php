<?php
/**
 * Fix Delivery Status Enum
 * Updates the deliveries table enum to include all required statuses
 * This script ensures the enum matches the application requirements
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

$results = [];
$rowsUpdated = 0;
$currentEnumType = '';
$newEnumType = '';
$inTransaction = false;

try {
    // Note: ALTER TABLE statements cause implicit commits in MySQL
    // So we don't use transactions for DDL operations
    
    // Step 1: Check current enum values
    $stmt = $pdo->query("
        SELECT COLUMN_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'deliveries' 
        AND COLUMN_NAME = 'Delivery_Status'
    ");
    $currentEnum = $stmt->fetch(PDO::FETCH_ASSOC);
    $currentEnumType = $currentEnum['COLUMN_TYPE'] ?? '';
    
    $results['step1'] = [
        'status' => 'completed',
        'message' => 'Current enum type retrieved',
        'current_enum' => $currentEnumType
    ];
    
    // Step 2: Update any existing "On the Way" records to "Out for Delivery"
    // Use transaction for DML operations
    try {
        $pdo->beginTransaction();
        $inTransaction = true;
        
        $updateStmt = $pdo->prepare("
            UPDATE deliveries 
            SET Delivery_Status = 'Out for Delivery', Updated_At = NOW()
            WHERE Delivery_Status = 'On the Way'
        ");
        $updateStmt->execute();
        $rowsUpdated = $updateStmt->rowCount();
        
        $pdo->commit();
        $inTransaction = false;
        
        $results['step2'] = [
            'status' => 'completed',
            'message' => "Updated {$rowsUpdated} records from 'On the Way' to 'Out for Delivery'",
            'records_updated' => $rowsUpdated
        ];
    } catch (PDOException $e) {
        if ($inTransaction) {
            $pdo->rollBack();
            $inTransaction = false;
        }
        $results['step2'] = [
            'status' => 'skipped',
            'message' => 'No records to update or update failed',
            'error' => $e->getMessage()
        ];
    }
    
    // Step 3: Update the enum to include all required statuses
    // ALTER TABLE causes implicit commit, so we do this separately
    try {
        $alterStmt = $pdo->prepare("
            ALTER TABLE deliveries 
            MODIFY COLUMN Delivery_Status 
            ENUM('Pending', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled') 
            DEFAULT 'Pending'
        ");
        $alterStmt->execute();
        
        $results['step3'] = [
            'status' => 'completed',
            'message' => 'Delivery status enum updated successfully',
            'new_statuses' => ['Pending', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled']
        ];
    } catch (PDOException $e) {
        $results['step3'] = [
            'status' => 'error',
            'message' => 'Failed to update enum',
            'error' => $e->getMessage()
        ];
        throw $e; // Re-throw to trigger error response
    }
    
    // Step 4: Verify the change
    $verifyStmt = $pdo->query("
        SELECT COLUMN_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'deliveries' 
        AND COLUMN_NAME = 'Delivery_Status'
    ");
    $newEnum = $verifyStmt->fetch(PDO::FETCH_ASSOC);
    $newEnumType = $newEnum['COLUMN_TYPE'] ?? '';
    
    $results['step4'] = [
        'status' => 'completed',
        'message' => 'Enum verification complete',
        'new_enum' => $newEnumType
    ];
    
    // Return single JSON response
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'All changes applied successfully!',
        'steps' => $results,
        'summary' => [
            'records_updated' => $rowsUpdated,
            'old_enum' => $currentEnumType,
            'new_enum' => $newEnumType
        ]
    ], JSON_PRETTY_PRINT);
    
} catch (PDOException $e) {
    if ($inTransaction && isset($pdo)) {
        try {
            $pdo->rollBack();
        } catch (PDOException $rollbackError) {
            // Ignore rollback errors if transaction is already closed
        }
    }
    error_log("Fix Delivery Status Enum Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update enum',
        'error' => $e->getMessage(),
        'error_code' => $e->getCode(),
        'steps' => $results ?? []
    ], JSON_PRETTY_PRINT);
} catch (Exception $e) {
    if ($inTransaction && isset($pdo)) {
        try {
            $pdo->rollBack();
        } catch (Exception $rollbackError) {
            // Ignore rollback errors
        }
    }
    error_log("Fix Delivery Status Enum Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred',
        'error' => $e->getMessage(),
        'steps' => $results ?? []
    ], JSON_PRETTY_PRINT);
}

