<?php
/**
 * Migration Script: Rename address_province to address_district
 * This script renames the address_province column to address_district in the users table
 * Access via: http://localhost/MatarixWEBs/api/migrate_province_to_district.php
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Start transaction
    $pdo->beginTransaction();
    
    $results = [];
    
    // Check if address_province column exists
    $checkColumns = $pdo->query("SHOW COLUMNS FROM users LIKE 'address_province'");
    if ($checkColumns->rowCount() > 0) {
        // Check if address_district already exists
        $checkDistrict = $pdo->query("SHOW COLUMNS FROM users LIKE 'address_district'");
        if ($checkDistrict->rowCount() == 0) {
            // Rename address_province to address_district
            $pdo->exec("ALTER TABLE users CHANGE COLUMN address_province address_district VARCHAR(100) NULL");
            $results[] = "Renamed address_province column to address_district";
        } else {
            $results[] = "address_district column already exists, skipping rename";
        }
    } else {
        // Check if address_district exists
        $checkDistrict = $pdo->query("SHOW COLUMNS FROM users LIKE 'address_district'");
        if ($checkDistrict->rowCount() == 0) {
            // Add address_district column if neither exists
            $pdo->exec("ALTER TABLE users ADD COLUMN address_district VARCHAR(100) NULL AFTER address_city");
            $results[] = "Added address_district column (address_province did not exist)";
        } else {
            $results[] = "address_district column already exists";
        }
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

