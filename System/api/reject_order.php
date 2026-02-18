<?php
/**
 * Reject Order API
 * Allows admin/employee to reject an order in any status
 * Changes status to 'Rejected' and reverses stock changes if order was paid/processing
 */

// Suppress PHP errors from output - send to error log instead
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
// When using credentials, we must specify the origin, not use *
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 
          (isset($_SERVER['HTTP_REFERER']) ? parse_url($_SERVER['HTTP_REFERER'], PHP_URL_SCHEME) . '://' . parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST) : '*');
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: cancelling/rejecting orders (Store Employee + Admin)
rbac_require_permission_api('orders.cancel');

// Debug logging
error_log("Reject Order - Session Name: " . session_name());
error_log("Reject Order - Session ID: " . session_id());
error_log("Reject Order - Session Status: " . session_status());
error_log("Reject Order - Cookies: " . json_encode($_COOKIE));
error_log("Reject Order - Session Data: " . json_encode($_SESSION));

// rbac_require_permission_api() already validated login + role permission

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$orderId = $data['order_id'] ?? null;
$rejectionReason = $data['rejection_reason'] ?? null;

if (!$orderId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Order ID is required'
    ]);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    $pdo->beginTransaction();
    
    // Get current order status (using same logic as get_orders.php for consistency)
    // If status is NULL or empty string, treat it as 'Pending Approval' (default)
    $stmt = $pdo->prepare("SELECT COALESCE(NULLIF(TRIM(status), ''), 'Pending Approval') as status FROM orders WHERE Order_ID = :order_id");
    $stmt->execute(['order_id' => (int)$orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$order) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Order not found'
        ]);
        exit;
    }
    
    // Get and normalize order status (already normalized by SQL COALESCE)
    $currentStatus = isset($order['status']) ? trim($order['status']) : 'Pending Approval';
    
    // Check if order is already rejected
    if (strcasecmp($currentStatus, 'Rejected') === 0) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'This order is already rejected.'
        ]);
        exit;
    }
    
    // Get full order details including payment status for stock reversal
    $orderDetailsStmt = $pdo->prepare("
        SELECT o.Order_ID, o.status, o.payment, o.payment_method
        FROM orders o
        WHERE o.Order_ID = :order_id
    ");
    $orderDetailsStmt->execute(['order_id' => (int)$orderId]);
    $orderDetails = $orderDetailsStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$orderDetails) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Order not found'
        ]);
        exit;
    }
    
    $wasPaid = ($orderDetails['payment'] === 'Paid');
    $wasProcessing = ($orderDetails['status'] === 'Processing');
    
    // If order was paid/processing, reverse stock changes BEFORE updating order status (hybrid: variation or product)
    if ($wasPaid || $wasProcessing) {
        $hasVariationId = $pdo->query("SHOW COLUMNS FROM transaction_items LIKE 'Variation_ID'")->rowCount() > 0;
        $cols = 'Product_ID, Quantity';
        if ($hasVariationId) $cols .= ', Variation_ID';
        $itemsStmt = $pdo->prepare("SELECT {$cols} FROM transaction_items WHERE Order_ID = :order_id");
        $itemsStmt->execute(['order_id' => (int)$orderId]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($items as $item) {
            $productId = $item['Product_ID'];
            $quantity = (int)$item['Quantity'];
            $variationId = ($hasVariationId && !empty($item['Variation_ID'])) ? (int)$item['Variation_ID'] : null;
            $restoreToVariation = false;
            if ($variationId) {
                $vStmt = $pdo->prepare("SELECT stock_level FROM product_variations WHERE Variation_ID = :vid");
                $vStmt->execute(['vid' => $variationId]);
                $var = $vStmt->fetch(PDO::FETCH_ASSOC);
                if ($var && $var['stock_level'] !== null && $var['stock_level'] !== '') {
                    $restoreToVariation = true;
                    $pdo->prepare("UPDATE product_variations SET stock_level = stock_level + :qty WHERE Variation_ID = :vid")
                        ->execute(['qty' => $quantity, 'vid' => $variationId]);
                }
            }
            if (!$restoreToVariation) {
                $stockStmt = $pdo->prepare("UPDATE products SET stock_level = stock_level + :quantity WHERE Product_ID = :product_id");
                $stockStmt->execute(['quantity' => $quantity, 'product_id' => $productId]);
                $statusStmt = $pdo->prepare("UPDATE products SET stock_status = CASE WHEN stock_level <= 0 THEN 'Out of Stock' WHEN stock_level <= Minimum_Stock THEN 'Low Stock' ELSE 'In Stock' END WHERE Product_ID = :product_id");
                $statusStmt->execute(['product_id' => $productId]);
            }
        }
        error_log("Stock reversed for rejected order #{$orderId} - was paid/processing");
    }
    
    // Update order status to 'Rejected' and record rejection
    // Also set payment status to 'To Pay' if it was 'Paid' (for consistency)
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET status = 'Rejected',
            payment = CASE WHEN payment = 'Paid' THEN 'To Pay' ELSE payment END,
            rejected_at = NOW(),
            rejection_reason = :rejection_reason,
            last_updated = NOW()
        WHERE Order_ID = :order_id
    ");
    $stmt->execute([
        'order_id' => (int)$orderId,
        'rejection_reason' => $rejectionReason ?: null
    ]);
    
    // Update transaction payment status if order was paid
    if ($wasPaid) {
        $transactionStmt = $pdo->prepare("
            UPDATE transactions 
            SET Payment_Status = 'Pending',
                Updated_At = NOW()
            WHERE Order_ID = :order_id
        ");
        $transactionStmt->execute(['order_id' => (int)$orderId]);
    }
    
    if ($stmt->rowCount() === 0) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to reject order'
        ]);
        exit;
    }
    
    $pdo->commit();
    
    // Get customer info for notifications
    $customerStmt = $pdo->prepare("SELECT u.User_ID, u.First_Name, u.Middle_Name, u.Last_Name FROM orders o JOIN users u ON o.User_ID = u.User_ID WHERE o.Order_ID = :order_id");
    $customerStmt->execute(['order_id' => (int)$orderId]);
    $customer = $customerStmt->fetch(PDO::FETCH_ASSOC);
    $customerName = trim(($customer['First_Name'] ?? '') . ' ' . ($customer['Middle_Name'] ?? '') . ' ' . ($customer['Last_Name'] ?? ''));
    $customerUserId = $customer['User_ID'] ?? null;
    
    // Create admin notification for order rejected
    require_once __DIR__ . '/create_admin_activity_notification.php';
    createAdminActivityNotification($pdo, 'order_rejected', [
        'order_id' => (int)$orderId,
        'customer_name' => $customerName,
        'message' => "Order #{$orderId} has been rejected" . ($customerName ? " (Customer: {$customerName})" : '') . ($rejectionReason ? " - Reason: {$rejectionReason}" : '')
    ]);
    
    // Create customer notification for order rejected
    if ($customerUserId) {
        require_once __DIR__ . '/create_customer_notification.php';
        createCustomerNotification($pdo, $customerUserId, 'order_rejected', [
            'order_id' => (int)$orderId,
            'rejection_reason' => $rejectionReason,
            'message' => "Your order #{$orderId} has been rejected." . ($rejectionReason ? " Reason: {$rejectionReason}" : '')
        ]);
        
        // Send SMS notification for order rejected
        try {
            $phoneStmt = $pdo->prepare("SELECT Phone_Number FROM users WHERE User_ID = :user_id");
            $phoneStmt->execute(['user_id' => $customerUserId]);
            $phoneNumber = $phoneStmt->fetchColumn();
            
            if ($phoneNumber && !empty($phoneNumber)) {
                require_once __DIR__ . '/../includes/sms_sender.php';
                $smsSender = new SMSSender();
                $smsResult = $smsSender->sendOrderRejectedSMS($phoneNumber, (int)$orderId, $rejectionReason);
                
                if (!$smsResult['success']) {
                    error_log("SMS notification failed for order rejection: " . $smsResult['message']);
                    // Don't fail the whole operation if SMS fails
                }
            }
        } catch (Exception $e) {
            error_log("SMS notification exception for order rejection: " . $e->getMessage());
            // Don't fail the whole operation if SMS fails
        }
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Order rejected successfully.',
        'order_id' => $orderId,
        'new_status' => 'Rejected'
    ]);
    
} catch (PDOException $e) {
    $pdo->rollBack();
    error_log("Reject Order Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to reject order: ' . $e->getMessage()
    ]);
}
?>

