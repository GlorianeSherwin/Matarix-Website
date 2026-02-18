<?php
/**
 * Migration Script: Add Structured Address Fields
 * This script adds structured address fields to the users table
 * Access via: http://localhost/MatarixWEBs/api/migrate_address_fields.php
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Start transaction
    $pdo->beginTransaction();
    
    $results = [];
    
    // Check if address fields already exist
    $checkColumns = $pdo->query("SHOW COLUMNS FROM users LIKE 'address_street'");
    if ($checkColumns->rowCount() == 0) {
        // Add new address fields
        $pdo->exec("ALTER TABLE users 
            ADD COLUMN address_street VARCHAR(255) NULL AFTER address,
            ADD COLUMN address_city VARCHAR(100) NULL AFTER address_street,
            ADD COLUMN address_province VARCHAR(100) NULL AFTER address_city,
            ADD COLUMN address_postal_code VARCHAR(20) NULL AFTER address_province,
            ADD COLUMN address_country VARCHAR(100) DEFAULT 'Philippines' AFTER address_postal_code");
        
        $results[] = "Added structured address fields (street, city, province, postal_code, country)";
        
        // Migrate existing address data to address_street
        $pdo->exec("UPDATE users SET address_street = address WHERE address IS NOT NULL AND address != ''");
        $results[] = "Migrated existing address data to address_street field";
    } else {
        $results[] = "Address fields already exist, skipping migration";
    }
    
    // Keep the old address field for backward compatibility (can be removed later)
    // For now, we'll maintain both
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Address fields migration completed successfully',
        'results' => $results
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage()
    ]);
}

