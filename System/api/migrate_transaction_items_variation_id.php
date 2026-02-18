<?php
/**
 * Migration: Add Variation_ID to transaction_items
 * Enables hybrid stock tracking - deduct from variation when it has stock_level, else from product
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    $check = $pdo->query("SHOW COLUMNS FROM transaction_items LIKE 'Variation_ID'");
    if ($check->rowCount() == 0) {
        $pdo->exec("ALTER TABLE transaction_items ADD COLUMN Variation_ID INT(11) DEFAULT NULL COMMENT 'FK to product_variations. Variation with stock_level used for hybrid stock deduction.'");
        $result = "Added column Variation_ID";
    } else {
        $result = "Column Variation_ID already exists";
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Transaction items variation_id migration completed',
        'result' => $result
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage()
    ]);
}
