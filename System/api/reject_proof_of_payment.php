<?php
/**
 * Reject Proof of Payment API
 * Allows admin/employee to reject a proof of payment and request reupload
 */

// Suppress PHP errors from output - send to error log instead
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start output buffering to catch any unexpected output
ob_start();

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

// Check if user is admin or store employee
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
        'message' => 'Access denied. Only admins and store employees can reject proof of payment.'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$orderId = $data['order_id'] ?? null;
$rejectionReason = $data['rejection_reason'] ?? null;

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
    $pdo->beginTransaction();
    
    // Get order details
    $stmt = $pdo->prepare("
        SELECT o.Order_ID, o.User_ID, o.status, o.payment_method, o.payment,
               u.First_Name, u.Last_Name, u.Phone_Number, u.email,
               t.proof_of_payment
        FROM orders o
        LEFT JOIN users u ON o.User_ID = u.User_ID
        LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
        WHERE o.Order_ID = :order_id
    ");
    $stmt->execute(['order_id' => (int)$orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$order) {
        $pdo->rollBack();
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
        $pdo->rollBack();
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
    
    // Check if order has GCash payment method and proof exists
    $paymentMethod = $order['payment_method'] ?? null;
    $hasProof = !empty($order['proof_of_payment']);
    
    if ($paymentMethod !== 'GCash' && $paymentMethod !== 'gcash') {
        $pdo->rollBack();
        if (ob_get_level() > 0) {
            ob_clean();
        }
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'This order does not use GCash payment method.'
        ]);
        exit;
    }
    
    if (!$hasProof) {
        $pdo->rollBack();
        if (ob_get_level() > 0) {
            ob_clean();
        }
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'No proof of payment found for this order.'
        ]);
        exit;
    }
    
    // Ensure proof_rejected column exists (so re-upload can set proof_updated_at and show "New proof uploaded")
    $hasProofRejectedCol = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'proof_rejected'")->rowCount() > 0;
    if (!$hasProofRejectedCol) {
        try {
            $pdo->exec("ALTER TABLE transactions ADD COLUMN proof_rejected TINYINT(1) NOT NULL DEFAULT 0");
            $hasProofRejectedCol = true;
        } catch (PDOException $e) {
            error_log("Reject proof - add proof_rejected column: " . $e->getMessage());
        }
    }
    // Clear proof of payment and set proof_rejected flag so customer sees "Update proof of payment" tag
    $updateSql = "UPDATE transactions SET proof_of_payment = NULL" . ($hasProofRejectedCol ? ", proof_rejected = 1" : "") . ", Updated_At = NOW() WHERE Order_ID = :order_id";
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute(['order_id' => (int)$orderId]);
    
    // Update order status to "Waiting Payment" and payment status to "To Pay"
    $updateOrderStmt = $pdo->prepare("
        UPDATE orders 
        SET status = 'Waiting Payment',
            payment = 'To Pay',
            last_updated = NOW()
        WHERE Order_ID = :order_id
    ");
    $updateOrderStmt->execute(['order_id' => (int)$orderId]);
    
    // Update transaction payment status
    $updateTransactionStmt = $pdo->prepare("
        UPDATE transactions 
        SET Payment_Status = 'Pending',
            Updated_At = NOW()
        WHERE Order_ID = :order_id
    ");
    $updateTransactionStmt->execute(['order_id' => (int)$orderId]);
    
    // If order was previously in Processing/Paid status, increase stock back (hybrid: variation or product)
    if ($order['payment'] === 'Paid' && $order['status'] === 'Processing') {
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
    }
    
    $pdo->commit();
    
    // Create customer notification for proof rejection
    require_once __DIR__ . '/create_customer_notification.php';
    $customerName = trim(($order['First_Name'] ?? '') . ' ' . ($order['Last_Name'] ?? ''));
    
    $notificationMessage = "Your proof of payment for order #{$orderId} has been rejected." . 
                          ($rejectionReason ? " Reason: {$rejectionReason}" : " Please upload a new proof of payment.");
    
    $notificationCreated = createCustomerNotification($pdo, $customerUserId, 'proof_rejected', [
        'order_id' => (int)$orderId,
        'message' => $notificationMessage,
        'rejection_reason' => $rejectionReason
    ]);
    
    if (!$notificationCreated) {
        error_log("Failed to create customer notification for proof rejection - Order ID: {$orderId}");
    }
    
    // Create admin activity notification
    require_once __DIR__ . '/create_admin_activity_notification.php';
    createAdminActivityNotification($pdo, 'proof_rejected', [
        'order_id' => (int)$orderId,
        'customer_name' => $customerName,
        'message' => "Rejected proof of payment for order #{$orderId}" . ($customerName ? " (Customer: {$customerName})" : '') . 
                     ($rejectionReason ? " - Reason: {$rejectionReason}" : '')
    ]);
    
    // Send email notification if email is available
    $customerEmail = $order['email'] ?? null;
    if ($customerEmail && !empty($customerEmail)) {
        try {
            require_once __DIR__ . '/../includes/email_sender.php';
            
            if (class_exists('EmailSender')) {
                $emailSender = new EmailSender();
                
                if (method_exists($emailSender, 'sendProofReuploadRequestEmail')) {
                    // Build payment page URL
                    require_once __DIR__ . '/../includes/path_helper.php';
                    $paymentLink = getBaseUrl() . '/Customer/payment.html?order_id=' . (int)$orderId;
                    
                    $emailSent = $emailSender->sendProofReuploadRequestEmail($customerEmail, (int)$orderId, $paymentLink, $customerName);
                    
                    if (!$emailSent) {
                        error_log("Email notification failed for proof rejection - Order ID: {$orderId}");
                    } else {
                        error_log("Proof rejection email sent successfully to: {$customerEmail} for order #{$orderId}");
                    }
                }
            }
        } catch (Exception $e) {
            error_log("Email notification exception for proof rejection: " . $e->getMessage());
        } catch (Error $e) {
            error_log("Email notification fatal error for proof rejection: " . $e->getMessage());
        }
    }
    
    // Send SMS notification if phone number is available (include rejection reason so customer knows what to fix)
    if (!empty($order['Phone_Number'])) {
        try {
            require_once __DIR__ . '/../includes/sms_sender.php';
            $smsSender = new SMSSender();
            $smsResult = $smsSender->sendProofReuploadRequestSMS($order['Phone_Number'], (int)$orderId, $rejectionReason);
            
            if (!$smsResult['success']) {
                error_log("SMS notification failed for proof rejection: " . $smsResult['message']);
            }
        } catch (Exception $e) {
            error_log("SMS notification exception for proof rejection: " . $e->getMessage());
        }
    }
    
    // Clear any output buffer before sending JSON
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Proof of payment rejected successfully. Customer has been notified to reupload.',
        'order_id' => (int)$orderId,
        'customer_id' => (int)$customerUserId
    ]);
    
} catch (PDOException $e) {
    $pdo->rollBack();
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    error_log("Reject Proof of Payment Error: " . $e->getMessage());
    error_log("Reject Proof of Payment Stack Trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
    exit;
} catch (Exception $e) {
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    error_log("Reject Proof of Payment General Error: " . $e->getMessage());
    error_log("Reject Proof of Payment Stack Trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while processing your request. Please try again.'
    ]);
    exit;
} catch (Error $e) {
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    error_log("Reject Proof of Payment Fatal Error: " . $e->getMessage());
    error_log("Reject Proof of Payment Fatal Error Stack Trace: " . $e->getTraceAsString());
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
