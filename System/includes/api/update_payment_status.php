<?php
/**
 * Update Payment Status API
 * Updates payment status and decreases stock when status changes to 'Paid'
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

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/email_sender.php';

/**
 * Build absolute base URL for links in emails.
 */
function matarix_base_url() {
    require_once __DIR__ . '/../includes/path_helper.php';
    return getBaseUrl();
}

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// Check if user is admin (optional)
// if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'Admin') {
//     http_response_code(403);
//     echo json_encode(['success' => false, 'message' => 'Access denied']);
//     exit;
// }

$data = json_decode(file_get_contents('php://input'), true);
$orderId = $data['order_id'] ?? null;
$paymentStatus = $data['payment_status'] ?? null; // 'Paid' or 'To Pay'

if (!$orderId || !$paymentStatus) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Order ID and payment status are required'
    ]);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    $pdo->beginTransaction();
    
    // Get current payment status
    $stmt = $pdo->prepare("SELECT payment FROM orders WHERE Order_ID = :order_id");
    $stmt->execute(['order_id' => $orderId]);
    $currentOrder = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$currentOrder) {
        throw new Exception('Order not found');
    }
    
    $wasPaid = ($currentOrder['payment'] === 'Paid');
    
    // Map payment status values
    $orderPaymentStatus = ($paymentStatus === 'Paid') ? 'Paid' : 'To Pay';
    $transactionPaymentStatus = ($paymentStatus === 'Paid') ? 'Paid' : 'Pending';
    
    // Update order payment status
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET payment = :payment_status,
            last_updated = NOW()
        WHERE Order_ID = :order_id
    ");
    $stmt->execute([
        'payment_status' => $orderPaymentStatus,
        'order_id' => (int)$orderId
    ]);
    
    if ($stmt->rowCount() === 0) {
        throw new Exception('Order not found');
    }
    
    // Update transaction payment status
    $stmt = $pdo->prepare("
        UPDATE transactions 
        SET Payment_Status = :payment_status,
            Updated_At = NOW()
        WHERE Order_ID = :order_id
    ");
    $stmt->execute([
        'payment_status' => $transactionPaymentStatus,
        'order_id' => (int)$orderId
    ]);
    
    // If changing to 'Paid', decrease stock and ensure delivery record exists
    // If changing from 'Paid' to 'To Pay', increase stock back
    if ($orderPaymentStatus === 'Paid' && !$wasPaid) {
        // Get order items
        $stmt = $pdo->prepare("
            SELECT Product_ID, Quantity 
            FROM transaction_items 
            WHERE Order_ID = :order_id
        ");
        $stmt->execute(['order_id' => $orderId]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Decrease stock for each item
        foreach ($items as $item) {
            $stmt = $pdo->prepare("
                UPDATE products 
                SET stock_level = stock_level - :quantity
                WHERE Product_ID = :product_id
            ");
            $stmt->execute([
                'quantity' => $item['Quantity'],
                'product_id' => $item['Product_ID']
            ]);
            
            // Update stock status
            $stmt = $pdo->prepare("
                UPDATE products 
                SET stock_status = CASE
                    WHEN stock_level <= 0 THEN 'Out of Stock'
                    WHEN stock_level <= Minimum_Stock THEN 'Low Stock'
                    ELSE 'In Stock'
                END
                WHERE Product_ID = :product_id
            ");
            $stmt->execute(['product_id' => $item['Product_ID']]);
        }
        
        // Ensure delivery record exists when payment is confirmed
        // Check if delivery record already exists
        $stmt = $pdo->prepare("
            SELECT Delivery_ID 
            FROM deliveries 
            WHERE Order_ID = :order_id
            LIMIT 1
        ");
        $stmt->execute(['order_id' => $orderId]);
        $existingDelivery = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$existingDelivery) {
            // Create delivery record if it doesn't exist
            $stmt = $pdo->prepare("
                INSERT INTO deliveries (Order_ID, Delivery_Status, Created_At, Updated_At)
                VALUES (:order_id, 'Pending', NOW(), NOW())
            ");
            $stmt->execute(['order_id' => $orderId]);
        } else {
            // Update delivery status to 'Preparing' if it was 'Pending' (standardized)
            // This ensures delivery tracking starts when payment is confirmed
            $stmt = $pdo->prepare("
                UPDATE deliveries 
                SET Delivery_Status = CASE 
                    WHEN Delivery_Status = 'Pending' THEN 'Preparing'
                    ELSE Delivery_Status
                END,
                Updated_At = NOW()
                WHERE Order_ID = :order_id AND Delivery_Status = 'Pending'
            ");
            $stmt->execute(['order_id' => $orderId]);
        }
    } else if ($orderPaymentStatus === 'To Pay' && $wasPaid) {
        // Increase stock back if changing from Paid to To Pay (hybrid: variation or product)
        $hasVariationId = $pdo->query("SHOW COLUMNS FROM transaction_items LIKE 'Variation_ID'")->rowCount() > 0;
        $cols = 'Product_ID, Quantity';
        if ($hasVariationId) $cols .= ', Variation_ID';
        $stmt = $pdo->prepare("SELECT {$cols} FROM transaction_items WHERE Order_ID = :order_id");
        $stmt->execute(['order_id' => $orderId]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
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
                $stmt = $pdo->prepare("UPDATE products SET stock_level = stock_level + :quantity WHERE Product_ID = :product_id");
                $stmt->execute(['quantity' => $quantity, 'product_id' => $productId]);
                $stmt = $pdo->prepare("UPDATE products SET stock_status = CASE WHEN stock_level <= 0 THEN 'Out of Stock' WHEN stock_level <= Minimum_Stock THEN 'Low Stock' ELSE 'In Stock' END WHERE Product_ID = :product_id");
                $stmt->execute(['product_id' => $productId]);
            }
        }
    }
    
    $pdo->commit();
    
    // Get customer info for notifications
    $customerStmt = $pdo->prepare("
        SELECT u.User_ID, u.email, u.First_Name, u.Middle_Name, u.Last_Name, o.amount
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
    
    // Create admin notification for payment status update
    require_once __DIR__ . '/create_admin_activity_notification.php';
    $activityType = $orderPaymentStatus === 'Paid' ? 'payment_received' : 'payment_updated';
    createAdminActivityNotification($pdo, $activityType, [
        'order_id' => (int)$orderId,
        'customer_name' => $customerName,
        'message' => "Payment status updated to {$orderPaymentStatus} for order #{$orderId}" . ($customerName ? " (Customer: {$customerName})" : '')
    ]);
    
    // Create customer notification for payment confirmation
    if ($customerUserId && $orderPaymentStatus === 'Paid' && !$wasPaid) {
        require_once __DIR__ . '/create_customer_notification.php';
        createCustomerNotification($pdo, $customerUserId, 'payment_confirmed', [
            'order_id' => (int)$orderId,
            'message' => "Your payment for order #{$orderId} has been confirmed!"
        ]);
        
        // Send SMS notification for payment received/confirmed
        try {
            $phoneStmt = $pdo->prepare("SELECT Phone_Number FROM users WHERE User_ID = :user_id");
            $phoneStmt->execute(['user_id' => $customerUserId]);
            $phoneNumber = $phoneStmt->fetchColumn();
            
            if ($phoneNumber && !empty($phoneNumber)) {
                require_once __DIR__ . '/../includes/sms_sender.php';
                $smsSender = new SMSSender();
                // Send payment confirmed SMS (covers both received and confirmed)
                $smsResult = $smsSender->sendPaymentConfirmedSMS($phoneNumber, (int)$orderId);
                
                if (!$smsResult['success']) {
                    error_log("SMS notification failed for payment confirmed: " . $smsResult['message']);
                    // Don't fail the whole operation if SMS fails
                }
            }
        } catch (Exception $e) {
            error_log("SMS notification exception for payment confirmed: " . $e->getMessage());
            // Don't fail the whole operation if SMS fails
        }
    }

    // If payment status changed back to "To Pay", notify customer by email (payment required again)
    if ($customerEmail && $orderPaymentStatus === 'To Pay' && $wasPaid) {
        try {
            $emailSender = new EmailSender();
            $paymentLink = matarix_base_url() . '/Customer/payment.html?order_id=' . (int)$orderId;
            $emailSender->sendPaymentRequiredEmail($customerEmail, (int)$orderId, (float)$orderAmount, $paymentLink, $customerName);
        } catch (Exception $e) {
            error_log("Email notification exception for payment required (reverted to To Pay): " . $e->getMessage());
            // Don't fail the whole operation if email fails
        }
    }
    
    ob_end_clean();
    echo json_encode([
        'success' => true,
        'message' => 'Payment status updated successfully',
        'order_id' => $orderId,
        'payment_status' => $orderPaymentStatus,
        'stock_updated' => ($orderPaymentStatus === 'Paid' && !$wasPaid) || ($orderPaymentStatus === 'To Pay' && $wasPaid)
    ]);
    exit;
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ob_end_clean();
    error_log("Update Payment Status Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update payment status. Please try again.'
    ]);
    exit;
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ob_end_clean();
    error_log("Update Payment Status Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update payment status. Please try again.'
    ]);
    exit;
}
?>

