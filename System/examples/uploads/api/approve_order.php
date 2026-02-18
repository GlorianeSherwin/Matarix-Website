<?php
/**
 * Approve Order API
 * Allows admin to approve a pending order
 * Changes status from 'Pending Approval' to 'Waiting Payment'
 */

// Start output buffering to prevent any output before headers
ob_start();

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
require_once __DIR__ . '/../includes/email_sender.php';

/**
 * Build absolute base URL for links in emails.
 * Uses dynamic path detection for Hostinger compatibility
 */
function matarix_base_url() {
    require_once __DIR__ . '/../includes/path_helper.php';
    return getBaseUrl();
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit;
}

// Ensure session is started and maintained
if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
} else {
    // If session exists but name doesn't match, restart with correct name
    if (session_name() !== 'MATARIX_ADMIN_SESSION') {
        session_write_close();
        startSession('admin');
    }
}

// Ensure session is active
if (session_status() === PHP_SESSION_NONE) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Session initialization failed'
    ]);
    exit;
}

// RBAC: accepting/approving orders (Store Employee + Admin)
rbac_require_permission_api('orders.accept');

// Debug logging
error_log("Approve Order - Session Name: " . session_name());
error_log("Approve Order - Session ID: " . session_id());
error_log("Approve Order - Session Status: " . session_status());
error_log("Approve Order - Cookies: " . json_encode($_COOKIE));
error_log("Approve Order - Session Data: " . json_encode($_SESSION));

// rbac_require_permission_api() already validated login + role permission

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$orderId = $data['order_id'] ?? null;

if (!$orderId) {
    ob_end_clean();
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
    
    // Use SELECT FOR UPDATE to lock the row and prevent concurrent approvals
    // Get current order status with row lock
    // If status is NULL or empty string, treat it as 'Pending Approval' (default)
    $stmt = $pdo->prepare("
        SELECT COALESCE(NULLIF(TRIM(status), ''), 'Pending Approval') as status 
        FROM orders 
        WHERE Order_ID = :order_id
        FOR UPDATE
    ");
    $stmt->execute(['order_id' => (int)$orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$order) {
        $pdo->rollBack();
        ob_end_clean();
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Order not found'
        ]);
        exit;
    }
    
    // Get and normalize order status (already normalized by SQL COALESCE)
    $currentStatus = isset($order['status']) ? trim($order['status']) : 'Pending Approval';
    $pendingApprovalStatus = 'Pending Approval';

    // Check if order is in 'Pending Approval' status (case-insensitive comparison)
    if (empty($currentStatus) || strcasecmp($currentStatus, $pendingApprovalStatus) !== 0) {
        $pdo->rollBack();
        ob_end_clean();
        http_response_code(400);
        $statusDisplay = $currentStatus ?: '(No status set)';
        echo json_encode([
            'success' => false,
            'message' => 'Order is not pending approval. Current status: ' . $statusDisplay,
            'current_status' => $currentStatus,
            'required_status' => $pendingApprovalStatus,
            'already_approved' => true
        ]);
        exit;
    }
    
    // Update order status to 'Waiting Payment' and record approval
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET status = 'Waiting Payment',
            approved_at = NOW(),
            approved_by = :admin_id,
            last_updated = NOW()
        WHERE Order_ID = :order_id
    ");
    $stmt->execute([
        'order_id' => (int)$orderId,
        'admin_id' => $_SESSION['user_id']
    ]);
    
    if ($stmt->rowCount() === 0) {
        $pdo->rollBack();
        ob_end_clean();
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to approve order'
        ]);
        exit;
    }
    
    $pdo->commit();
    
    // Ensure session is still active before proceeding
    if (session_status() === PHP_SESSION_NONE || !isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Session expired. Please refresh the page and try again.'
        ]);
        exit;
    }
    
    // Get customer info for notifications
    $customerStmt = $pdo->prepare("
        SELECT 
            u.User_ID, u.email, u.First_Name, u.Middle_Name, u.Last_Name,
            o.amount
        FROM orders o 
        JOIN users u ON o.User_ID = u.User_ID 
        WHERE o.Order_ID = :order_id
    ");
    $customerStmt->execute(['order_id' => (int)$orderId]);
    $customer = $customerStmt->fetch(PDO::FETCH_ASSOC);
    $customerName = trim(($customer['First_Name'] ?? '') . ' ' . ($customer['Middle_Name'] ?? '') . ' ' . ($customer['Last_Name'] ?? ''));
    $customerUserId = $customer['User_ID'] ?? null;
    $customerEmail = $customer['email'] ?? null;
    $orderAmount = $customer['amount'] ?? null;
    
    // Create admin notification for order approved
    require_once __DIR__ . '/create_admin_activity_notification.php';
    createAdminActivityNotification($pdo, 'order_approved', [
        'order_id' => (int)$orderId,
        'customer_name' => $customerName,
        'message' => "Order #{$orderId} has been approved" . ($customerName ? " (Customer: {$customerName})" : '')
    ]);
    
    // Create customer notification for order approved
    if ($customerUserId) {
        require_once __DIR__ . '/create_customer_notification.php';
        createCustomerNotification($pdo, $customerUserId, 'order_approved', [
            'order_id' => (int)$orderId,
            'message' => "Your order #{$orderId} has been approved! You can now proceed with payment."
        ]);
        
        // Send SMS notification for order approved
        try {
            $phoneStmt = $pdo->prepare("SELECT Phone_Number FROM users WHERE User_ID = :user_id");
            $phoneStmt->execute(['user_id' => $customerUserId]);
            $phoneNumber = $phoneStmt->fetchColumn();
            
            if ($phoneNumber && !empty($phoneNumber)) {
                require_once __DIR__ . '/../includes/sms_sender.php';
                $smsSender = new SMSSender();
                $smsResult = $smsSender->sendOrderApprovedSMS($phoneNumber, (int)$orderId);
                
                if (!$smsResult['success']) {
                    error_log("SMS notification failed for order approval: " . $smsResult['message']);
                    // Don't fail the whole operation if SMS fails
                }
            }
        } catch (Exception $e) {
            error_log("SMS notification exception for order approval: " . $e->getMessage());
            // Don't fail the whole operation if SMS fails
        }
    }

    // Send email notification: payment required (order approved -> Waiting Payment)
    if ($customerEmail) {
        try {
            $emailSender = new EmailSender();
            $paymentLink = matarix_base_url() . '/Customer/payment.html?order_id=' . (int)$orderId;
            $emailSender->sendPaymentRequiredEmail($customerEmail, (int)$orderId, (float)$orderAmount, $paymentLink, $customerName);
        } catch (Exception $e) {
            error_log("Email notification exception for order approval/payment required: " . $e->getMessage());
            // Don't fail the operation if email fails
        }
    }
    
    ob_end_clean();
    echo json_encode([
        'success' => true,
        'message' => 'Order approved successfully. Customer can now proceed with payment.',
        'order_id' => $orderId,
        'new_status' => 'Waiting Payment'
    ]);
    exit;
    
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ob_end_clean();
    error_log("Approve Order Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to approve order. Please try again.'
    ]);
    exit;
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ob_end_clean();
    error_log("Approve Order Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to approve order. Please try again.'
    ]);
    exit;
}
?>

