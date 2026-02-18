<?php
/**
 * Get Product Details for Customer API Endpoint
 * Returns product information for customer-facing pages
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('customer'); // Customer API, use customer session
}

// Initialize database functions
try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    if (!$pdo) {
        throw new Exception("Database connection failed");
    }
} catch (Exception $e) {
    error_log("Get Product Customer API - Database connection error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed',
        'error' => $e->getMessage()
    ]);
    exit;
}

try {
    $productId = isset($_GET['product_id']) ? (int)$_GET['product_id'] : 0;
    
    if ($productId <= 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid product ID',
            'received' => $_GET['product_id'] ?? 'not set'
        ]);
        exit;
    }
    
    // Log the request for debugging
    error_log("Get Product Customer API - Requested Product ID: " . $productId);
    
    // Test database connection by checking if products table exists
    try {
        $tableCheck = $pdo->query("SHOW TABLES LIKE 'products'");
        if ($tableCheck->rowCount() === 0) {
            throw new Exception("Products table does not exist");
        }
    } catch (Exception $e) {
        error_log("Get Product Customer API - Table check error: " . $e->getMessage());
        throw $e;
    }
    
    // Check if weight columns exist
    $weightColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'weight'")->rowCount() > 0;
    $weightUnitColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'weight_unit'")->rowCount() > 0;
    $imagePathColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'image_path'")->rowCount() > 0;
    $thumbnailsColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'thumbnails'")->rowCount() > 0;
    
    // Build SELECT query dynamically based on column existence
    $selectFields = "
        Product_ID, 
        Product_Name, 
        category, 
        stock_level, 
        stock_status, 
        price,
        description,
        length,
        Width,
        Unit
    ";
    
    if ($weightColumnExists) {
        $selectFields .= ", weight";
    }
    if ($weightUnitColumnExists) {
        $selectFields .= ", weight_unit";
    }
    if ($imagePathColumnExists) {
        $selectFields .= ", image_path";
    }
    if ($thumbnailsColumnExists) {
        $selectFields .= ", thumbnails";
    }
    
    // Get product basic info
    $productStmt = $pdo->prepare("
        SELECT 
            $selectFields
        FROM products
        WHERE Product_ID = :product_id
    ");
    $productStmt->execute(['product_id' => $productId]);
    $product = $productStmt->fetch(PDO::FETCH_ASSOC);
    
    error_log("Get Product Customer API - Product found: " . ($product ? 'Yes' : 'No'));
    
    if (!$product) {
        error_log("Get Product Customer API - Product ID $productId not found in database");
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Product not found',
            'product_id' => $productId
        ]);
        exit;
    }
    
    error_log("Get Product Customer API - Product found: " . $product['Product_Name'] . ", Stock Status: " . $product['stock_status']);
    
    // Note: We'll show products even if out of stock, but mark them clearly
    // Remove the redirect for out of stock products - let the frontend handle it
    
    // Get product variations
    $variationsStmt = $pdo->prepare("
        SELECT 
            Variation_ID,
            variation_name,
            variation_value
        FROM product_variations
        WHERE Product_ID = :product_id
        ORDER BY variation_name ASC, Variation_ID ASC
    ");
    $variationsStmt->execute(['product_id' => $productId]);
    $variations = $variationsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Group variations by variation_name
    $groupedVariations = [];
    foreach ($variations as $variation) {
        $name = $variation['variation_name'];
        if (!isset($groupedVariations[$name])) {
            $groupedVariations[$name] = [];
        }
        $groupedVariations[$name][] = [
            'variation_id' => (int)$variation['Variation_ID'],
            'variation_value' => $variation['variation_value']
        ];
    }
    
    // Get product reviews count, average rating, and actual reviews
    // Check if product_reviews table exists first
    $reviewsCount = 0;
    $avgRating = 0;
    $reviews = [];
    
    try {
        $tableCheck = $pdo->query("SHOW TABLES LIKE 'product_reviews'");
        if ($tableCheck->rowCount() > 0) {
            // Get review count and average rating
            $reviewsStmt = $pdo->prepare("
                SELECT 
                    COUNT(*) as review_count,
                    AVG(Rating) as avg_rating
                FROM product_reviews
                WHERE Product_ID = :product_id
            ");
            $reviewsStmt->execute(['product_id' => $productId]);
            $reviewsData = $reviewsStmt->fetch(PDO::FETCH_ASSOC);
            $reviewsCount = (int)($reviewsData['review_count'] ?? 0);
            $avgRating = $reviewsData['avg_rating'] ? round((float)$reviewsData['avg_rating'], 1) : 0;
            
            // Get actual reviews with user information
            if ($reviewsCount > 0) {
                $reviewsListStmt = $pdo->prepare("
                    SELECT 
                        pr.Review_ID,
                        pr.Order_ID,
                        pr.User_ID,
                        pr.Rating,
                        pr.Review_Text,
                        pr.Created_At,
                        u.First_Name,
                        u.Middle_Name,
                        u.Last_Name,
                        u.email
                    FROM product_reviews pr
                    LEFT JOIN users u ON pr.User_ID = u.User_ID
                    WHERE pr.Product_ID = :product_id
                    ORDER BY pr.Created_At DESC
                    LIMIT 50
                ");
                $reviewsListStmt->execute(['product_id' => $productId]);
                $reviewsData = $reviewsListStmt->fetchAll(PDO::FETCH_ASSOC);
                
                foreach ($reviewsData as $review) {
                    $reviews[] = [
                        'review_id' => (int)$review['Review_ID'],
                        'order_id' => (int)$review['Order_ID'],
                        'user_id' => (int)$review['User_ID'],
                        'rating' => (int)$review['Rating'],
                        'review_text' => $review['Review_Text'] ?? '',
                        'created_at' => $review['Created_At'],
                        'user_name' => trim(($review['First_Name'] ?? '') . ' ' . ($review['Middle_Name'] ?? '') . ' ' . ($review['Last_Name'] ?? '')),
                        'user_email' => $review['email'] ?? ''
                    ];
                }
            }
        }
    } catch (Exception $e) {
        // Table doesn't exist or error - use defaults
        error_log("Product reviews table check error: " . $e->getMessage());
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'product' => [
            'product_id' => (int)$product['Product_ID'],
            'product_name' => $product['Product_Name'],
            'category' => $product['category'],
            'stock_level' => (int)$product['stock_level'],
            'stock_status' => $product['stock_status'],
            'price' => (float)$product['price'],
            'description' => $product['description'] ?? '',
            'length' => $product['length'] ?? null,
            'width' => $product['Width'] ?? null,
            'unit' => $product['Unit'] ?? '',
            'weight' => ($weightColumnExists && isset($product['weight'])) ? (float)$product['weight'] : null,
            'weight_unit' => ($weightUnitColumnExists && isset($product['weight_unit'])) ? $product['weight_unit'] : null,
            'image_path' => ($imagePathColumnExists && isset($product['image_path']) && !empty($product['image_path'])) ? $product['image_path'] : null,
            'thumbnails' => ($thumbnailsColumnExists && isset($product['thumbnails']) && !empty($product['thumbnails'])) ? json_decode($product['thumbnails'], true) : [],
            'variations' => $groupedVariations,
            'review_count' => $reviewsCount,
            'avg_rating' => $avgRating,
            'reviews' => $reviews
        ]
    ]);
    
} catch (PDOException $e) {
    error_log("Get Product Customer API PDO Error: " . $e->getMessage());
    error_log("SQL Error Code: " . $e->getCode());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error occurred while fetching product details.',
        'error' => $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Get Product Customer API Error: " . $e->getMessage());
    error_log("Error Trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching product details.',
        'error' => $e->getMessage()
    ]);
}
?>

