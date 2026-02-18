<?php
/**
 * Get Top Performing Products API Endpoint
 * Returns top selling products with revenue, units sold, and growth
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
    // Get date range filter (default: last 30 days)
    $days = isset($_GET['days']) ? (int)$_GET['days'] : 30;
    $startDate = date('Y-m-d', strtotime("-{$days} days"));
    $endDate = date('Y-m-d');
    
    // Get previous period for comparison
    $prevStartDate = date('Y-m-d', strtotime("-" . ($days * 2) . " days"));
    $prevEndDate = date('Y-m-d', strtotime("-{$days} days"));
    
    // Get top products for current period
    $productsStmt = $pdo->prepare("
        SELECT 
            p.Product_ID,
            p.Product_Name,
            COALESCE(SUM(ti.Quantity * ti.Price), 0) as revenue,
            COALESCE(SUM(ti.Quantity), 0) as units_sold
        FROM products p
        INNER JOIN transaction_items ti ON p.Product_ID = ti.Product_ID
        INNER JOIN orders o ON ti.Order_ID = o.Order_ID
        INNER JOIN transactions tr ON o.Order_ID = tr.Order_ID
        WHERE DATE(o.order_date) BETWEEN :start_date AND :end_date
        AND tr.Payment_Status = 'Paid'
        GROUP BY p.Product_ID, p.Product_Name
        HAVING revenue > 0
        ORDER BY revenue DESC
        LIMIT 10
    ");
    $productsStmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
    $currentProducts = $productsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get previous period data for growth calculation
    $prevProductsStmt = $pdo->prepare("
        SELECT 
            p.Product_ID,
            COALESCE(SUM(ti.Quantity * ti.Price), 0) as revenue
        FROM products p
        INNER JOIN transaction_items ti ON p.Product_ID = ti.Product_ID
        INNER JOIN orders o ON ti.Order_ID = o.Order_ID
        INNER JOIN transactions tr ON o.Order_ID = tr.Order_ID
        WHERE DATE(o.order_date) BETWEEN :start_date AND :end_date
        AND tr.Payment_Status = 'Paid'
        GROUP BY p.Product_ID
    ");
    $prevProductsStmt->execute(['start_date' => $prevStartDate, 'end_date' => $prevEndDate]);
    $prevProducts = [];
    foreach ($prevProductsStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $prevProducts[$row['Product_ID']] = $row['revenue'];
    }
    
    // Format products with growth calculation
    $formattedProducts = [];
    foreach ($currentProducts as $product) {
        $productId = $product['Product_ID'];
        $currentRevenue = (float)$product['revenue'];
        $previousRevenue = isset($prevProducts[$productId]) ? (float)$prevProducts[$productId] : 0;
        
        $growth = 0;
        if ($previousRevenue > 0) {
            $growth = (($currentRevenue - $previousRevenue) / $previousRevenue) * 100;
        } elseif ($currentRevenue > 0) {
            $growth = 100; // New product
        }
        
        $formattedProducts[] = [
            'product_id' => $productId,
            'product_name' => $product['Product_Name'],
            'revenue' => [
                'value' => $currentRevenue,
                'formatted' => '₱' . number_format($currentRevenue, 2)
            ],
            'units_sold' => [
                'value' => (int)$product['units_sold'],
                'formatted' => number_format($product['units_sold'])
            ],
            'growth' => [
                'value' => round($growth, 2),
                'formatted' => ($growth >= 0 ? '+' : '') . number_format($growth, 2) . '%'
            ]
        ];
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'products' => $formattedProducts,
        'period' => [
            'start_date' => $startDate,
            'end_date' => $endDate,
            'days' => $days
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Get Top Products API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching top products.'
    ]);
}
?>

