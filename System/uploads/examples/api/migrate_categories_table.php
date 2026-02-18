<?php
/**
 * Migration Script: Create Categories Table
 * This script creates a categories table and migrates data from ENUM
 * Access via: http://localhost/MatarixWEBs/api/migrate_categories_table.php
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Start transaction
    $pdo->beginTransaction();
    
    $results = [];
    
    // Check if categories table exists
    $tableExists = $pdo->query("SHOW TABLES LIKE 'categories'")->rowCount() > 0;
    
    if (!$tableExists) {
        // Create categories table
        $pdo->exec("CREATE TABLE IF NOT EXISTS categories (
            Category_ID INT(11) NOT NULL AUTO_INCREMENT,
            category_name VARCHAR(100) NOT NULL,
            category_description TEXT NULL,
            category_icon VARCHAR(50) DEFAULT 'fas fa-box',
            display_order INT(11) DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (Category_ID),
            UNIQUE KEY unique_category_name (category_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        
        $results[] = "Created categories table";
        
        // Insert existing categories from ENUM
        $existingCategories = [
            ['Cement & Concrete Products', 'fas fa-hammer', 1],
            ['Masonry', 'fas fa-th-large', 2],
            ['Sand & Gravel', 'fas fa-mountain', 3],
            ['Lumber & Wood', 'fas fa-tree', 4],
            ['Steel & Metal', 'fas fa-industry', 5],
            ['Roofing & Insulation', 'fas fa-home', 6],
            ['Pipes & Plumbing', 'fas fa-faucet', 7],
            ['Paints & Finishes', 'fas fa-paint-brush', 8],
            ['Tools & Hardware', 'fas fa-tools', 9],
            ['Electrical', 'fas fa-bolt', 10]
        ];
        
        $insertStmt = $pdo->prepare("INSERT INTO categories (category_name, category_icon, display_order) VALUES (?, ?, ?)");
        foreach ($existingCategories as $cat) {
            $insertStmt->execute($cat);
        }
        
        $results[] = "Inserted " . count($existingCategories) . " existing categories";
        
        // Add category_id column to products table (for future migration)
        $checkColumn = $pdo->query("SHOW COLUMNS FROM products LIKE 'category_id'");
        if ($checkColumn->rowCount() == 0) {
            $pdo->exec("ALTER TABLE products ADD COLUMN category_id INT(11) NULL AFTER category");
            $results[] = "Added category_id column to products table";
            
            // Link existing products to categories
            $linkStmt = $pdo->prepare("
                UPDATE products p
                INNER JOIN categories c ON p.category = c.category_name
                SET p.category_id = c.Category_ID
            ");
            $linkStmt->execute();
            $results[] = "Linked existing products to categories";
        }
        
    } else {
        $results[] = "Categories table already exists";
    }
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Categories migration completed successfully',
        'results' => $results
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage(),
        'error' => $e->getTraceAsString()
    ]);
}

