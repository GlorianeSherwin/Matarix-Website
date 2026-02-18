<?php
/**
 * Get Receipt Data API
 * Returns formatted receipt data for a specific order
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
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit;
}

// Try to start admin session first (for admin users viewing receipts)
// If no admin session, try customer session
if (session_status() !== PHP_SESSION_NONE) {
    @session_write_close();
}

$sessionFound = false;
$userRole = null;

// First, try admin session
require_once __DIR__ . '/../includes/path_helper.php';
$basePath = getBasePath();
$isSecure = isSecure();

session_set_cookie_params([
    'lifetime' => 0,
    'path' => $basePath,
    'domain' => '',
    'secure' => $isSecure,
    'httponly' => true,
    'samesite' => 'Lax'
]);
session_name('MATARIX_ADMIN_SESSION');
@session_start();

// Check if admin session exists
if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true && isset($_SESSION['user_id'])) {
    $sessionFound = true;
    $userRole = $_SESSION['user_role'] ?? null;
} else {
    // Close admin session and try customer session
    @session_write_close();
    
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $basePath,
        'domain' => '',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_name('MATARIX_CUSTOMER_SESSION');
    @session_start();
    
    if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true && isset($_SESSION['user_id'])) {
        $sessionFound = true;
        $userRole = $_SESSION['user_role'] ?? null;
    }
}

// Check if user is logged in
if (!$sessionFound || !isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

$userId = (int)$_SESSION['user_id'];
$userRole = $_SESSION['user_role'] ?? '';
$orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;

if (!$orderId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Order ID is required']);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Check if user is admin or store employee (can view any receipt)
    $isAdmin = in_array($userRole, ['Admin', 'Store Employee']);
    
    // Get order with customer and transaction details
    // Admins can view any order, customers can only view their own
    $sql = "
        SELECT 
            o.Order_ID,
            o.User_ID,
            o.order_date,
            o.status,
            o.payment,
            o.amount,
            o.payment_method,
            o.last_updated,
            t.Transaction_ID,
            t.Subtotal,
            t.Total,
            t.Payment_Status,
            t.Payment_Method as transaction_payment_method,
            t.proof_of_payment,
            t.Created_At as transaction_date,
            u.First_Name,
            u.Last_Name,
            u.email,
            u.Phone_Number,
            u.address
        FROM orders o
        LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
        LEFT JOIN users u ON o.User_ID = u.User_ID
        WHERE o.Order_ID = :order_id
    ";
    
    // Add user restriction only if not admin
    if (!$isAdmin) {
        $sql .= " AND o.User_ID = :user_id";
    }
    
    $stmt = $pdo->prepare($sql);
    if ($isAdmin) {
        $stmt->execute(['order_id' => $orderId]);
    } else {
        $stmt->execute(['order_id' => $orderId, 'user_id' => $userId]);
    }
    
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$order) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Order not found or access denied']);
        exit;
    }
    
    // Get order items with product details
    $stmt = $pdo->prepare("
        SELECT 
            ti.Item_ID,
            ti.Product_ID,
            ti.Quantity,
            ti.Price,
            p.Product_Name,
            p.category,
            p.length,
            p.Width,
            p.Unit
        FROM transaction_items ti
        JOIN products p ON ti.Product_ID = p.Product_ID
        WHERE ti.Order_ID = :order_id
        ORDER BY ti.Item_ID
    ");
    $stmt->execute(['order_id' => $orderId]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format items for receipt
    $formattedItems = [];
    foreach ($items as $item) {
        // Build variation string (e.g., "6inch x 6inch" or "50.00cm x 30.00cm")
        $variation = '';
        if ($item['length'] && $item['Width']) {
            $variation = $item['length'] . $item['Unit'] . ' x ' . $item['Width'] . $item['Unit'];
        } elseif ($item['length']) {
            $variation = $item['length'] . $item['Unit'];
        } elseif ($item['Width']) {
            $variation = $item['Width'] . $item['Unit'];
        } else {
            $variation = 'Standard';
        }
        
        $formattedItems[] = [
            'name' => $item['Product_Name'],
            'variation' => $variation,
            'quantity' => (int)$item['Quantity'],
            'unitPrice' => (float)$item['Price'],
            'total' => (float)($item['Price'] * $item['Quantity'])
        ];
    }
    
    // Format dates
    $orderDate = new DateTime($order['order_date']);
    
    // Check if payment is actually completed
    $isPaid = ($order['payment'] === 'Paid') || 
              ($order['Payment_Status'] === 'Paid') || 
              (!empty($order['transaction_date']) && $order['payment'] === 'Paid');
    
    // Only use transaction date if payment is actually completed
    // Otherwise, show "N/A" for payment date/time
    if ($isPaid && !empty($order['transaction_date'])) {
        $transactionDate = new DateTime($order['transaction_date']);
        $paymentDate = $transactionDate->format('F j, Y');
        $paymentTime = $transactionDate->format('g:i A');
    } else {
        // Payment not completed - use order date for reference but mark as not paid
        $transactionDate = $orderDate;
        $paymentDate = 'N/A';
        $paymentTime = 'N/A';
    }
    
    // Format customer name
    $customerName = trim(($order['First_Name'] ?? '') . ' ' . ($order['Last_Name'] ?? ''));
    
    // Determine payment method display
    // For orders without payment method selected, show "Not Selected" or "N/A"
    $paymentMethod = null;
    if (!empty($order['payment_method']) && $order['payment_method'] !== 'null' && $order['payment_method'] !== 'NULL') {
        $paymentMethod = $order['payment_method'];
    } else if (!empty($order['transaction_payment_method']) && $order['transaction_payment_method'] !== 'null' && $order['transaction_payment_method'] !== 'NULL') {
        // Only use transaction_payment_method as fallback for non-Waiting Payment orders
        if ($order['status'] !== 'Waiting Payment') {
            $paymentMethod = $order['transaction_payment_method'];
        }
    }
    
    // Format payment method display
    if (!$paymentMethod || $paymentMethod === 'null' || $paymentMethod === 'NULL') {
        $paymentMethod = 'Not Selected';
    } else if ($paymentMethod === 'Cash on Delivery') {
        $paymentMethod = 'On-Site';
    }
    
    // Get account number - try to extract from proof of payment or use phone number
    $accountNumber = $order['Phone_Number'] ?? 'N/A';
    // If proof of payment exists, you might want to extract account number from filename
    // For now, we'll use phone number as account number for GCash
    
    // Format order number
    $orderNumber = 'ORD-' . str_pad($order['Order_ID'], 4, '0', STR_PAD_LEFT);
    
    // Format transaction ID
    $transactionId = $order['Transaction_ID'] ? 'TXN-' . str_pad($order['Transaction_ID'], 6, '0', STR_PAD_LEFT) : 'N/A';
    
    // If no transaction ID, try to use order ID as reference
    if ($transactionId === 'N/A') {
        $transactionId = $orderNumber; // Fallback to order number
    }
    
    // Calculate subtotal (sum of all items)
    $subtotal = array_sum(array_column($formattedItems, 'total'));
    
    // Use transaction total if available, otherwise use order amount
    $total = $order['Total'] ?? $order['amount'] ?? $subtotal;
    
    // Build receipt data
    $receiptData = [
        'success' => true,
        'orderNumber' => $orderNumber,
        'transactionId' => $transactionId,
        'referenceNumber' => $transactionId, // Use transaction ID as reference number
        'paymentMethod' => $paymentMethod,
        'accountNumber' => $accountNumber,
        'transactionDate' => $paymentDate, // Only show date if paid, otherwise "N/A"
        'transactionTime' => $paymentTime, // Only show time if paid, otherwise "N/A"
        'status' => $isPaid ? 'COMPLETED' : 'PENDING',
        'amountPaid' => (float)$total,
        'customerName' => $customerName,
        'customerPhone' => $order['Phone_Number'] ?? 'N/A',
        'customerAddress' => $order['address'] ?? 'N/A',
        'items' => $formattedItems,
        'subtotal' => (float)$subtotal,
        'total' => (float)$total
    ];
    
    ob_end_clean();
    echo json_encode($receiptData);
    exit;
    
} catch (PDOException $e) {
    ob_end_clean();
    error_log("Get Receipt Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch receipt data']);
    exit;
} catch (Exception $e) {
    ob_end_clean();
    error_log("Get Receipt Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch receipt data']);
    exit;
}
?>

