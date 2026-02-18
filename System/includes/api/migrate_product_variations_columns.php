<?php
/**
 * Migration: Add price_modifier, stock_level, image_path, sku to product_variations
 * Enables per-variation pricing, stock, and images
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    $columns = [
        ['price_modifier', "DECIMAL(10,2) DEFAULT NULL COMMENT 'Price adjustment vs base product (add to base price). NULL = use base price.'"],
        ['stock_level', "INT(11) DEFAULT NULL COMMENT 'Stock for this variation. NULL = use product-level stock.'"],
        ['image_path', "VARCHAR(255) DEFAULT NULL COMMENT 'Optional image for this variation'"],
        ['sku', "VARCHAR(100) DEFAULT NULL COMMENT 'Optional SKU for this variation'"]
    ];
    
    $results = [];
    foreach ($columns as $col) {
        $name = $col[0];
        $def = $col[1];
        $check = $pdo->query("SHOW COLUMNS FROM product_variations LIKE '{$name}'");
        if ($check->rowCount() == 0) {
            $pdo->exec("ALTER TABLE product_variations ADD COLUMN {$name} {$def}");
            $results[] = "Added column: {$name}";
        } else {
            $results[] = "Column already exists: {$name}";
        }
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Product variations columns migration completed',
        'results' => $results
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage()
    ]);
}
