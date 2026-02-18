<?php
/**
 * Update Delivery Status Enum (PHP Script)
 * Adds new delivery status values: 'preparing', 'out for delivery'
 * This script updates the deliveries table enum to support the new statuses
 * 
 * NOTE: You can also run the SQL script directly: api/migrate_delivery_status_enum.sql
 * Current enum: 'Pending','On the Way','Delivered','Cancelled'
 * New enum: 'Pending', 'preparing', 'out for delivery', 'On the Way', 'Delivered', 'Cancelled'
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Update the Delivery_Status enum to include new statuses
    // Note: MySQL requires dropping and recreating the column to modify ENUM
    // This preserves existing data
    $pdo->exec("
        ALTER TABLE deliveries 
        MODIFY COLUMN Delivery_Status 
        ENUM('Pending', 'preparing', 'out for delivery', 'On the Way', 'Delivered', 'Cancelled') 
        DEFAULT 'Pending'
    ");
    
    echo json_encode([
        'success' => true,
        'message' => 'Delivery status enum updated successfully. New statuses available: preparing, out for delivery'
    ]);
    
} catch (PDOException $e) {
    error_log("Update Delivery Status Enum Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update enum: ' . $e->getMessage(),
        'hint' => 'You can also run the SQL script directly: api/migrate_delivery_status_enum.sql'
    ]);
}
?>

