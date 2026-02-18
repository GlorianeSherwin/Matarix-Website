<?php
/**
 * Export Report API Endpoint
 * Exports report data as CSV or returns JSON for PDF generation
 */

// Suppress any warnings/notices that might output HTML before CSV
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

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
    
    $format = $input['format'] ?? 'csv'; // csv or json
    $startDate = $input['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
    $endDate = $input['end_date'] ?? date('Y-m-d');
    
    // Get report data
    $salesStmt = $pdo->prepare("
        SELECT 
            o.Order_ID,
            o.order_date,
            o.status,
            o.payment,
            o.amount,
            t.Total as transaction_total,
            t.Payment_Status,
            u.email as customer_email,
            CONCAT(u.First_Name, ' ', u.Last_Name) as customer_name
        FROM orders o
        LEFT JOIN transactions t ON o.Order_ID = t.Order_ID
        LEFT JOIN users u ON o.User_ID = u.User_ID
        WHERE DATE(o.order_date) BETWEEN :start_date AND :end_date
        ORDER BY o.order_date DESC
    ");
    $salesStmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
    $orders = $salesStmt->fetchAll(PDO::FETCH_ASSOC);
    
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
    ");
    $productsStmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
    $products = $productsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    if ($format === 'csv' || $format === 'excel') {
        // Export as CSV/Excel
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="sales_report_' . date('Y-m-d') . '.csv"');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        // Add BOM for UTF-8 Excel compatibility
        echo "\xEF\xBB\xBF";
        
        $output = fopen('php://output', 'w');
        
        // Write header
        fputcsv($output, ['MATARIX - Sales Report']);
        fputcsv($output, ['Period: ' . $startDate . ' to ' . $endDate]);
        fputcsv($output, ['Generated: ' . date('Y-m-d H:i:s')]);
        fputcsv($output, []); // Empty row
        
        // Write detailed sales data
        fputcsv($output, ['Month', 'Date', 'Cost', 'Invoice #', 'Sales Rep.', 'Total', 'Paid', 'Balance Due']);
        
        // Get detailed sales grouped by month
        $detailedStmt = $pdo->prepare("
            SELECT 
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
        $detailedSales = $detailedStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Group by month and write data
        $salesByMonth = [];
        foreach ($detailedSales as $sale) {
            if (!isset($salesByMonth[$sale['month']])) {
                $salesByMonth[$sale['month']] = [];
            }
            $salesByMonth[$sale['month']][] = $sale;
        }
        
        foreach ($salesByMonth as $month => $monthSales) {
            $firstRow = true;
            $monthTotal = ['cost' => 0, 'total' => 0, 'paid' => 0, 'balance_due' => 0];
            
            foreach ($monthSales as $sale) {
                $monthTotal['cost'] += floatval($sale['cost'] ?? 0);
                $monthTotal['total'] += floatval($sale['total'] ?? 0);
                $monthTotal['paid'] += floatval($sale['paid'] ?? 0);
                $monthTotal['balance_due'] += floatval($sale['balance_due'] ?? 0);
                
                fputcsv($output, [
                    $firstRow ? $sale['month'] : '',
                    $firstRow ? $sale['order_date_formatted'] : '',
                    number_format($sale['cost'] ?? 0, 2),
                    $sale['invoice_number'],
                    $sale['sales_rep'] ?? 'N/A',
                    number_format($sale['total'] ?? 0, 2),
                    number_format($sale['paid'] ?? 0, 2),
                    number_format($sale['balance_due'] ?? 0, 2)
                ]);
                $firstRow = false;
            }
            
            // Write month total
            fputcsv($output, [
                $month . ' Total',
                '',
                number_format($monthTotal['cost'], 2),
                '',
                '',
                number_format($monthTotal['total'], 2),
                number_format($monthTotal['paid'], 2),
                number_format($monthTotal['balance_due'], 2)
            ]);
        }
        
        fclose($output);
        exit;
    } else {
        // Return JSON
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'report' => [
                'period' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate
                ],
                'orders' => $orders,
                'top_products' => $products
            ]
        ]);
    }
    
} catch (Exception $e) {
    error_log("Export Report API Error: " . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while exporting the report.'
    ]);
}
?>

