<?php
/**
 * Add Description Column to Products Table
 * Run this once to add the description column
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Check if column already exists
    $stmt = $pdo->query("SHOW COLUMNS FROM products LIKE 'description'");
    if ($stmt->rowCount() > 0) {
        http_response_code(200);
        echo json_encode([
            'success' => false,
            'message' => 'Description column already exists'
        ]);
        exit;
    }
    
    // Add description column
    $pdo->exec("ALTER TABLE products ADD COLUMN description TEXT NULL AFTER Product_Name");
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Description column added successfully'
    ]);
    
} catch (Exception $e) {
    error_log("Add Description Column Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred: ' . $e->getMessage()
    ]);
}

