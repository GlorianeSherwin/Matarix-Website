<?php
/**
 * Migration Script: Add address_barangay column to users table
 * This script adds the address_barangay column to store barangay information
 * Access via: http://localhost/MatarixWEBs/api/migrate_add_barangay.php
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Start transaction
    $pdo->beginTransaction();
    
    $results = [];
    
    // Check if address_barangay column exists
    $checkColumns = $pdo->query("SHOW COLUMNS FROM users LIKE 'address_barangay'");
    if ($checkColumns->rowCount() == 0) {
        // Add address_barangay column after address_city
        $pdo->exec("ALTER TABLE users ADD COLUMN address_barangay VARCHAR(100) NULL AFTER address_city");
        $results[] = "Added address_barangay column to users table";
    } else {
        $results[] = "address_barangay column already exists";
    }
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Migration completed successfully',
        'results' => $results
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage(),
        'error' => $e->getMessage()
    ]);
}

