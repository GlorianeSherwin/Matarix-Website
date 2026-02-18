<?php
/**
 * Migration: Add delivery_method column to orders table
 * Run this once to add the delivery_method column
 */

require_once __DIR__ . '/../includes/db_functions.php';

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Check if column already exists
    $checkStmt = $pdo->query("SHOW COLUMNS FROM orders LIKE 'delivery_method'");
    if ($checkStmt->rowCount() > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Column delivery_method already exists'
        ]);
        exit;
    }
    
    // Add delivery_method column
    $pdo->exec("
        ALTER TABLE orders 
        ADD COLUMN delivery_method ENUM('Standard Delivery', 'Pick Up') DEFAULT 'Standard Delivery' 
        AFTER payment_method
    ");
    
    echo json_encode([
        'success' => true,
        'message' => 'Column delivery_method added successfully'
    ]);
} catch (PDOException $e) {
    error_log("Add delivery_method column error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to add column: ' . $e->getMessage()
    ]);
}
?>
