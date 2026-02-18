<?php
/**
 * Update Product API
 * Handles updating existing products with variations in the database
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') {
    ob_end_clean(); // Clear any output
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed. Use POST or PUT.'
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
rbac_require_permission_api('products.edit');

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
if (!isset($input['product_id']) || empty($input['product_id'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Product ID is required'
    ]);
    exit;
}

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
    
    // Check if product exists
    $productId = (int)$input['product_id'];
    $stmt = $pdo->prepare("SELECT Product_ID FROM products WHERE Product_ID = :product_id LIMIT 1");
    $stmt->execute(['product_id' => $productId]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Product not found'
        ]);
        exit;
    }
    
    // Check and create missing columns BEFORE starting transaction
    // (ALTER TABLE causes implicit commit, so do this first)
    if (isset($input['image_path']) && !empty($input['image_path'])) {
        try {
            $checkColumn = $pdo->query("SHOW COLUMNS FROM products LIKE 'image_path'");
            if ($checkColumn->rowCount() == 0) {
                $pdo->exec("ALTER TABLE products ADD COLUMN image_path VARCHAR(255) DEFAULT NULL AFTER description");
            }
        } catch (Exception $e) {
            // Column might already exist, continue
        }
    }
    
    if (isset($input['thumbnails']) && is_array($input['thumbnails']) && count($input['thumbnails']) > 0) {
        try {
            $checkThumbnailsColumn = $pdo->query("SHOW COLUMNS FROM products LIKE 'thumbnails'");
            if ($checkThumbnailsColumn->rowCount() == 0) {
                $pdo->exec("ALTER TABLE products ADD COLUMN thumbnails TEXT DEFAULT NULL AFTER image_path");
            }
        } catch (Exception $e) {
            // Column might already exist, continue
        }
    }
    
    if (isset($input['stock_unit']) && !empty($input['stock_unit'])) {
        try {
            $checkStockUnitColumn = $pdo->query("SHOW COLUMNS FROM products LIKE 'stock_unit'");
            if ($checkStockUnitColumn->rowCount() == 0) {
                $pdo->exec("ALTER TABLE products ADD COLUMN stock_unit VARCHAR(10) DEFAULT 'PC' AFTER stock_level");
            }
        } catch (Exception $e) {
            // Column might already exist, continue
        }
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
            throw new Exception("Category is required (provide either category_id or category)");
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
    
    // Prepare product data
    $productData = [
        'Product_Name' => trim($input['product_name']),
        'description' => trim($input['description']),
        'category' => $categoryName, // Keep for backward compatibility
        'stock_level' => $stockLevel,
        'stock_unit' => isset($input['stock_unit']) ? $input['stock_unit'] : 'PC',
        'Minimum_Stock' => $minimumStock,
        'stock_status' => $stockStatus,
        'price' => (float)$input['price'],
        'length' => isset($input['length']) && !empty($input['length']) ? trim($input['length']) : null,
        'Width' => isset($input['width']) && !empty($input['width']) ? (float)$input['width'] : null,
        'Unit' => isset($input['unit']) && !empty($input['unit']) ? $input['unit'] : null,
        'product_id' => $productId
    ];
    
    // Add category_id if column exists
    if ($categoryIdColumnExists && $categoryId !== null) {
        $productData['category_id'] = $categoryId;
    }
    
    // Handle image_path if provided
    if (isset($input['image_path']) && !empty($input['image_path'])) {
        $productData['image_path'] = trim($input['image_path']);
    }
    
    // Handle thumbnails if provided (new thumbnails will replace existing ones)
    if (isset($input['thumbnails']) && is_array($input['thumbnails']) && count($input['thumbnails']) > 0) {
        $productData['thumbnails'] = json_encode($input['thumbnails']);
    }
    
    // Build UPDATE SQL query
    $updateFields = [];
    $updateValues = [];
    
    foreach ($productData as $key => $value) {
        if ($key !== 'product_id') {
            $updateFields[] = "`$key` = :$key";
            $updateValues[$key] = $value;
        }
    }
    
    $updateValues['product_id'] = $productId;
    
    $sql = "UPDATE products SET " . implode(', ', $updateFields) . " WHERE Product_ID = :product_id";
    
    // Execute update
    $stmt = $pdo->prepare($sql);
    $stmt->execute($updateValues);
    
    // Handle variations update
    $variationsUpdated = 0;
    if (isset($input['variations']) && is_array($input['variations'])) {
        // Delete existing variations that are not in the new list
        // First, get existing variation IDs
        $stmt = $pdo->prepare("SELECT Variation_ID FROM product_variations WHERE Product_ID = :product_id");
        $stmt->execute(['product_id' => $productId]);
        $existingVariationIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // Extract variation IDs from input (if they have variation_id)
        $newVariationIds = [];
        foreach ($input['variations'] as $variation) {
            if (isset($variation['variation_id'])) {
                $newVariationIds[] = (int)$variation['variation_id'];
            }
        }
        
        // Delete variations that are not in the new list
        if (!empty($existingVariationIds)) {
            $variationsToDelete = array_diff($existingVariationIds, $newVariationIds);
            if (!empty($variationsToDelete)) {
                $placeholders = implode(',', array_fill(0, count($variationsToDelete), '?'));
                $stmt = $pdo->prepare("DELETE FROM product_variations WHERE Variation_ID IN ($placeholders)");
                $stmt->execute(array_values($variationsToDelete));
            }
        }
        
        // Update or insert variations
        $variationSql = "INSERT INTO product_variations (Product_ID, variation_name, variation_value) VALUES (:product_id, :variation_name, :variation_value) 
                         ON DUPLICATE KEY UPDATE variation_name = :variation_name, variation_value = :variation_value";
        
        // For existing variations, use UPDATE
        $updateVariationSql = "UPDATE product_variations SET variation_name = :variation_name, variation_value = :variation_value WHERE Variation_ID = :variation_id AND Product_ID = :product_id";
        $insertVariationSql = "INSERT INTO product_variations (Product_ID, variation_name, variation_value) VALUES (:product_id, :variation_name, :variation_value)";
        
        foreach ($input['variations'] as $variation) {
            if (isset($variation['variation_name']) && isset($variation['variation_value']) && 
                !empty(trim($variation['variation_name'])) && !empty(trim($variation['variation_value']))) {
                
                if (isset($variation['variation_id']) && !empty($variation['variation_id'])) {
                    // Update existing variation
                    $stmt = $pdo->prepare($updateVariationSql);
                    $stmt->execute([
                        'variation_id' => (int)$variation['variation_id'],
                        'product_id' => $productId,
                        'variation_name' => trim($variation['variation_name']),
                        'variation_value' => trim($variation['variation_value'])
                    ]);
                } else {
                    // Insert new variation
                    $stmt = $pdo->prepare($insertVariationSql);
                    $stmt->execute([
                        'product_id' => $productId,
                        'variation_name' => trim($variation['variation_name']),
                        'variation_value' => trim($variation['variation_value'])
                    ]);
                }
                $variationsUpdated++;
            }
        }
    }
    
    // Commit transaction
    $pdo->commit();
    
    // Create notification for product updated
    require_once __DIR__ . '/create_admin_activity_notification.php';
    $productName = $input['product_name'] ?? 'Product';
    createAdminActivityNotification($pdo, 'product_updated', [
        'product_name' => $productName,
        'message' => "Product updated: {$productName}"
    ]);
    
    // Clear any unexpected output before sending JSON
    ob_end_clean();
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Product updated successfully',
        'product_id' => $productId,
        'variations_updated' => $variationsUpdated
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
    
    error_log("Update Product API Error: " . $e->getMessage());
    error_log("Update Product API Error Trace: " . $e->getTraceAsString());
    error_log("Update Product API Input: " . json_encode($input));
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while updating the product: ' . $e->getMessage(),
        'error_details' => $e->getMessage()
    ]);
}
?>

