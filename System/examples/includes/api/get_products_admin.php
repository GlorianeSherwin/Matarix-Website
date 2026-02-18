<?php
/**
 * Get Products API for Admin
 * Returns ALL products including out of stock items
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: product view in admin context (Store Employee + Admin)
rbac_require_permission_api('products.view');

// Get optional category filter
$category = isset($_GET['category']) ? $_GET['category'] : null;

// Initialize database functions
$db = new DatabaseFunctions();

try {
    $pdo = $db->getConnection();
    
    // Check if categories table exists
    $categoriesTableExists = $pdo->query("SHOW TABLES LIKE 'categories'")->rowCount() > 0;
    
    // Check if category_id column exists
    $categoryIdColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'category_id'")->rowCount() > 0;
    
    // Check if is_archived column exists
    $isArchivedColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'is_archived'")->rowCount() > 0;
    
    if ($categoriesTableExists && $categoryIdColumnExists) {
        // Use category_id foreign key join (preferred method)
        $sql = "SELECT p.*, 
                COALESCE(c.category_name, p.category, 'Uncategorized') as category_name,
                p.category_id
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.Category_ID";
        $params = [];
        
        // Exclude archived products if column exists
        if ($isArchivedColumnExists) {
            $sql .= " WHERE (p.is_archived IS NULL OR p.is_archived = 0)";
        } else {
            $sql .= " WHERE 1=1";
        }
        
        if ($category) {
            // Support filtering by category_id or category name
            if (is_numeric($category)) {
                $sql .= " AND p.category_id = :category";
                $params['category'] = (int)$category;
            } else {
                $sql .= " AND (c.category_name = :category OR p.category = :category)";
                $params['category'] = trim($category);
            }
        }
        
        $sql .= " ORDER BY p.Product_Name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } elseif ($categoriesTableExists) {
        // Fallback: Join by category name if category_id doesn't exist yet
        $sql = "SELECT p.*, 
                COALESCE(c.category_name, p.category, 'Uncategorized') as category_name 
                FROM products p 
                LEFT JOIN categories c ON TRIM(p.category) = TRIM(c.category_name)";
        $params = [];
        
        // Exclude archived products if column exists
        if ($isArchivedColumnExists) {
            $sql .= " WHERE (p.is_archived IS NULL OR p.is_archived = 0)";
        } else {
            $sql .= " WHERE 1=1";
        }
        
        if ($category) {
            $sql .= " AND (TRIM(c.category_name) = :category OR TRIM(p.category) = :category)";
            $params['category'] = trim($category);
        }
        
        $sql .= " ORDER BY p.Product_Name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } else {
        // Fallback to old method if categories table doesn't exist
        $sql = "SELECT * FROM products";
        $params = [];
        
        // Exclude archived products if column exists
        if ($isArchivedColumnExists) {
            $sql .= " WHERE (is_archived IS NULL OR is_archived = 0)";
        } else {
            $sql .= " WHERE 1=1";
        }
        
        if ($category) {
            $sql .= " AND category = :category";
            $params['category'] = $category;
        }
        
        $sql .= " ORDER BY Product_Name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // When product has variations with stock_level, show combined variation stock on inventory list
    $variationStockMap = [];
    $hasStockLevelCol = $pdo->query("SHOW COLUMNS FROM product_variations LIKE 'stock_level'")->rowCount() > 0;
    if ($hasStockLevelCol) {
        $sumStmt = $pdo->query("SELECT Product_ID, COALESCE(SUM(stock_level), 0) as total FROM product_variations WHERE stock_level IS NOT NULL AND stock_level != '' GROUP BY Product_ID");
        if ($sumStmt) {
            while ($row = $sumStmt->fetch(PDO::FETCH_ASSOC)) {
                $variationStockMap[(int)$row['Product_ID']] = (int)$row['total'];
            }
        }
    }
    
    // Format products for response
    $formattedProducts = [];
    foreach ($products as $product) {
        // Use category_name from join if available, otherwise use category column, otherwise 'Uncategorized'
        $categoryName = isset($product['category_name']) && !empty($product['category_name']) 
            ? $product['category_name'] 
            : (isset($product['category']) && !empty($product['category']) 
                ? $product['category'] 
                : 'Uncategorized');
        
        // Get category_id if available
        $categoryId = isset($product['category_id']) ? $product['category_id'] : null;
        
        $productId = (int)$product['Product_ID'];
        $minimumStock = (int)($product['Minimum_Stock'] ?? 0);
        $stockLevel = (int)$product['stock_level'];
        $stockStatus = $product['stock_status'];
        $hasVariationStock = isset($variationStockMap[$productId]);
        if ($hasVariationStock) {
            $stockLevel = $variationStockMap[$productId];
            $stockStatus = $stockLevel <= 0 ? 'Out of Stock' : ($stockLevel <= $minimumStock ? 'Low Stock' : 'In Stock');
        }
        
        $formattedProducts[] = [
            'Product_ID' => $productId,
            'Product_Name' => $product['Product_Name'],
            'category' => $categoryName,
            'category_name' => $categoryName, // Alias for consistency
            'category_id' => $categoryId, // Include category_id for filtering
            'Category_ID' => $categoryId, // Also include with capital for compatibility
            'price' => number_format((float)$product['price'], 2, '.', ''),
            'stock_level' => $stockLevel,
            'stock_unit' => isset($product['stock_unit']) ? $product['stock_unit'] : 'PC',
            'Minimum_Stock' => $minimumStock,
            'stock_status' => $stockStatus,
            'has_variation_stock' => $hasVariationStock,
            'length' => $product['length'],
            'Width' => $product['Width'],
            'Unit' => $product['Unit'],
            'last_restock' => $product['last_restock'],
            'description' => isset($product['description']) ? $product['description'] : null,
            'image_path' => isset($product['image_path']) ? str_replace(['Admin assets', 'Customer assets'], ['Admin_assets', 'Customer_assets'], $product['image_path']) : null
        ];
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'products' => $formattedProducts,
        'count' => count($formattedProducts)
    ]);
    
} catch (Exception $e) {
    error_log("Get Products Admin API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching products'
    ]);
}
?>

