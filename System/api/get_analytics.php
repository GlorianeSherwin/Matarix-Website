<?php
/**
 * Get Analytics Data API Endpoint
 * Returns sales analytics including revenue, orders, avg order value, and new customers
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
    
    // Calculate Total Revenue (from transactions with Paid status)
    // Use orders.amount if transaction total is not available
    $revenueStmt = $pdo->prepare("
        SELECT COALESCE(SUM(COALESCE(t.Total, o.amount)), 0) as total_revenue
        FROM orders o
        LEFT JOIN transactions t ON o.Order_ID = t.Order_ID
        WHERE (t.Payment_Status = 'Paid' OR (t.Payment_Status IS NULL AND o.payment = 'Paid'))
        AND DATE(o.order_date) BETWEEN :start_date AND :end_date
    ");
    $revenueStmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
    $currentRevenue = $revenueStmt->fetchColumn();
    
    // Previous period revenue
    $revenueStmt->execute(['start_date' => $prevStartDate, 'end_date' => $prevEndDate]);
    $previousRevenue = $revenueStmt->fetchColumn();
    $revenueChange = $previousRevenue > 0 ? (($currentRevenue - $previousRevenue) / $previousRevenue) * 100 : ($currentRevenue > 0 ? 100 : 0);
    
    // Calculate Total Orders
    $ordersStmt = $pdo->prepare("
        SELECT COUNT(*) as total_orders
        FROM orders
        WHERE DATE(order_date) BETWEEN :start_date AND :end_date
    ");
    $ordersStmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
    $currentOrders = $ordersStmt->fetchColumn();
    
    // Previous period orders
    $ordersStmt->execute(['start_date' => $prevStartDate, 'end_date' => $prevEndDate]);
    $previousOrders = $ordersStmt->fetchColumn();
    $ordersChange = $previousOrders > 0 ? (($currentOrders - $previousOrders) / $previousOrders) * 100 : 0;
    
    // Calculate Average Order Value
    $avgOrderStmt = $pdo->prepare("
        SELECT COALESCE(AVG(COALESCE(t.Total, o.amount)), 0) as avg_order_value
        FROM orders o
        LEFT JOIN transactions t ON o.Order_ID = t.Order_ID
        WHERE (t.Payment_Status = 'Paid' OR (t.Payment_Status IS NULL AND o.payment = 'Paid'))
        AND DATE(o.order_date) BETWEEN :start_date AND :end_date
    ");
    $avgOrderStmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
    $currentAvgOrder = $avgOrderStmt->fetchColumn();
    
    // Previous period avg order
    $avgOrderStmt->execute(['start_date' => $prevStartDate, 'end_date' => $prevEndDate]);
    $previousAvgOrder = $avgOrderStmt->fetchColumn();
    $avgOrderChange = $previousAvgOrder > 0 ? (($currentAvgOrder - $previousAvgOrder) / $previousAvgOrder) * 100 : ($currentAvgOrder > 0 ? 100 : 0);
    
    // Calculate New Customers (users created in the period)
    $newCustomersStmt = $pdo->prepare("
        SELECT COUNT(*) as new_customers
        FROM users
        WHERE role = 'Customer'
        AND DATE(created_at) BETWEEN :start_date AND :end_date
    ");
    $newCustomersStmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
    $currentNewCustomers = $newCustomersStmt->fetchColumn();
    
    // Previous period new customers
    $newCustomersStmt->execute(['start_date' => $prevStartDate, 'end_date' => $prevEndDate]);
    $previousNewCustomers = $newCustomersStmt->fetchColumn();
    $newCustomersChange = $previousNewCustomers > 0 ? (($currentNewCustomers - $previousNewCustomers) / $previousNewCustomers) * 100 : 0;
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'analytics' => [
            'total_revenue' => [
                'value' => (float)$currentRevenue,
                'formatted' => '₱' . number_format($currentRevenue, 2),
                'change' => round($revenueChange, 2),
                'change_formatted' => ($revenueChange >= 0 ? '+' : '') . number_format($revenueChange, 2) . '% from last period'
            ],
            'total_orders' => [
                'value' => (int)$currentOrders,
                'formatted' => number_format($currentOrders),
                'change' => round($ordersChange, 2),
                'change_formatted' => ($ordersChange >= 0 ? '+' : '') . number_format($ordersChange, 2) . '% from last period'
            ],
            'avg_order_value' => [
                'value' => (float)$currentAvgOrder,
                'formatted' => '₱' . number_format($currentAvgOrder, 2),
                'change' => round($avgOrderChange, 2),
                'change_formatted' => ($avgOrderChange >= 0 ? '+' : '') . number_format($avgOrderChange, 2) . '% from last period'
            ],
            'new_customers' => [
                'value' => (int)$currentNewCustomers,
                'formatted' => number_format($currentNewCustomers),
                'change' => round($newCustomersChange, 2),
                'change_formatted' => ($newCustomersChange >= 0 ? '+' : '') . number_format($newCustomersChange, 2) . '% from last period'
            ]
        ],
        'period' => [
            'start_date' => $startDate,
            'end_date' => $endDate,
            'days' => $days
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Get Analytics API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching analytics data.'
    ]);
}
?>

