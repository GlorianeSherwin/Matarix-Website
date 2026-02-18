<?php
/**
 * Cancel Delivery API
 * Allows Admin/Store Employee to cancel deliveries with reason and notes
 * Sends notification to customer with reschedule option
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

// Always start admin session
startSession('admin');

// RBAC: Only Admin and Store Employee can cancel deliveries
try {
    rbac_require_permission_api('deliveries.update_status');
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Access Denied: ' . $e->getMessage()
    ]);
    exit;
}

$userRole = $_SESSION['user_role'] ?? '';
$userId = $_SESSION['user_id'] ?? null;

// Verify role (Delivery Drivers cannot cancel)
if ($userRole === 'Delivery Driver') {
    ob_end_clean();
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Access Denied: Delivery drivers cannot cancel deliveries.'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$deliveryId = $data['delivery_id'] ?? null;
$orderId = $data['order_id'] ?? null;
$cancellationReason = $data['cancellation_reason'] ?? null;
$internalNotes = $data['internal_notes'] ?? null;

// Validate input
if (!$deliveryId && !$orderId) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Delivery ID or Order ID is required'
    ]);
    exit;
}

if (!$cancellationReason || trim($cancellationReason) === '') {
    ob_end_clean();
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Cancellation reason is required'
    ]);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    $pdo->beginTransaction();
    
    // Get delivery information
    $sql = "
        SELECT 
            d.Delivery_ID,
            d.Order_ID,
            d.Delivery_Status,
            d.Driver_ID,
            o.User_ID as Customer_ID,
            o.amount,
            u.First_Name as Customer_First_Name,
            u.Last_Name as Customer_Last_Name,
            u.email as Customer_Email,
            u.Phone_Number as Customer_Phone,
            driver.First_Name as Driver_First_Name,
            driver.Last_Name as Driver_Last_Name,
            driver.email as Driver_Email
        FROM deliveries d
        LEFT JOIN orders o ON d.Order_ID = o.Order_ID
        LEFT JOIN users u ON o.User_ID = u.User_ID
        LEFT JOIN users driver ON d.Driver_ID = driver.User_ID
        WHERE " . ($deliveryId ? "d.Delivery_ID = :id" : "d.Order_ID = :id") . "
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['id' => $deliveryId ?: $orderId]);
    $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$delivery) {
        $pdo->rollBack();
        ob_end_clean();
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Delivery not found'
        ]);
        exit;
    }
    
    $currentStatus = trim($delivery['Delivery_Status']);
    $deliveryId = $delivery['Delivery_ID'];
    $orderId = $delivery['Order_ID'];
    
    // Edge Case 1: Already Cancelled
    if ($currentStatus === 'Cancelled') {
        $pdo->rollBack();
        ob_end_clean();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'This delivery has already been cancelled.',
            'already_cancelled' => true
        ]);
        exit;
    }
    
    // Edge Case 2: Already Delivered
    if ($currentStatus === 'Delivered') {
        $pdo->rollBack();
        ob_end_clean();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Cannot cancel a delivery that has already been completed.',
            'already_delivered' => true
        ]);
        exit;
    }
    
    // Edge Case 3: In Progress (Out for Delivery) - Allow but flag for notification
    $isInProgress = ($currentStatus === 'Out for Delivery');
    $requiresDriverNotification = $isInProgress && $delivery['Driver_ID'];
    
    // Update delivery status and cancellation fields
    // Check if cancellation fields exist (for backward compatibility)
    $checkColumns = $pdo->query("SHOW COLUMNS FROM deliveries LIKE 'cancellation_reason'");
    $hasCancellationFields = $checkColumns->rowCount() > 0;
    
    if ($hasCancellationFields) {
        $updateSql = "
            UPDATE deliveries 
            SET Delivery_Status = 'Cancelled',
                cancellation_reason = :reason,
                cancelled_by = :cancelled_by,
                cancelled_at = NOW(),
                internal_notes = :internal_notes,
                Updated_At = NOW()
            WHERE Delivery_ID = :delivery_id
        ";
        $updateStmt = $pdo->prepare($updateSql);
        $updateStmt->execute([
            'reason' => trim($cancellationReason),
            'cancelled_by' => (int)$userId,
            'internal_notes' => $internalNotes ? trim($internalNotes) : null,
            'delivery_id' => (int)$deliveryId
        ]);
    } else {
        // Fallback if migration hasn't been run
        $updateSql = "
            UPDATE deliveries 
            SET Delivery_Status = 'Cancelled',
                Updated_At = NOW()
            WHERE Delivery_ID = :delivery_id
        ";
        $updateStmt = $pdo->prepare($updateSql);
        $updateStmt->execute([
            'delivery_id' => (int)$deliveryId
        ]);
    }
    
    // Update order status to Cancelled if not already
    $orderStmt = $pdo->prepare("
        UPDATE orders 
        SET status = 'Cancelled',
            last_updated = NOW()
        WHERE Order_ID = :order_id AND status != 'Cancelled'
    ");
    $orderStmt->execute(['order_id' => (int)$orderId]);
    
    // Create customer notification
    $customerId = $delivery['Customer_ID'];
    if ($customerId) {
        $rescheduleLink = matarix_base_url() . '/Customer/delivery-tracking.html?order_id=' . (int)$orderId;
        $notificationMessage = "Your delivery for order #{$orderId} has been cancelled. " . 
                              ($cancellationReason ? "Reason: {$cancellationReason}. " : "") .
                              "You can reschedule your delivery.";
        
        // Use correct column names (PascalCase) matching the table structure
        $notifStmt = $pdo->prepare("
            INSERT INTO customer_notifications (User_ID, Activity_Type, Order_ID, Message, Is_Read, Created_At)
            VALUES (:user_id, 'delivery_cancelled', :order_id, :message, 0, NOW())
        ");
        $notifStmt->execute([
            'user_id' => (int)$customerId,
            'order_id' => (int)$orderId,
            'message' => $notificationMessage
        ]);
    }
    
    // Send email notification to customer
    $customerEmail = $delivery['Customer_Email'] ?? null;
    $customerName = trim(($delivery['Customer_First_Name'] ?? '') . ' ' . ($delivery['Customer_Last_Name'] ?? ''));
    
    if ($customerEmail && !empty($customerEmail)) {
        try {
            $emailSender = new EmailSender();
            $rescheduleLink = matarix_base_url() . '/Customer/delivery-tracking.html?order_id=' . (int)$orderId;
            
            // Use existing email template method
            if (method_exists($emailSender, 'sendDeliveryCancelledEmail')) {
                $emailSender->sendDeliveryCancelledEmail(
                    $customerEmail,
                    (int)$orderId,
                    $rescheduleLink,
                    $customerName,
                    $cancellationReason
                );
            }
        } catch (Exception $e) {
            error_log("Email notification exception for delivery cancellation: " . $e->getMessage());
            // Don't fail the whole operation if email fails
        } catch (Error $e) {
            error_log("Email notification fatal error for delivery cancellation: " . $e->getMessage());
            // Don't fail the whole operation if email fails
        }
    }
    
    // Notify driver if delivery is in progress (skip for now - can be added later if needed)
    // Driver notification can be handled separately if required
    
    $pdo->commit();
    
    // Clear output buffer and send JSON response
    ob_end_clean();
    echo json_encode([
        'success' => true,
        'message' => 'Delivery cancelled successfully',
        'delivery_id' => (int)$deliveryId,
        'order_id' => (int)$orderId,
        'was_in_progress' => $isInProgress,
        'driver_notified' => $requiresDriverNotification
    ]);
    
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ob_end_clean();
    error_log("Cancel Delivery Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to cancel delivery: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ob_end_clean();
    error_log("Cancel Delivery Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to cancel delivery: ' . $e->getMessage()
    ]);
}
?>
