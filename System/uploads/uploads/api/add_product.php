<?php
/**
 * Add Product API
 * Handles adding new products with variations to the database
 */

// Suppress HTML error output - we want JSON only
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start output buffering to catch any unexpected output
ob_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ob_end_clean(); // Clear any output
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed. Use POST.'
    ]);
    exit;
}

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: product management (Store Employee + Admin)
rbac_require_permission_api('products.add');

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields (category can be category_id or category)
$requiredFields = ['product_name', 'price', 'stock_level', 'minimum_stock', 'description'];
foreach ($requiredFields as $field) {
    if (!isset($input[$field]) || empty($input[$field])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => "Missing required field: $field"
        ]);
        exit;
    }
}

// Validate category (either category_id or category must be provided)
if (!isset($input['category_id']) && !isset($input['category'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Category is required (provide either category_id or category)'
    ]);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Check and create missing columns BEFORE starting transaction
    // (ALTER TABLE causes implicit commit, so do this first)
    try {
        $checkColumn = $pdo->query("SHOW COLUMNS FROM products LIKE 'image_path'");
        if ($checkColumn->rowCount() == 0) {
            $pdo->exec("ALTER TABLE products ADD COLUMN image_path VARCHAR(255) DEFAULT NULL AFTER description");
        }
    } catch (Exception $e) {
        // Column might already exist, continue
    }
    
    try {
        $checkThumbnailsColumn = $pdo->query("SHOW COLUMNS FROM products LIKE 'thumbnails'");
        if ($checkThumbnailsColumn->rowCount() == 0) {
            $pdo->exec("ALTER TABLE products ADD COLUMN thumbnails TEXT DEFAULT NULL AFTER image_path");
        }
    } catch (Exception $e) {
        // Column might already exist, continue
    }
    
    try {
        $checkStockUnitColumn = $pdo->query("SHOW COLUMNS FROM products LIKE 'stock_unit'");
        if ($checkStockUnitColumn->rowCount() == 0) {
            $pdo->exec("ALTER TABLE products ADD COLUMN stock_unit VARCHAR(10) DEFAULT 'PC' AFTER stock_level");
        }
    } catch (Exception $e) {
        // Column might already exist, continue
    }
    
    // Start transaction AFTER column checks (ALTER TABLE causes implicit commit)
    $pdo->beginTransaction();
    
    // Get category_id - support both category_id and category name for backward compatibility
    $categoryId = null;
    $categoryName = null;
    $categoriesTableExists = $pdo->query("SHOW TABLES LIKE 'categories'")->rowCount() > 0;
    $categoryIdColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'category_id'")->rowCount() > 0;
    
    if ($categoriesTableExists) {
        // Check if category_id is provided directly (handle string "0" and empty string)
        $providedCategoryId = isset($input['category_id']) ? trim($input['category_id']) : null;
        if ($providedCategoryId !== null && $providedCategoryId !== '' && $providedCategoryId !== '0' && (int)$providedCategoryId > 0) {
            $categoryId = (int)$providedCategoryId;
            // Validate category_id exists and is active
            $catStmt = $pdo->prepare("SELECT Category_ID, category_name FROM categories WHERE Category_ID = :id AND is_active = 1 LIMIT 1");
            $catStmt->execute(['id' => $categoryId]);
            $catRow = $catStmt->fetch(PDO::FETCH_ASSOC);
            if (!$catRow) {
                throw new Exception("Invalid category_id: $categoryId. Please select a valid category.");
            }
            $categoryName = $catRow['category_name'];
        } elseif (isset($input['category']) && !empty(trim($input['category']))) {
            // Category name provided - convert to category_id
            $categoryNameInput = trim($input['category']);
            $catStmt = $pdo->prepare("SELECT Category_ID, category_name FROM categories WHERE category_name = :name AND is_active = 1 LIMIT 1");
            $catStmt->execute(['name' => $categoryNameInput]);
            $catRow = $catStmt->fetch(PDO::FETCH_ASSOC);
            if ($catRow) {
                $categoryId = (int)$catRow['Category_ID'];
                $categoryName = $catRow['category_name'];
            } else {
                throw new Exception("Category not found: $categoryNameInput");
            }
        } else {
            // Neither category_id nor category provided
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Category is required (provide either category_id or category)'
            ]);
            exit;
        }
    } else {
        // Fallback: use category name if categories table doesn't exist
        $categoryName = isset($input['category']) ? trim($input['category']) : 'Uncategorized';
    }
    
    // Determine stock status based on stock level and minimum stock
    $stockLevel = (int)$input['stock_level'];
    $minimumStock = (int)$input['minimum_stock'];
    $stockStatus = 'Out of Stock';
    
    if ($stockLevel >= $minimumStock) {
        $stockStatus = 'In Stock';
    } elseif ($stockLevel > 0) {
        $stockStatus = 'Low Stock';
    }
    
    // Check if weight and weight_unit columns exist (needed before building productData)
    $weightColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'weight'")->rowCount() > 0;
    $weightUnitColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'weight_unit'")->rowCount() > 0;
    $stockUnitColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'stock_unit'")->rowCount() > 0;
    $lengthColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'length'")->rowCount() > 0;
    $widthColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'Width'")->rowCount() > 0;
    $unitColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'Unit'")->rowCount() > 0;
    
    // Prepare product data
    $productData = [
        'Product_Name' => trim($input['product_name']),
        'description' => trim($input['description']),
        'category' => $categoryName, // Keep for backward compatibility
        'stock_level' => $stockLevel,
        'Minimum_Stock' => $minimumStock,
        'stock_status' => $stockStatus,
        'price' => (float)$input['price'],
        'last_restock' => date('Y-m-d')
    ];
    
    // Add stock_unit if column exists
    if ($stockUnitColumnExists) {
        $productData['stock_unit'] = isset($input['stock_unit']) && !empty($input['stock_unit']) ? $input['stock_unit'] : 'PC';
    }
    
    // Add length, Width, Unit only if columns exist
    if ($lengthColumnExists) {
        $productData['length'] = isset($input['length']) && !empty($input['length']) ? trim($input['length']) : null;
    }
    if ($widthColumnExists) {
        $productData['Width'] = isset($input['width']) && !empty($input['width']) ? (float)$input['width'] : null;
    }
    if ($unitColumnExists) {
        $productData['Unit'] = isset($input['unit']) && !empty($input['unit']) ? $input['unit'] : null;
    }
    
    // Add weight and weight_unit only if columns exist
    if ($weightColumnExists) {
        $productData['weight'] = isset($input['weight']) && !empty($input['weight']) ? (float)$input['weight'] : null;
    }
    if ($weightUnitColumnExists) {
        $productData['weight_unit'] = isset($input['weight_unit']) && !empty($input['weight_unit']) ? $input['weight_unit'] : null;
    }
    
    // Add image_path and thumbnails
    if (isset($input['image_path']) && !empty($input['image_path'])) {
        $productData['image_path'] = trim($input['image_path']);
    }
    if (isset($input['thumbnails']) && is_array($input['thumbnails'])) {
        $productData['thumbnails'] = json_encode($input['thumbnails']);
    }
    
    // Add category_id if column exists
    if ($categoryIdColumnExists && $categoryId !== null) {
        $productData['category_id'] = $categoryId;
    }
    
    // Build SQL query - only include columns that exist in productData
    $columns = "Product_Name, description, category, stock_level, Minimum_Stock, stock_status, price, last_restock";
    $placeholders = ":Product_Name, :description, :category, :stock_level, :Minimum_Stock, :stock_status, :price, :last_restock";
    
    // Add fields conditionally based on what's in productData
    if (isset($productData['stock_unit'])) {
        $columns .= ", stock_unit";
        $placeholders .= ", :stock_unit";
    }
    
    if (isset($productData['length'])) {
        $columns .= ", length";
        $placeholders .= ", :length";
    }
    
    if (isset($productData['Width'])) {
        $columns .= ", Width";
        $placeholders .= ", :Width";
    }
    
    if (isset($productData['Unit'])) {
        $columns .= ", Unit";
        $placeholders .= ", :Unit";
    }
    
    if (isset($productData['weight'])) {
        $columns .= ", weight";
        $placeholders .= ", :weight";
    }
    
    if (isset($productData['weight_unit'])) {
        $columns .= ", weight_unit";
        $placeholders .= ", :weight_unit";
    }
    
    if (isset($productData['image_path'])) {
        $columns .= ", image_path";
        $placeholders .= ", :image_path";
    }
    
    if (isset($productData['thumbnails'])) {
        $columns .= ", thumbnails";
        $placeholders .= ", :thumbnails";
    }
    
    if (isset($productData['category_id'])) {
        $columns .= ", category_id";
        $placeholders .= ", :category_id";
    }
    
    $sql = "INSERT INTO products ($columns) VALUES ($placeholders)";
    
    // Execute the insert - productData already contains only the fields we need
    try {
        $stmt = $pdo->prepare($sql);
        // Remove null values to avoid binding issues (but keep empty strings and 0)
        $executeData = array_filter($productData, function($value) {
            return $value !== null;
        });
        $stmt->execute($executeData);
    } catch (PDOException $e) {
        // If description column doesn't exist, try to add it
        if (strpos($e->getMessage(), 'description') !== false) {
            try {
                $pdo->exec("ALTER TABLE products ADD COLUMN description TEXT NULL AFTER Product_Name");
                // Retry the insert
                $stmt = $pdo->prepare($sql);
                $executeData = array_filter($productData, function($value) {
                    return $value !== null;
                });
                $stmt->execute($executeData);
            } catch (Exception $alterError) {
                throw new Exception("Failed to add description column: " . $alterError->getMessage());
            }
        } else {
            throw $e;
        }
    }
    
    $productId = $pdo->lastInsertId();
    
    // Insert product variations if provided
    $variationsInserted = 0;
    if (isset($input['variations']) && is_array($input['variations']) && count($input['variations']) > 0) {
        $variationSql = "INSERT INTO product_variations (Product_ID, variation_name, variation_value) VALUES (:product_id, :variation_name, :variation_value)";
        $variationStmt = $pdo->prepare($variationSql);
        
        foreach ($input['variations'] as $variation) {
            if (isset($variation['variation_name']) && isset($variation['variation_value']) && 
                !empty(trim($variation['variation_name'])) && !empty(trim($variation['variation_value']))) {
                $variationStmt->execute([
                    'product_id' => $productId,
                    'variation_name' => trim($variation['variation_name']),
                    'variation_value' => trim($variation['variation_value'])
                ]);
                $variationsInserted++;
            }
        }
    }
    
    // Commit transaction
    $pdo->commit();
    
    // Create notification for product added
    require_once __DIR__ . '/create_admin_activity_notification.php';
    $productName = $input['product_name'] ?? 'Product';
    createAdminActivityNotification($pdo, 'product_added', [
        'product_name' => $productName,
        'message' => "New product added: {$productName}"
    ]);
    
    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Product added successfully',
        'product_id' => $productId,
        'variations_inserted' => $variationsInserted
    ]);
    
} catch (Exception $e) {
    // Rollback transaction on error (only if transaction is still active)
    // Note: ALTER TABLE causes implicit commit, so transaction might not be active
    try {
        if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
        }
    } catch (Exception $rollbackException) {
        // Ignore rollback errors (transaction might have been auto-committed by ALTER TABLE)
        error_log("Rollback error (likely due to ALTER TABLE implicit commit): " . $rollbackException->getMessage());
    }
    
    // Clear any unexpected output before sending JSON
    ob_end_clean();
    
    error_log("Add Product API Error: " . $e->getMessage());
    error_log("Add Product API Error Trace: " . $e->getTraceAsString());
    error_log("Add Product API Input: " . json_encode($input));
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while adding the product: ' . $e->getMessage(),
        'error_details' => $e->getMessage()
    ]);
}
?>

