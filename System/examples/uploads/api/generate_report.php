<?php
/**
 * Generate Custom Report API Endpoint
 * Generates a custom report based on date range and filters
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET');
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
    // Get parameters
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_GET;
    }
    
    $startDate = $input['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
    $endDate = $input['end_date'] ?? date('Y-m-d');
    $reportType = $input['report_type'] ?? 'sales';
    
    // Validate dates
    if (!strtotime($startDate) || !strtotime($endDate)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid date format'
        ]);
        exit;
    }
    
    $reportData = [
        'report_type' => $reportType,
        'period' => [
            'start_date' => $startDate,
            'end_date' => $endDate
        ],
        'generated_at' => date('Y-m-d H:i:s'),
        'generated_by' => $_SESSION['user_name'] ?? 'Admin'
    ];
    
    // Get sales summary
    $salesStmt = $pdo->prepare("
        SELECT 
            COUNT(DISTINCT o.Order_ID) as total_orders,
            COUNT(DISTINCT o.User_ID) as total_customers,
            COALESCE(SUM(t.Total), 0) as total_revenue,
            COALESCE(AVG(t.Total), 0) as avg_order_value,
            SUM(CASE WHEN t.Payment_Status = 'Paid' THEN 1 ELSE 0 END) as paid_orders,
            SUM(CASE WHEN t.Payment_Status = 'Pending' THEN 1 ELSE 0 END) as pending_orders
        FROM orders o
        LEFT JOIN transactions t ON o.Order_ID = t.Order_ID
        WHERE DATE(o.order_date) BETWEEN :start_date AND :end_date
    ");
    $salesStmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
    $salesData = $salesStmt->fetch(PDO::FETCH_ASSOC);
    
    $reportData['sales_summary'] = [
        'total_orders' => (int)$salesData['total_orders'],
        'total_customers' => (int)$salesData['total_customers'],
        'total_revenue' => (float)$salesData['total_revenue'],
        'avg_order_value' => (float)$salesData['avg_order_value'],
        'paid_orders' => (int)$salesData['paid_orders'],
        'pending_orders' => (int)$salesData['pending_orders']
    ];
    
    // Get top products
    $productsStmt = $pdo->prepare("
        SELECT 
            p.Product_Name,
            SUM(ti.Quantity) as units_sold,
            SUM(ti.Quantity * ti.Price) as revenue
        FROM products p
        INNER JOIN transaction_items ti ON p.Product_ID = ti.Product_ID
        INNER JOIN orders o ON ti.Order_ID = o.Order_ID
        INNER JOIN transactions t ON o.Order_ID = t.Order_ID
        WHERE DATE(o.order_date) BETWEEN :start_date AND :end_date
        AND t.Payment_Status = 'Paid'
        GROUP BY p.Product_ID, p.Product_Name
        ORDER BY revenue DESC
        LIMIT 10
    ");
    $productsStmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
    $reportData['top_products'] = $productsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get order breakdown by status
    $statusStmt = $pdo->prepare("
        SELECT 
            status,
            COUNT(*) as count,
            SUM(amount) as total_amount
        FROM orders
        WHERE DATE(order_date) BETWEEN :start_date AND :end_date
        GROUP BY status
    ");
    $statusStmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
    $reportData['order_status_breakdown'] = $statusStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get detailed sales transactions grouped by month
    $detailedStmt = $pdo->prepare("
        SELECT 
            o.Order_ID,
            DATE_FORMAT(o.order_date, '%m/%Y') as month,
            DATE_FORMAT(o.order_date, '%m/%d/%Y') as order_date_formatted,
            o.order_date,
            COALESCE(t.Subtotal, o.amount) as cost,
            CONCAT('INV', o.Order_ID) as invoice_number,
            COALESCE(CONCAT(emp.First_Name, ' ', emp.Last_Name), 'N/A') as sales_rep,
            COALESCE(t.Total, o.amount) as total,
            CASE WHEN t.Payment_Status = 'Paid' THEN COALESCE(t.Total, o.amount) ELSE 0 END as paid,
            CASE WHEN t.Payment_Status = 'Pending' OR t.Payment_Status IS NULL THEN COALESCE(t.Total, o.amount) ELSE 0 END as balance_due
        FROM orders o
        LEFT JOIN transactions t ON o.Order_ID = t.Order_ID
        LEFT JOIN users emp ON o.Employee_ID = emp.User_ID
        WHERE DATE(o.order_date) BETWEEN :start_date AND :end_date
        ORDER BY o.order_date ASC, o.Order_ID ASC
    ");
    $detailedStmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
    $reportData['detailed_sales'] = $detailedStmt->fetchAll(PDO::FETCH_ASSOC);
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Report generated successfully',
        'report' => $reportData
    ]);
    
} catch (Exception $e) {
    error_log("Generate Report API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while generating the report.'
    ]);
}
?>

