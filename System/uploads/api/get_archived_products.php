<?php
/**
 * Get Archived Products API
 * Returns all archived products
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// Check if user is logged in and has permission (Admin)
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'User not authenticated'
    ]);
    exit;
}

$userRole = $_SESSION['user_role'] ?? '';
if ($userRole !== 'Admin') {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Access denied. Only admins can view archived products.'
    ]);
    exit;
}

// Get optional category filter
$category = isset($_GET['category']) ? $_GET['category'] : null;

// Initialize database functions
$db = new DatabaseFunctions();

try {
    $pdo = $db->getConnection();
    
    // Check if archive columns exist
    $stmt = $pdo->query("SHOW COLUMNS FROM `products` LIKE 'is_archived'");
    $archiveColumnsExist = $stmt->rowCount() > 0;
    
    if (!$archiveColumnsExist) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'products' => [],
            'count' => 0,
            'message' => 'Archive system not set up yet. Please run create_product_archive_system.php first.'
        ]);
        exit;
    }
    
    // Check if categories table exists
    $categoriesTableExists = $pdo->query("SHOW TABLES LIKE 'categories'")->rowCount() > 0;
    
    // Check if category_id column exists
    $categoryIdColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'category_id'")->rowCount() > 0;
    
    if ($categoriesTableExists && $categoryIdColumnExists) {
        // Use category_id foreign key join (preferred method)
        $sql = "SELECT p.*, 
                COALESCE(c.category_name, p.category, 'Uncategorized') as category_name,
                p.category_id,
                u.email as archived_by_email,
                u.first_name as archived_by_name
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.Category_ID
                LEFT JOIN users u ON p.archived_by = u.User_ID
                WHERE p.is_archived = 1";
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
        
        $sql .= " ORDER BY p.archived_at DESC, p.Product_Name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } elseif ($categoriesTableExists) {
        // Fallback: Join by category name if category_id doesn't exist yet
        $sql = "SELECT p.*, 
                COALESCE(c.category_name, p.category, 'Uncategorized') as category_name,
                u.email as archived_by_email,
                u.first_name as archived_by_name
                FROM products p 
                LEFT JOIN categories c ON TRIM(p.category) = TRIM(c.category_name)
                LEFT JOIN users u ON p.archived_by = u.User_ID
                WHERE p.is_archived = 1";
        $params = [];
        
        if ($category) {
            $sql .= " AND (TRIM(c.category_name) = :category OR TRIM(p.category) = :category)";
            $params['category'] = trim($category);
        }
        
        $sql .= " ORDER BY p.archived_at DESC, p.Product_Name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } else {
        // Fallback to old method if categories table doesn't exist
        $sql = "SELECT p.*,
                u.email as archived_by_email,
                u.first_name as archived_by_name
                FROM products p
                LEFT JOIN users u ON p.archived_by = u.User_ID
                WHERE p.is_archived = 1";
        $params = [];
        
        if ($category) {
            $sql .= " AND p.category = :category";
            $params['category'] = $category;
        }
        
        $sql .= " ORDER BY p.archived_at DESC, p.Product_Name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
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
        
        $formattedProducts[] = [
            'Product_ID' => $product['Product_ID'],
            'Product_Name' => $product['Product_Name'],
            'category' => $categoryName,
            'price' => number_format((float)$product['price'], 2, '.', ''),
            'stock_level' => $product['stock_level'],
            'Minimum_Stock' => $product['Minimum_Stock'],
            'stock_status' => $product['stock_status'],
            'length' => $product['length'],
            'Width' => $product['Width'],
            'Unit' => $product['Unit'],
            'last_restock' => $product['last_restock'],
            'description' => isset($product['description']) ? $product['description'] : null,
            'image_path' => isset($product['image_path']) ? str_replace(['Admin assets', 'Customer assets'], ['Admin_assets', 'Customer_assets'], $product['image_path']) : null,
            'archived_at' => $product['archived_at'] ?? null,
            'archived_by' => $product['archived_by'] ?? null,
            'archived_by_email' => $product['archived_by_email'] ?? null,
            'archived_by_name' => $product['archived_by_name'] ?? null
        ];
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'products' => $formattedProducts,
        'count' => count($formattedProducts)
    ]);
    
} catch (Exception $e) {
    error_log("Get Archived Products API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching archived products'
    ]);
}
?>

