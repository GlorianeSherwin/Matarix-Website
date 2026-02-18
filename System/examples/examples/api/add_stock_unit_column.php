<?php
/**
 * Add Stock Unit Column to Products Table
 * Adds stock_unit column to track the unit of measurement for stock quantities
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    $pdo->beginTransaction();
    $results = [];
    
    // Check if stock_unit column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM `products` LIKE 'stock_unit'");
    $stockUnitExists = $stmt->rowCount() > 0;
    
    if (!$stockUnitExists) {
        // Add stock_unit column
        $pdo->exec("ALTER TABLE `products` 
            ADD COLUMN `stock_unit` VARCHAR(10) DEFAULT 'PC' AFTER `stock_level`");
        $results[] = "Added stock_unit column";
    } else {
        $results[] = "stock_unit column already exists";
    }
    
    // Update existing products to have default unit if NULL
    $pdo->exec("UPDATE `products` SET `stock_unit` = 'PC' WHERE `stock_unit` IS NULL");
    $results[] = "Updated existing products with default stock unit";
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Stock unit column migration completed successfully',
        'results' => $results
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Add Stock Unit Column Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to add stock unit column: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Add Stock Unit Column Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to add stock unit column: ' . $e->getMessage()
    ]);
}
?>

