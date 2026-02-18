<?php
/**
 * Process Payment API
 * Allows customer to select payment method and process payment for approved orders
 */

// Start output buffering to catch any unwanted output
ob_start();

// Set headers first
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Suppress error display (we'll handle errors as JSON)
error_reporting(E_ALL);
ini_set('display_errors', 0);

try {
    require_once __DIR__ . '/../includes/db_functions.php';
    require_once __DIR__ . '/../includes/session_helper.php';
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to load required files: ' . $e->getMessage()
    ]);
    exit;
}

// Clear any output that might have been generated
ob_clean();

if (session_status() === PHP_SESSION_NONE) {
    startSession('customer');
}

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    ob_end_clean();
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'User not authenticated'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$orderId = $data['order_id'] ?? null;
$paymentMethod = $data['payment_method'] ?? null; // 'On-Site' or 'GCash'
$proofOfPayment = $data['proof_of_payment'] ?? null; // File path if GCash

// Debug logging
error_log("Process Payment - Order ID: " . $orderId);
error_log("Process Payment - Payment Method: " . $paymentMethod);
error_log("Process Payment - Proof of Payment: " . ($proofOfPayment ?? 'NULL'));

if (!$orderId || !$paymentMethod) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Order ID and payment method are required'
    ]);
    exit;
}

if (!in_array($paymentMethod, ['On-Site', 'GCash', 'Cash on Delivery'])) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid payment method. Must be "On-Site", "GCash", or "Cash on Delivery"'
    ]);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    $pdo->beginTransaction();
    
    // Get current order status and verify ownership
    $checkDeliveryCol = $pdo->query("SHOW COLUMNS FROM orders LIKE 'delivery_method'")->rowCount() > 0;
    $selectCols = "Order_ID, User_ID, status, payment, payment_method";
    if ($checkDeliveryCol) $selectCols .= ", delivery_method";
    $stmt = $pdo->prepare("SELECT {$selectCols} FROM orders WHERE Order_ID = :order_id");
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
    
    // Verify order belongs to logged-in user
    if ((int)$order['User_ID'] !== (int)$_SESSION['user_id']) {
        $pdo->rollBack();
        ob_end_clean();
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Access denied. This order does not belong to you.'
        ]);
        exit;
    }
    
    // Rejected orders cannot be paid
    if ($order['status'] === 'Rejected') {
        $pdo->rollBack();
        ob_end_clean();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'This order has been rejected and cannot be paid.'
        ]);
        exit;
    }
    
    // Check if this is a reupload (existing proof of payment in transactions table)
    $isReupload = false;
    if ($paymentMethod === 'GCash' && !empty($proofOfPayment)) {
        $checkStmt = $pdo->prepare("
            SELECT proof_of_payment 
            FROM transactions 
            WHERE Order_ID = :order_id AND proof_of_payment IS NOT NULL AND proof_of_payment != ''
        ");
        $checkStmt->execute(['order_id' => (int)$orderId]);
        $existingProof = $checkStmt->fetch(PDO::FETCH_ASSOC);
        $isReupload = ($existingProof && !empty($existingProof['proof_of_payment']));
    }
    
    // Determine payment status and order status based on payment method
    $isPickUpOrder = ($checkDeliveryCol && isset($order['delivery_method']) && trim($order['delivery_method']) === 'Pick Up');
    // ALL orders (Delivery & Pick Up) stay in Waiting Payment (Orders Placed) - admin clicks Prepare to move to Processing
    $newOrderStatus = 'Waiting Payment';
    $newPaymentStatus = (!empty($proofOfPayment) && $paymentMethod === 'GCash' && !$isReupload) ? 'Paid' : 'To Pay';
    
    // Update order with payment method and status
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET payment_method = :payment_method,
            status = :status,
            payment = :payment,
            last_updated = NOW()
        WHERE Order_ID = :order_id
    ");
    $stmt->execute([
        'payment_method' => $paymentMethod,
        'status' => $newOrderStatus,
        'payment' => $newPaymentStatus,
        'order_id' => (int)$orderId
    ]);
    
    // Update transaction with payment method and status
    $transactionPaymentStatus = ($newPaymentStatus === 'Paid') ? 'Paid' : 'Pending';
    $transactionPaymentMethod = $paymentMethod; // Store actual method: On-Site, Cash on Delivery, or GCash
    
    $proofOfPaymentValue = $proofOfPayment ?: null;
    $hasProofRejectedCol = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'proof_rejected'")->rowCount() > 0;
    $hasProofUpdatedAtCol = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'proof_updated_at'")->rowCount() > 0;
    // Set proof_updated_at only for re-upload after rejection (so "New proof uploaded" shows only then, not for first-time uploads)
    $isReuploadAfterRejection = false;
    if ($hasProofRejectedCol && $hasProofUpdatedAtCol && !empty($proofOfPaymentValue) && $paymentMethod === 'GCash') {
        $rx = $pdo->prepare("SELECT proof_rejected FROM transactions WHERE Order_ID = :order_id LIMIT 1");
        $rx->execute(['order_id' => (int)$orderId]);
        $row = $rx->fetch(PDO::FETCH_ASSOC);
        $rejectedVal = $row['proof_rejected'] ?? null;
        $isReuploadAfterRejection = ($row !== false && ($rejectedVal === 1 || $rejectedVal === '1' || (string)$rejectedVal === '1' || (int)$rejectedVal === 1));
    }
    $proofUpdatedAtSql = ($hasProofUpdatedAtCol && $isReuploadAfterRejection) ? ", proof_updated_at = NOW()" : "";
    $stmt = $pdo->prepare("
        UPDATE transactions 
        SET Payment_Method = :payment_method,
            Payment_Status = :payment_status,
            proof_of_payment = :proof_of_payment" .
            ($hasProofRejectedCol ? ", proof_rejected = 0" : "") .
            $proofUpdatedAtSql . ",
            Updated_At = NOW()
        WHERE Order_ID = :order_id
    ");
    
    // Debug logging before database update
    error_log("Updating transaction - Order ID: " . $orderId);
    error_log("Proof of Payment value: " . ($proofOfPaymentValue ?? 'NULL'));
    
    $stmt->execute([
        'payment_method' => $transactionPaymentMethod,
        'payment_status' => $transactionPaymentStatus,
        'proof_of_payment' => $proofOfPaymentValue,
        'order_id' => (int)$orderId
    ]);
    
    // Verify the update
    $verifyStmt = $pdo->prepare("SELECT proof_of_payment FROM transactions WHERE Order_ID = :order_id");
    $verifyStmt->execute(['order_id' => (int)$orderId]);
    $verifyResult = $verifyStmt->fetch(PDO::FETCH_ASSOC);
    error_log("Verified proof_of_payment in database: " . ($verifyResult['proof_of_payment'] ?? 'NULL'));
    
    // If payment is already paid (GCash with proof, first upload only), decrease stock
    // Hybrid: deduct from variation if Variation_ID set and variation has stock_level, else from product
    if ($newPaymentStatus === 'Paid' && $newOrderStatus === 'Processing' && !$isReupload) {
        $hasVariationId = $pdo->query("SHOW COLUMNS FROM transaction_items LIKE 'Variation_ID'")->rowCount() > 0;
        $cols = 'Product_ID, Quantity';
        if ($hasVariationId) $cols .= ', Variation_ID';
        $stmt = $pdo->prepare("SELECT {$cols} FROM transaction_items WHERE Order_ID = :order_id");
        $stmt->execute(['order_id' => (int)$orderId]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($items as $item) {
            $productId = $item['Product_ID'];
            $quantity = (int)$item['Quantity'];
            $variationId = ($hasVariationId && !empty($item['Variation_ID'])) ? (int)$item['Variation_ID'] : null;
            $deductFromVariation = false;
            if ($variationId) {
                $vStmt = $pdo->prepare("SELECT stock_level FROM product_variations WHERE Variation_ID = :vid");
                $vStmt->execute(['vid' => $variationId]);
                $var = $vStmt->fetch(PDO::FETCH_ASSOC);
                if ($var && $var['stock_level'] !== null && $var['stock_level'] !== '') {
                    $deductFromVariation = true;
                    $pdo->prepare("UPDATE product_variations SET stock_level = stock_level - :qty WHERE Variation_ID = :vid")
                        ->execute(['qty' => $quantity, 'vid' => $variationId]);
                }
            }
            if (!$deductFromVariation) {
                $stmt = $pdo->prepare("UPDATE products SET stock_level = stock_level - :quantity WHERE Product_ID = :product_id");
                $stmt->execute(['quantity' => $quantity, 'product_id' => $productId]);
                $stmt = $pdo->prepare("UPDATE products SET stock_status = CASE WHEN stock_level <= 0 THEN 'Out of Stock' WHEN stock_level <= Minimum_Stock THEN 'Low Stock' ELSE 'In Stock' END WHERE Product_ID = :product_id");
                $stmt->execute(['product_id' => $productId]);
            }
        }
    }
    
    $pdo->commit();
    
    // Create admin notification when customer uploads proof of payment
    if ($paymentMethod === 'GCash' && !empty($proofOfPaymentValue)) {
        try {
            require_once __DIR__ . '/create_admin_activity_notification.php';
            $customerStmt = $pdo->prepare("SELECT First_Name, Last_Name FROM users WHERE User_ID = :user_id");
            $customerStmt->execute(['user_id' => (int)$order['User_ID']]);
            $customer = $customerStmt->fetch(PDO::FETCH_ASSOC);
            $customerName = $customer ? trim(($customer['First_Name'] ?? '') . ' ' . ($customer['Last_Name'] ?? '')) : 'Customer';
            createAdminActivityNotification($pdo, 'proof_of_payment_updated', [
                'order_id' => $orderId,
                'user_id' => (int)$order['User_ID'],
                'customer_name' => $customerName,
                'message' => "Customer {$customerName} uploaded proof of payment for order #{$orderId}"
            ]);
        } catch (Exception $e) {
            error_log("Process Payment - Admin notification failed: " . $e->getMessage());
        }
    }
    
    // Clear output buffer and send JSON response
    ob_end_clean();
    echo json_encode([
        'success' => true,
        'message' => 'Payment method updated successfully' . ($newPaymentStatus === 'Paid' ? '. Payment confirmed!' : '.'),
        'order_id' => $orderId,
        'payment_method' => $paymentMethod,
        'payment_status' => $newPaymentStatus,
        'order_status' => $newOrderStatus
    ]);
    
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ob_end_clean();
    error_log("Process Payment Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to process payment: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ob_end_clean();
    error_log("Process Payment Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to process payment: ' . $e->getMessage()
    ]);
}
?>

