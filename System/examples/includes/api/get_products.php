<?php
/**
 * Get Products API Endpoint
 * Returns all products from the database, optionally filtered by category
 */

// Start output buffering to prevent any output before headers
ob_start();

// Suppress error display for production
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/../includes/db_functions.php';

// Get optional category filter
$category = isset($_GET['category']) ? $_GET['category'] : null;

try {
    // Initialize database functions (may throw if config missing or connection fails)
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Check if categories table and category_id column exist
    $categoriesTableExists = $pdo->query("SHOW TABLES LIKE 'categories'")->rowCount() > 0;
    $categoryIdColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'category_id'")->rowCount() > 0;
    
    if ($categoriesTableExists && $categoryIdColumnExists) {
        // Use category_id foreign key join (preferred method) to get updated category names
        $sql = "SELECT p.*, 
                COALESCE(c.category_name, p.category, 'Uncategorized') as category_name
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.Category_ID
                WHERE p.stock_status IN ('In Stock', 'Low Stock')";
        $params = [];
        
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
    } elseif ($categoriesTableExists) {
        // Fallback: Join by category name if category_id doesn't exist yet
        $sql = "SELECT p.*, 
                COALESCE(c.category_name, p.category, 'Uncategorized') as category_name
                FROM products p 
                LEFT JOIN categories c ON TRIM(p.category) = TRIM(c.category_name)
                WHERE p.stock_status IN ('In Stock', 'Low Stock')";
        $params = [];
        
        if ($category) {
            $sql .= " AND (TRIM(c.category_name) = :category OR TRIM(p.category) = :category)";
            $params['category'] = trim($category);
        }
        
        $sql .= " ORDER BY p.Product_Name ASC";
    } else {
        // Fallback to old method if categories table doesn't exist
        $sql = "SELECT * FROM products WHERE stock_status IN ('In Stock', 'Low Stock')";
        $params = [];
        
        if ($category) {
            $sql .= " AND category = :category";
            $params['category'] = $category;
        }
        
        $sql .= " ORDER BY Product_Name ASC";
    }
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format products for response
    $formattedProducts = [];
    foreach ($products as $product) {
        // Skip out of stock products
        if ($product['stock_status'] === 'Out of Stock') {
            continue;
        }
        
        // Get product variations
        $variations = [];
        try {
            $variationsStmt = $pdo->prepare("
                SELECT variation_name, variation_value, variation_id 
                FROM product_variations 
                WHERE Product_ID = :product_id
                ORDER BY variation_name, variation_value
            ");
            $variationsStmt->execute(['product_id' => $product['Product_ID']]);
            $variationsData = $variationsStmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Group variations by name
            $groupedVariations = [];
            foreach ($variationsData as $variation) {
                $name = $variation['variation_name'];
                if (!isset($groupedVariations[$name])) {
                    $groupedVariations[$name] = [];
                }
                $groupedVariations[$name][] = [
                    'variation_id' => $variation['variation_id'],
                    'variation_value' => $variation['variation_value']
                ];
            }
            $variations = $groupedVariations;
        } catch (Exception $e) {
            // Variations table might not exist, continue without them
            error_log("Could not fetch variations for product {$product['Product_ID']}: " . $e->getMessage());
        }
        
        // Use category_name from join if available (updated category name), otherwise fall back to category field
        $categoryName = isset($product['category_name']) ? $product['category_name'] : $product['category'];
        
        $formattedProducts[] = [
            'product_id' => $product['Product_ID'],
            'product_name' => $product['Product_Name'],
            'category' => $product['category'], // Keep original for backward compatibility
            'category_name' => $categoryName, // Updated category name from database join
            'price' => number_format((float)$product['price'], 2, '.', ''),
            'stock_level' => $product['stock_level'],
            'stock_status' => $product['stock_status'],
            'length' => $product['length'],
            'width' => $product['Width'],
            'unit' => $product['Unit'],
            'description' => isset($product['description']) ? $product['description'] : null,
            'image_path' => isset($product['image_path']) ? str_replace(['Admin assets', 'Customer assets'], ['Admin_assets', 'Customer_assets'], $product['image_path']) : null,
            'variations' => $variations
        ];
    }
    
    ob_end_clean();
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'products' => $formattedProducts,
        'count' => count($formattedProducts)
    ]);
    exit;
    
} catch (Exception $e) {
    if (ob_get_level()) ob_end_clean();
    error_log("Get Products API Error: " . $e->getMessage());
    $isDbError = (strpos($e->getMessage(), 'connect') !== false || strpos($e->getMessage(), 'database') !== false || strpos($e->getMessage(), 'config') !== false);
    http_response_code($isDbError ? 503 : 500);
    echo json_encode([
        'success' => false,
        'message' => $isDbError
            ? 'Service temporarily unavailable. Please check server configuration (config/database.local.php).'
            : 'An error occurred while fetching products'
    ]);
    exit;
}

