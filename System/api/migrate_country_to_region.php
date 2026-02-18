<?php
/**
 * Migration Script: Rename address_country to address_region and set default to NULL
 * This script renames the address_country column to address_region in the users table
 * and sets the default value to NULL
 * Access via: http://localhost/MatarixWEBs/api/migrate_country_to_region.php
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Start transaction
    $pdo->beginTransaction();
    
    $results = [];
    
    // Check if address_country column exists
    $checkColumns = $pdo->query("SHOW COLUMNS FROM users LIKE 'address_country'");
    if ($checkColumns->rowCount() > 0) {
        // Check if address_region already exists
        $checkRegion = $pdo->query("SHOW COLUMNS FROM users LIKE 'address_region'");
        if ($checkRegion->rowCount() == 0) {
            // Rename address_country to address_region and set default to NULL
            $pdo->exec("ALTER TABLE users CHANGE COLUMN address_country address_region VARCHAR(100) NULL DEFAULT NULL");
            $results[] = "Renamed address_country column to address_region and set default to NULL";
        } else {
            $results[] = "address_region column already exists, skipping rename";
        }
    } else {
        // Check if address_region exists
        $checkRegion = $pdo->query("SHOW COLUMNS FROM users LIKE 'address_region'");
        if ($checkRegion->rowCount() == 0) {
            // Add address_region column if neither exists
            $pdo->exec("ALTER TABLE users ADD COLUMN address_region VARCHAR(100) NULL DEFAULT NULL AFTER address_postal_code");
            $results[] = "Added address_region column (address_country did not exist)";
        } else {
            $results[] = "address_region column already exists";
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

