<?php
/**
 * Get Product Details API Endpoint
 * Returns detailed analytics for a specific product
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: reports/analytics
rbac_require_permission_api('reports.view');

// Initialize database functions
$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    $productId = isset($_GET['product_id']) ? (int)$_GET['product_id'] : 0;
    $days = isset($_GET['days']) ? (int)$_GET['days'] : 30;
    
    if ($productId <= 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid product ID'
        ]);
        exit;
    }
    
    $startDate = date('Y-m-d', strtotime("-{$days} days"));
    $endDate = date('Y-m-d');
    
    // Get previous period for comparison
    $prevStartDate = date('Y-m-d', strtotime("-" . ($days * 2) . " days"));
    $prevEndDate = date('Y-m-d', strtotime("-{$days} days"));
    
    // Check if categories table and category_id column exist
    $categoriesTableExists = $pdo->query("SHOW TABLES LIKE 'categories'")->rowCount() > 0;
    $categoryIdColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'category_id'")->rowCount() > 0;
    $thumbnailsColumnExists = $pdo->query("SHOW COLUMNS FROM products LIKE 'thumbnails'")->rowCount() > 0;
    
    // Build SELECT fields dynamically
    $selectFields = "p.*, COALESCE(c.category_name, p.category, 'Uncategorized') as category";
    if ($categoryIdColumnExists) {
        $selectFields .= ", p.category_id";
    }
    $selectFields .= ", p.description, p.image_path";
    if ($thumbnailsColumnExists) {
        $selectFields .= ", p.thumbnails";
    }
    
    // Get product basic info
    if ($categoriesTableExists && $categoryIdColumnExists) {
        // Use category_id foreign key join (preferred method)
        $productStmt = $pdo->prepare("
            SELECT $selectFields
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.Category_ID
            WHERE p.Product_ID = :product_id
        ");
    } elseif ($categoriesTableExists) {
        // Fallback: Join by category name
        $productStmt = $pdo->prepare("
            SELECT $selectFields
            FROM products p
            LEFT JOIN categories c ON TRIM(p.category) = TRIM(c.category_name)
            WHERE p.Product_ID = :product_id
        ");
    } else {
        $selectFields = "*";
        if ($thumbnailsColumnExists) {
            $selectFields = "*, thumbnails";
        }
        $productStmt = $pdo->prepare("
            SELECT $selectFields, COALESCE(category, 'Uncategorized') as category
            FROM products
            WHERE Product_ID = :product_id
        ");
    }
    $productStmt->execute(['product_id' => $productId]);
    $product = $productStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$product) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Product not found'
        ]);
        exit;
    }
    
    // Get current period sales
    $salesStmt = $pdo->prepare("
        SELECT 
            COUNT(DISTINCT ti.Order_ID) as total_orders,
            SUM(ti.Quantity) as units_sold,
            SUM(ti.Quantity * ti.Price) as total_revenue,
            AVG(ti.Price) as avg_price,
            SUM(ti.Quantity * ti.Price) / COUNT(DISTINCT ti.Order_ID) as avg_order_value
        FROM transaction_items ti
        INNER JOIN orders o ON ti.Order_ID = o.Order_ID
        INNER JOIN transactions t ON o.Order_ID = t.Order_ID
        WHERE ti.Product_ID = :product_id
        AND DATE(o.order_date) BETWEEN :start_date AND :end_date
        AND t.Payment_Status = 'Paid'
    ");
    $salesStmt->execute([
        'product_id' => $productId,
        'start_date' => $startDate,
        'end_date' => $endDate
    ]);
    $currentSales = $salesStmt->fetch(PDO::FETCH_ASSOC);
    
    // Get previous period sales
    $salesStmt->execute([
        'product_id' => $productId,
        'start_date' => $prevStartDate,
        'end_date' => $prevEndDate
    ]);
    $previousSales = $salesStmt->fetch(PDO::FETCH_ASSOC);
    
    // Calculate growth
    $revenueGrowth = 0;
    $unitsGrowth = 0;
    $ordersGrowth = 0;
    
    if ($previousSales['total_revenue'] > 0) {
        $revenueGrowth = (($currentSales['total_revenue'] - $previousSales['total_revenue']) / $previousSales['total_revenue']) * 100;
    } elseif ($currentSales['total_revenue'] > 0) {
        $revenueGrowth = 100;
    }
    
    if ($previousSales['units_sold'] > 0) {
        $unitsGrowth = (($currentSales['units_sold'] - $previousSales['units_sold']) / $previousSales['units_sold']) * 100;
    } elseif ($currentSales['units_sold'] > 0) {
        $unitsGrowth = 100;
    }
    
    if ($previousSales['total_orders'] > 0) {
        $ordersGrowth = (($currentSales['total_orders'] - $previousSales['total_orders']) / $previousSales['total_orders']) * 100;
    } elseif ($currentSales['total_orders'] > 0) {
        $ordersGrowth = 100;
    }
    
    // Get recent orders
    $ordersStmt = $pdo->prepare("
        SELECT 
            o.Order_ID,
            o.order_date,
            ti.Quantity,
            ti.Price,
            (ti.Quantity * ti.Price) as total,
            CONCAT(u.First_Name, ' ', u.Last_Name) as customer_name,
            t.Payment_Status
        FROM transaction_items ti
        INNER JOIN orders o ON ti.Order_ID = o.Order_ID
        INNER JOIN transactions t ON o.Order_ID = t.Order_ID
        LEFT JOIN users u ON o.User_ID = u.User_ID
        WHERE ti.Product_ID = :product_id
        AND DATE(o.order_date) BETWEEN :start_date AND :end_date
        AND t.Payment_Status = 'Paid'
        ORDER BY o.order_date DESC
        LIMIT 10
    ");
    $ordersStmt->execute([
        'product_id' => $productId,
        'start_date' => $startDate,
        'end_date' => $endDate
    ]);
    $recentOrders = $ordersStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get monthly sales breakdown
    $monthlyStmt = $pdo->prepare("
        SELECT 
            DATE_FORMAT(o.order_date, '%Y-%m') as month,
            DATE_FORMAT(o.order_date, '%b %Y') as month_formatted,
            SUM(ti.Quantity) as units_sold,
            SUM(ti.Quantity * ti.Price) as revenue
        FROM transaction_items ti
        INNER JOIN orders o ON ti.Order_ID = o.Order_ID
        INNER JOIN transactions t ON o.Order_ID = t.Order_ID
        WHERE ti.Product_ID = :product_id
        AND DATE(o.order_date) BETWEEN :start_date AND :end_date
        AND t.Payment_Status = 'Paid'
        GROUP BY DATE_FORMAT(o.order_date, '%Y-%m')
        ORDER BY month DESC
    ");
    $monthlyStmt->execute([
        'product_id' => $productId,
        'start_date' => $startDate,
        'end_date' => $endDate
    ]);
    $monthlyData = $monthlyStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get product variations if needed for view modal
    $variations = [];
    try {
        $variationsStmt = $pdo->prepare("
            SELECT variation_name, variation_value 
            FROM product_variations 
            WHERE Product_ID = :product_id
        ");
        $variationsStmt->execute(['product_id' => $productId]);
        $variationsData = $variationsStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Group variations by name
        $groupedVariations = [];
        foreach ($variationsData as $variation) {
            $name = $variation['variation_name'];
            if (!isset($groupedVariations[$name])) {
                $groupedVariations[$name] = [];
            }
            $groupedVariations[$name][] = [
                'variation_value' => $variation['variation_value']
            ];
        }
        $variations = $groupedVariations;
    } catch (Exception $e) {
        // Variations table might not exist, continue without them
        error_log("Could not fetch variations: " . $e->getMessage());
    }
    
    // Determine category name - use the one from the query result
    $categoryName = isset($product['category']) && !empty($product['category']) 
        ? $product['category'] 
        : 'Uncategorized';
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'product' => [
            'product_id' => $product['Product_ID'],
            'product_name' => $product['Product_Name'],
            'category' => $categoryName,
            'stock_level' => (int)$product['stock_level'],
            'stock_unit' => isset($product['stock_unit']) ? $product['stock_unit'] : 'PC',
            'stock_status' => $product['stock_status'],
            'price' => (float)$product['price'],
            'description' => isset($product['description']) ? $product['description'] : null,
            'image_path' => isset($product['image_path']) ? str_replace(['Admin assets', 'Customer assets'], ['Admin_assets', 'Customer_assets'], $product['image_path']) : null,
            'thumbnails' => ($thumbnailsColumnExists && isset($product['thumbnails']) && !empty($product['thumbnails'])) ? json_decode($product['thumbnails'], true) : [],
            'length' => isset($product['length']) ? $product['length'] : null,
            'width' => isset($product['Width']) ? $product['Width'] : null,
            'unit' => isset($product['Unit']) ? $product['Unit'] : null,
            'weight' => isset($product['weight']) ? (float)$product['weight'] : null,
            'weight_unit' => isset($product['weight_unit']) ? $product['weight_unit'] : null,
            'minimum_stock' => isset($product['Minimum_Stock']) ? (int)$product['Minimum_Stock'] : 0,
            'last_restock' => isset($product['last_restock']) ? $product['last_restock'] : null,
            'variations' => $variations
        ],
        'analytics' => [
            'current_period' => [
                'total_orders' => (int)$currentSales['total_orders'],
                'units_sold' => (int)$currentSales['units_sold'],
                'total_revenue' => (float)$currentSales['total_revenue'],
                'avg_price' => (float)$currentSales['avg_price'],
                'avg_order_value' => (float)$currentSales['avg_order_value']
            ],
            'previous_period' => [
                'total_orders' => (int)$previousSales['total_orders'],
                'units_sold' => (int)$previousSales['units_sold'],
                'total_revenue' => (float)$previousSales['total_revenue']
            ],
            'growth' => [
                'revenue' => round($revenueGrowth, 2),
                'units' => round($unitsGrowth, 2),
                'orders' => round($ordersGrowth, 2)
            ]
        ],
        'recent_orders' => $recentOrders,
        'monthly_breakdown' => $monthlyData,
        'period' => [
            'start_date' => $startDate,
            'end_date' => $endDate,
            'days' => $days
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Get Product Details API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching product details.'
    ]);
}
?>
