<?php
/**
 * Get Product Variations API
 * Returns all variations for a specific product
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require_once __DIR__ . '/../includes/db_functions.php';

// Get product ID from query parameter
$productId = isset($_GET['product_id']) ? (int)$_GET['product_id'] : null;

if (!$productId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Product ID is required'
    ]);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Get product details
    $stmt = $pdo->prepare("SELECT Product_ID, Product_Name FROM products WHERE Product_ID = :product_id LIMIT 1");
    $stmt->execute(['product_id' => $productId]);
    $product = $stmt->fetch();
    
    if (!$product) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Product not found'
        ]);
        exit;
    }
    
    // Get product variations (FETCH_ASSOC for consistent key names in JSON)
    $stmt = $pdo->prepare("SELECT * FROM product_variations WHERE Product_ID = :product_id ORDER BY variation_name ASC, Variation_ID ASC");
    $stmt->execute(['product_id' => $productId]);
    $variations = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Group variations by variation_name
    $groupedVariations = [];
    foreach ($variations as $variation) {
        $name = $variation['variation_name'];
        if (!isset($groupedVariations[$name])) {
            $groupedVariations[$name] = [];
        }
        $groupedVariations[$name][] = [
            'variation_id' => $variation['Variation_ID'],
            'variation_name' => $variation['variation_name'],
            'variation_value' => $variation['variation_value']
        ];
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'product' => [
            'product_id' => $product['Product_ID'],
            'product_name' => $product['Product_Name']
        ],
        'variations' => $variations,
        'grouped_variations' => $groupedVariations
    ]);
    
} catch (Exception $e) {
    error_log("Get Product Variations API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching variations'
    ]);
}

