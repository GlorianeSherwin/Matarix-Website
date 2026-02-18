<?php
/**
 * Request Proof of Payment Reupload
 * Allows admin to request customer to reupload proof of payment for a specific order
 */

// Suppress PHP errors from output - send to error log instead
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start output buffering to catch any unexpected output
ob_start();

// Register shutdown function to ensure JSON is always returned
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== NULL && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (ob_get_level() > 0) {
            ob_clean();
        }
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'An internal server error occurred. Please try again later.'
        ]);
    }
});

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    if (ob_get_level() > 0) {
        ob_clean();
    }
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'User not authenticated'
    ]);
    exit;
}

// Check if user is admin
$userRole = $_SESSION['user_role'] ?? '';
$normalizedRole = trim($userRole);
$allowedRoles = ['Admin', 'Store Employee'];

if (!in_array($normalizedRole, $allowedRoles)) {
    if (ob_get_level() > 0) {
        ob_clean();
    }
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Access denied. Only admins and store employees can request proof reupload.'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$orderId = $data['order_id'] ?? null;

if (!$orderId) {
    if (ob_get_level() > 0) {
        ob_clean();
    }
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
    // Get order details
    $stmt = $pdo->prepare("
        SELECT o.Order_ID, o.User_ID, o.status, o.payment_method, o.payment,
               u.First_Name, u.Last_Name, u.Phone_Number, u.email
        FROM orders o
        LEFT JOIN users u ON o.User_ID = u.User_ID
        WHERE o.Order_ID = :order_id
    ");
    $stmt->execute(['order_id' => (int)$orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$order) {
        if (ob_get_level() > 0) {
            ob_clean();
        }
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Order not found'
        ]);
        exit;
    }
    
    $customerUserId = $order['User_ID'];
    if (!$customerUserId) {
        if (ob_get_level() > 0) {
            ob_clean();
        }
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Customer not found for this order'
        ]);
        exit;
    }
    
    // Check if order has GCash payment method (only GCash orders need proof of payment)
    $paymentMethod = $order['payment_method'] ?? null;
    if ($paymentMethod !== 'GCash' && $paymentMethod !== 'gcash') {
        if (ob_get_level() > 0) {
            ob_clean();
        }
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'This order does not use GCash payment method. Proof of payment reupload is only available for GCash orders.'
        ]);
        exit;
    }
    
    // Update order status to "Waiting Payment" and payment status to "To Pay"
    // This allows the customer to see they need to reupload proof of payment
    try {
        $pdo->beginTransaction();
        
        // Update order status and payment status
        $updateStmt = $pdo->prepare("
            UPDATE orders 
            SET status = 'Waiting Payment',
                payment = 'To Pay',
                last_updated = NOW()
            WHERE Order_ID = :order_id
        ");
        $updateStmt->execute(['order_id' => (int)$orderId]);
        
        // Update transaction payment status
        $updateTransactionStmt = $pdo->prepare("
            UPDATE transactions 
            SET Payment_Status = 'Pending',
                Updated_At = NOW()
            WHERE Order_ID = :order_id
        ");
        $updateTransactionStmt->execute(['order_id' => (int)$orderId]);
        
        // If order was previously in Processing/Paid status, we may need to increase stock back
        // Check if stock was already decreased (order was previously Paid)
        if ($order['payment'] === 'Paid' && $order['status'] === 'Processing') {
            // Get order items to increase stock back
            $itemsStmt = $pdo->prepare("
                SELECT Product_ID, Quantity 
                FROM transaction_items 
                WHERE Order_ID = :order_id
            ");
            $itemsStmt->execute(['order_id' => (int)$orderId]);
            $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($items as $item) {
                // Increase stock back
                $stockStmt = $pdo->prepare("
                    UPDATE products 
                    SET stock_level = stock_level + :quantity
                    WHERE Product_ID = :product_id
                ");
                $stockStmt->execute([
                    'quantity' => $item['Quantity'],
                    'product_id' => $item['Product_ID']
                ]);
                
                // Update stock status
                $statusStmt = $pdo->prepare("
                    UPDATE products 
                    SET stock_status = CASE
                        WHEN stock_level <= 0 THEN 'Out of Stock'
                        WHEN stock_level <= Minimum_Stock THEN 'Low Stock'
                        ELSE 'In Stock'
                    END
                    WHERE Product_ID = :product_id
                ");
                $statusStmt->execute(['product_id' => $item['Product_ID']]);
            }
        }
        
        $pdo->commit();
        error_log("Order status updated to 'Waiting Payment' and payment to 'To Pay' for order #{$orderId}");
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log("Failed to update order status for proof reupload request - Order ID: {$orderId}, Error: " . $e->getMessage());
        // Don't fail the whole operation if status update fails, but log it
    }
    
    // Create customer notification for proof reupload request
    require_once __DIR__ . '/create_customer_notification.php';
    $customerName = trim(($order['First_Name'] ?? '') . ' ' . ($order['Last_Name'] ?? ''));
    
    $notificationMessage = "Please reupload your proof of payment for order #{$orderId}. The current proof of payment needs to be replaced.";
    
    $notificationCreated = createCustomerNotification($pdo, $customerUserId, 'proof_reupload_requested', [
        'order_id' => (int)$orderId,
        'message' => $notificationMessage
    ]);
    
    if (!$notificationCreated) {
        error_log("Failed to create customer notification for proof reupload request - Order ID: {$orderId}");
    }
    
    // Create admin activity notification
    require_once __DIR__ . '/create_admin_activity_notification.php';
    createAdminActivityNotification($pdo, 'proof_reupload_requested', [
        'order_id' => (int)$orderId,
        'customer_name' => $customerName,
        'message' => "Requested proof of payment reupload for order #{$orderId}" . ($customerName ? " (Customer: {$customerName})" : '')
    ]);
    
    // Send email notification if email is available
    $customerEmail = $order['email'] ?? null;
    if ($customerEmail && !empty($customerEmail)) {
        try {
            require_once __DIR__ . '/../includes/email_sender.php';
            
            // Check if EmailSender class exists
            if (!class_exists('EmailSender')) {
                error_log("EmailSender class not found - Order ID: {$orderId}");
            } else {
                $emailSender = new EmailSender();
                
                // Check if method exists
                if (!method_exists($emailSender, 'sendProofReuploadRequestEmail')) {
                    error_log("sendProofReuploadRequestEmail method not found - Order ID: {$orderId}");
                } else {
                    // Build payment page URL
                    require_once __DIR__ . '/../includes/path_helper.php';
                    $paymentLink = getBaseUrl() . '/Customer/payment.html?order_id=' . (int)$orderId;
                    
                    $emailSent = $emailSender->sendProofReuploadRequestEmail($customerEmail, (int)$orderId, $paymentLink, $customerName);
                    
                    if (!$emailSent) {
                        error_log("Email notification failed for proof reupload request - Order ID: {$orderId}");
                        // Don't fail the whole operation if email fails
                    } else {
                        error_log("Proof reupload request email sent successfully to: {$customerEmail} for order #{$orderId}");
                    }
                }
            }
        } catch (Exception $e) {
            error_log("Email notification exception for proof reupload request: " . $e->getMessage());
            error_log("Email notification exception trace: " . $e->getTraceAsString());
            // Don't fail the whole operation if email fails
        } catch (Error $e) {
            error_log("Email notification fatal error for proof reupload request: " . $e->getMessage());
            error_log("Email notification fatal error trace: " . $e->getTraceAsString());
            // Don't fail the whole operation if email fails
        }
    }
    
    // Send SMS notification if phone number is available
    if (!empty($order['Phone_Number'])) {
        try {
            require_once __DIR__ . '/../includes/sms_sender.php';
            $smsSender = new SMSSender();
            $smsResult = $smsSender->sendProofReuploadRequestSMS($order['Phone_Number'], (int)$orderId);
            
            if (!$smsResult['success']) {
                error_log("SMS notification failed for proof reupload request: " . $smsResult['message']);
                // Don't fail the whole operation if SMS fails
            }
        } catch (Exception $e) {
            error_log("SMS notification exception for proof reupload request: " . $e->getMessage());
            // Don't fail the whole operation if SMS fails
        }
    }
    
    // Clear any output buffer before sending JSON
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Proof of payment reupload request sent to customer successfully',
        'order_id' => (int)$orderId,
        'customer_id' => (int)$customerUserId
    ]);
    
} catch (PDOException $e) {
    // Clear any output buffer before sending JSON
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    error_log("Request Proof Reupload Error: " . $e->getMessage());
    error_log("Request Proof Reupload Stack Trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
    exit;
} catch (Exception $e) {
    // Clear any output buffer before sending JSON
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    error_log("Request Proof Reupload General Error: " . $e->getMessage());
    error_log("Request Proof Reupload Stack Trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while processing your request. Please try again.'
    ]);
    exit;
} catch (Error $e) {
    // Clear any output buffer before sending JSON
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    error_log("Request Proof Reupload Fatal Error: " . $e->getMessage());
    error_log("Request Proof Reupload Fatal Error Stack Trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An internal error occurred. Please try again later.'
    ]);
    exit;
}

// End output buffering - only if we haven't exited already
if (ob_get_level() > 0) {
    ob_end_flush();
}
?>
