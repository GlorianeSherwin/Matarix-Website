<?php
/**
 * Database Migration: Add Thumbnails Column
 * Adds thumbnails column to products table for storing thumbnail image paths as JSON array
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    $pdo->beginTransaction();
    $results = [];

    // Check if thumbnails column exists
    $checkColumn = $pdo->query("SHOW COLUMNS FROM products LIKE 'thumbnails'");
    if ($checkColumn->rowCount() == 0) {
        // Add thumbnails column
        $pdo->exec("ALTER TABLE products ADD COLUMN thumbnails TEXT DEFAULT NULL AFTER image_path");
        $results[] = "Added 'thumbnails' column to 'products' table.";
    } else {
        $results[] = "'thumbnails' column already exists, skipping creation.";
    }

    $pdo->commit();

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Migration completed successfully.',
        'results' => $results
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Migration Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage()
    ]);
}
?>

