<?php
/**
 * Create Product Archive System
 * Adds archive functionality to products table
 * Run this once to set up the archive system
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
    
    // Check if columns already exist
    $stmt = $pdo->query("SHOW COLUMNS FROM `products` LIKE 'is_archived'");
    $isArchivedExists = $stmt->rowCount() > 0;
    
    if (!$isArchivedExists) {
        // Add is_archived column
        $pdo->exec("ALTER TABLE `products` 
            ADD COLUMN `is_archived` TINYINT(1) DEFAULT 0 NOT NULL AFTER `weight_unit`");
        $results[] = "Added is_archived column";
    } else {
        $results[] = "is_archived column already exists";
    }
    
    $stmt = $pdo->query("SHOW COLUMNS FROM `products` LIKE 'archived_at'");
    $archivedAtExists = $stmt->rowCount() > 0;
    
    if (!$archivedAtExists) {
        // Add archived_at column
        $pdo->exec("ALTER TABLE `products` 
            ADD COLUMN `archived_at` TIMESTAMP NULL DEFAULT NULL AFTER `is_archived`");
        $results[] = "Added archived_at column";
    } else {
        $results[] = "archived_at column already exists";
    }
    
    $stmt = $pdo->query("SHOW COLUMNS FROM `products` LIKE 'archived_by'");
    $archivedByExists = $stmt->rowCount() > 0;
    
    if (!$archivedByExists) {
        // Add archived_by column
        $pdo->exec("ALTER TABLE `products` 
            ADD COLUMN `archived_by` INT(11) NULL DEFAULT NULL AFTER `archived_at`");
        $results[] = "Added archived_by column";
    } else {
        $results[] = "archived_by column already exists";
    }
    
    // Check if indexes exist
    $stmt = $pdo->query("SHOW INDEXES FROM `products` WHERE Key_name = 'idx_is_archived'");
    $indexExists = $stmt->rowCount() > 0;
    
    if (!$indexExists) {
        // Add index for better query performance
        $pdo->exec("ALTER TABLE `products` ADD INDEX `idx_is_archived` (`is_archived`)");
        $results[] = "Added idx_is_archived index";
    } else {
        $results[] = "idx_is_archived index already exists";
    }
    
    $stmt = $pdo->query("SHOW INDEXES FROM `products` WHERE Key_name = 'idx_archived_at'");
    $archivedAtIndexExists = $stmt->rowCount() > 0;
    
    if (!$archivedAtIndexExists) {
        // Add index for archived_at
        $pdo->exec("ALTER TABLE `products` ADD INDEX `idx_archived_at` (`archived_at`)");
        $results[] = "Added idx_archived_at index";
    } else {
        $results[] = "idx_archived_at index already exists";
    }
    
    // Update existing products to ensure they are not archived
    $pdo->exec("UPDATE `products` SET `is_archived` = 0 WHERE `is_archived` IS NULL");
    $results[] = "Updated existing products to not be archived";
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Product archive system created successfully',
        'results' => $results
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Create Archive System Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to create archive system: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Create Archive System Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to create archive system: ' . $e->getMessage()
    ]);
}
?>

