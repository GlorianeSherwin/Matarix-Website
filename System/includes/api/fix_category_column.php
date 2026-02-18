<?php
/**
 * Fix Category Column Migration
 * Converts products.category from ENUM to VARCHAR to support dynamic categories
 * Also fixes existing NULL categories
 * 
 * Access via: http://localhost/MatarixWEBs/api/fix_category_column.php
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    $results = [];
    
    // Check current column type
    $columnInfo = $pdo->query("SHOW COLUMNS FROM products WHERE Field = 'category'")->fetch(PDO::FETCH_ASSOC);
    $currentType = $columnInfo['Type'] ?? 'unknown';
    $results[] = "Current category column type: $currentType";
    
    // Check if categories table exists
    $categoriesTableExists = $pdo->query("SHOW TABLES LIKE 'categories'")->rowCount() > 0;
    
    if (!$categoriesTableExists) {
        echo json_encode([
            'success' => false,
            'message' => 'Categories table does not exist. Please run migrate_categories_table.php first.',
            'results' => $results
        ]);
        exit;
    }
    
    // Step 1: Change ENUM to VARCHAR if needed
    // Note: ALTER TABLE performs an implicit commit, so we do this outside of a transaction
    if (stripos($currentType, 'enum') !== false) {
        $pdo->exec("ALTER TABLE products MODIFY COLUMN category VARCHAR(100) NOT NULL DEFAULT 'Uncategorized'");
        $results[] = "Changed category column from ENUM to VARCHAR(100)";
    } else {
        $results[] = "Category column is already VARCHAR or another type";
    }
    
    // Step 2: Fix NULL categories by matching with categories table
    // Start transaction for data changes (after ALTER TABLE)
    $pdo->beginTransaction();
    
    try {
        // Get all products with NULL categories
        $nullProducts = $pdo->query("SELECT Product_ID, Product_Name FROM products WHERE category IS NULL OR category = ''")->fetchAll(PDO::FETCH_ASSOC);
        
        if (count($nullProducts) > 0) {
            $results[] = "Found " . count($nullProducts) . " products with NULL or empty categories";
            
            // Get default category (first active category or 'Uncategorized')
            $defaultCategoryStmt = $pdo->query("SELECT category_name FROM categories WHERE is_active = 1 ORDER BY display_order ASC, Category_ID ASC LIMIT 1");
            $defaultCategory = $defaultCategoryStmt->fetchColumn();
            
            if (!$defaultCategory) {
                $defaultCategory = 'Uncategorized';
                // Create Uncategorized category if it doesn't exist
                $pdo->exec("INSERT INTO categories (category_name, category_icon, is_active) VALUES ('Uncategorized', 'fas fa-box', 1) ON DUPLICATE KEY UPDATE is_active = 1");
            }
            
            // Update NULL categories to default
            $updateStmt = $pdo->prepare("UPDATE products SET category = :category WHERE (category IS NULL OR category = '')");
            $updateStmt->execute(['category' => $defaultCategory]);
            $updated = $updateStmt->rowCount();
            $results[] = "Updated $updated products with NULL categories to '$defaultCategory'";
        } else {
            $results[] = "No products with NULL categories found";
        }
        
        // Step 3: Ensure all product categories exist in categories table
        $productCategories = $pdo->query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ''")->fetchAll(PDO::FETCH_COLUMN);
        $missingCategories = [];
        
        foreach ($productCategories as $catName) {
            $checkStmt = $pdo->prepare("SELECT Category_ID FROM categories WHERE category_name = :name");
            $checkStmt->execute(['name' => $catName]);
            if (!$checkStmt->fetch()) {
                $missingCategories[] = $catName;
                // Create missing category
                $insertStmt = $pdo->prepare("INSERT INTO categories (category_name, category_icon, is_active) VALUES (:name, 'fas fa-box', 1)");
                $insertStmt->execute(['name' => $catName]);
            }
        }
        
        if (count($missingCategories) > 0) {
            $results[] = "Created " . count($missingCategories) . " missing categories: " . implode(', ', $missingCategories);
        } else {
            $results[] = "All product categories exist in categories table";
        }
        
        // Commit transaction
        if ($pdo->inTransaction()) {
            $pdo->commit();
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Category column migration completed successfully',
            'results' => $results
        ]);
        
    } catch (Exception $e) {
        // Rollback only if transaction is still active
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    
} catch (Exception $e) {
    error_log("Fix Category Column Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred: ' . $e->getMessage(),
        'results' => $results ?? []
    ]);
}
?>

