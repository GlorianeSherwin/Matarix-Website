<?php
/**
 * Migrate to Category ID Foreign Key
 * This script migrates products to use category_id instead of category name
 * This creates a proper foreign key relationship between products and categories
 * 
 * Access via: http://localhost/MatarixWEBs/api/migrate_to_category_id.php
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    $results = [];
    
    // Check if categories table exists
    $categoriesTableExists = $pdo->query("SHOW TABLES LIKE 'categories'")->rowCount() > 0;
    
    if (!$categoriesTableExists) {
        echo json_encode([
            'success' => false,
            'message' => 'Categories table does not exist. Please run migrate_categories_table.php first.',
            'results' => []
        ]);
        exit;
    }
    
    // Check if category_id column exists
    $categoryIdExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'category_id'")->rowCount() > 0;
    
    if (!$categoryIdExists) {
        // Add category_id column
        $pdo->exec("ALTER TABLE products ADD COLUMN category_id INT(11) NULL AFTER category");
        $results[] = "Added category_id column to products table";
    } else {
        $results[] = "category_id column already exists";
    }
    
    // Step 1: Link products to categories by matching category names
    // Start transaction for data updates (before ALTER TABLE statements)
    $pdo->beginTransaction();
    
    try {
        $linkStmt = $pdo->prepare("
            UPDATE products p
            INNER JOIN categories c ON TRIM(p.category) = TRIM(c.category_name)
            SET p.category_id = c.Category_ID
            WHERE p.category_id IS NULL
        ");
        $linkStmt->execute();
        $linked = $linkStmt->rowCount();
        $results[] = "Linked $linked products to categories by name";
        
        // Step 2: Handle products with categories that don't exist in categories table
        $orphanedProducts = $pdo->query("
            SELECT DISTINCT p.category 
            FROM products p 
            LEFT JOIN categories c ON TRIM(p.category) = TRIM(c.category_name)
            WHERE p.category IS NOT NULL 
            AND p.category != '' 
            AND c.Category_ID IS NULL
            AND p.category_id IS NULL
        ")->fetchAll(PDO::FETCH_COLUMN);
        
        if (count($orphanedProducts) > 0) {
            $results[] = "Found " . count($orphanedProducts) . " orphaned categories: " . implode(', ', $orphanedProducts);
            
            // Create missing categories
            $insertStmt = $pdo->prepare("INSERT INTO categories (category_name, category_icon, is_active) VALUES (:name, 'fas fa-box', 1)");
            foreach ($orphanedProducts as $catName) {
                try {
                    $insertStmt->execute(['name' => trim($catName)]);
                    $newCategoryId = $pdo->lastInsertId();
                    
                    // Link products to the newly created category
                    $updateStmt = $pdo->prepare("UPDATE products SET category_id = :cat_id WHERE TRIM(category) = :cat_name AND category_id IS NULL");
                    $updateStmt->execute(['cat_id' => $newCategoryId, 'cat_name' => trim($catName)]);
                } catch (PDOException $e) {
                    // Category might already exist (duplicate key), try to link again
                    $catStmt = $pdo->prepare("SELECT Category_ID FROM categories WHERE category_name = :name");
                    $catStmt->execute(['name' => trim($catName)]);
                    $catId = $catStmt->fetchColumn();
                    if ($catId) {
                        $updateStmt = $pdo->prepare("UPDATE products SET category_id = :cat_id WHERE TRIM(category) = :cat_name AND category_id IS NULL");
                        $updateStmt->execute(['cat_id' => $catId, 'cat_name' => trim($catName)]);
                    }
                }
            }
            $results[] = "Created missing categories and linked products";
        }
        
        // Step 3: Set default category for any remaining NULL category_id
        $defaultCategoryStmt = $pdo->query("SELECT Category_ID FROM categories WHERE is_active = 1 ORDER BY display_order ASC, Category_ID ASC LIMIT 1");
        $defaultCategoryId = $defaultCategoryStmt->fetchColumn();
        
        if ($defaultCategoryId) {
            $defaultStmt = $pdo->prepare("UPDATE products SET category_id = :cat_id WHERE category_id IS NULL");
            $defaultStmt->execute(['cat_id' => $defaultCategoryId]);
            $defaulted = $defaultStmt->rowCount();
            if ($defaulted > 0) {
                $results[] = "Set default category for $defaulted products with NULL category_id";
            }
        }
        
        // Commit data changes before ALTER TABLE (which performs implicit commit)
        if ($pdo->inTransaction()) {
            $pdo->commit();
        }
        
        // Step 4: Make category_id NOT NULL and add foreign key constraint
        // Note: ALTER TABLE performs an implicit commit, so we do this outside of a transaction
        // First, ensure all products have a category_id
        $nullCount = $pdo->query("SELECT COUNT(*) FROM products WHERE category_id IS NULL")->fetchColumn();
        if ($nullCount > 0) {
            throw new Exception("Cannot proceed: $nullCount products still have NULL category_id");
        }
        
        // Make category_id NOT NULL
        $pdo->exec("ALTER TABLE products MODIFY COLUMN category_id INT(11) NOT NULL");
        $results[] = "Made category_id NOT NULL";
        
        // Add foreign key constraint
        try {
            // Check if foreign key already exists
            $fkExists = $pdo->query("
                SELECT COUNT(*) 
                FROM information_schema.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'products' 
                AND COLUMN_NAME = 'category_id' 
                AND REFERENCED_TABLE_NAME = 'categories'
            ")->fetchColumn();
            
            if (!$fkExists) {
                $pdo->exec("ALTER TABLE products ADD CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(Category_ID) ON DELETE RESTRICT ON UPDATE CASCADE");
                $results[] = "Added foreign key constraint";
            } else {
                $results[] = "Foreign key constraint already exists";
            }
        } catch (PDOException $e) {
            // Foreign key might already exist or there's an issue
            $results[] = "Note: Could not add foreign key constraint: " . $e->getMessage();
        }
        
        // Step 5: Optionally, we can keep the category column for backward compatibility
        // Or remove it if you want to use only category_id
        // For now, we'll keep it but it will be redundant
        
        echo json_encode([
            'success' => true,
            'message' => 'Migration to category_id completed successfully. Products now use category_id foreign key.',
            'results' => $results,
            'note' => 'The category column still exists for backward compatibility. You can remove it later if desired.'
        ]);
        
    } catch (Exception $e) {
        // Rollback only if transaction is still active
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    
} catch (Exception $e) {
    error_log("Migrate to Category ID Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred: ' . $e->getMessage(),
        'results' => $results ?? []
    ]);
}
?>

