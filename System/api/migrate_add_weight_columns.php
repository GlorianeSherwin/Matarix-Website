<?php
/**
 * Add Weight Columns to Products Table
 * Adds weight and weight_unit columns to the products table
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    $pdo->beginTransaction();
    $results = [];

    // Check if weight column exists
    $checkWeight = $pdo->query("SHOW COLUMNS FROM products LIKE 'weight'");
    if ($checkWeight->rowCount() == 0) {
        // Add weight column
        $pdo->exec("ALTER TABLE products ADD COLUMN weight DECIMAL(10,2) NULL DEFAULT NULL AFTER Unit");
        $results[] = "Added weight column";
    } else {
        $results[] = "weight column already exists, skipping migration";
    }

    // Check if weight_unit column exists
    $checkWeightUnit = $pdo->query("SHOW COLUMNS FROM products LIKE 'weight_unit'");
    if ($checkWeightUnit->rowCount() == 0) {
        // Add weight_unit column
        $pdo->exec("ALTER TABLE products ADD COLUMN weight_unit ENUM('kg', 'g', 'lb', 'oz', 'ton') NULL DEFAULT NULL AFTER weight");
        $results[] = "Added weight_unit column";
    } else {
        $results[] = "weight_unit column already exists, skipping migration";
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Weight columns migration completed successfully',
        'results' => $results
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Weight columns migration error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred during weight columns migration: ' . $e->getMessage()
    ]);
}
?>

