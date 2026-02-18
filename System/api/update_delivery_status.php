<?php
/**
 * Update Delivery Status API
 * Allows delivery drivers to update delivery status
 * Supports statuses: 'preparing', 'out for delivery', 'delivered'
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
header('Access-Control-Allow-Methods: POST, PUT');
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

// Always start admin session (startSession handles switching if wrong session is active)
startSession('admin');

// RBAC: delivery status updates (Delivery Driver + Store Employee + Admin)
rbac_require_permission_api('deliveries.update_status');
// Cache role for downstream checks
$userRole = $_SESSION['user_role'] ?? '';

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$deliveryId = $data['delivery_id'] ?? null;
$orderId = $data['order_id'] ?? null;
$status = $data['status'] ?? null;
$deliveryDetails = $data['delivery_details'] ?? null;
$deliveryProofImage = isset($data['delivery_proof_image']) && !empty(trim($data['delivery_proof_image'])) ? trim($data['delivery_proof_image']) : null;
// Allow explicit driver_id in request, otherwise use session user_id (for delivery drivers)
$driverId = isset($data['driver_id']) && !empty($data['driver_id']) ? (int)$data['driver_id'] : $_SESSION['user_id'];

// Validate input
if (!$status) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Status is required'
    ]);
    exit;
}

// Normalize status value (handle case variations)
$status = trim($status);
$statusLower = strtolower($status);

// Map user-friendly statuses to standardized database values
// Standardized statuses: Pending, Preparing, Out for Delivery, Delivered, Cancelled
$statusMap = [
    'preparing' => 'Preparing',
    'out for delivery' => 'Out for Delivery',
    'on the way' => 'Out for Delivery', // Consolidate "On the Way" into "Out for Delivery"
    'delivered' => 'Delivered',
    'pending' => 'Pending',
    'cancelled' => 'Cancelled'
];

// Check if status is valid (either direct match or mapped)
$validStatuses = ['Pending', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];
$mappedStatus = $statusMap[$statusLower] ?? $status;

// Log the status mapping for debugging
error_log("Update Delivery Status - Input status: '{$status}', Lowercase: '{$statusLower}', Mapped: '{$mappedStatus}'");

if (!in_array($mappedStatus, $validStatuses)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => "Invalid status: '{$status}'. Must be one of: " . implode(', ', $validStatuses),
        'received_status' => $status,
        'mapped_status' => $mappedStatus,
        'valid_statuses' => $validStatuses
    ]);
    exit;
}

// Use the mapped/normalized status
$status = $mappedStatus;
error_log("Update Delivery Status - Using normalized status: '{$status}'");

// Delivery Driver: cannot cancel deliveries (status flow is controlled by staff)
if ($userRole === 'Delivery Driver' && $status === 'Cancelled') {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Access Denied: This action is not available for your role',
        'details' => 'Delivery drivers cannot cancel deliveries.'
    ]);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    $pdo->beginTransaction();
    
    // Check if order is approved (not pending approval or rejected)
    if ($orderId) {
        // Use same logic as get_customer_orders.php for consistency
        // If status is NULL or empty string, treat it as 'Pending Approval' (default)
        $stmt = $pdo->prepare("SELECT COALESCE(NULLIF(TRIM(status), ''), 'Pending Approval') as status FROM orders WHERE Order_ID = :order_id");
        $stmt->execute(['order_id' => (int)$orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($order) {
            $orderStatus = isset($order['status']) ? trim($order['status']) : 'Pending Approval';
            
            // Check if order is in 'Pending Approval' status (case-insensitive comparison)
            if (strcasecmp($orderStatus, 'Pending Approval') === 0) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Cannot update delivery status. Order must be approved first.',
                    'current_order_status' => $orderStatus
                ]);
                exit;
            }
            
            // Check if order is rejected (case-insensitive comparison)
            if (strcasecmp($orderStatus, 'Rejected') === 0) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Cannot update delivery status. Order has been rejected.',
                    'current_order_status' => $orderStatus
                ]);
                exit;
            }
        } else {
            // Order not found
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Order not found. Cannot update delivery status.'
            ]);
            exit;
        }
    }
    
    // If delivery_id is provided, use it; otherwise find by order_id
    if ($deliveryId) {
        $stmt = $pdo->prepare("
            SELECT Delivery_ID, Order_ID, Delivery_Status, Driver_ID
            FROM deliveries 
            WHERE Delivery_ID = :delivery_id
        ");
        $stmt->execute(['delivery_id' => $deliveryId]);
        $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$delivery) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Delivery not found'
            ]);
            $pdo->rollBack();
            exit;
        }
        
        $targetDeliveryId = $deliveryId;
        $targetOrderId = $delivery['Order_ID'];
        $currentDeliveryStatus = $delivery['Delivery_Status'] ?? 'Pending';
        $assignedDriverId = $delivery['Driver_ID'] ?? null;
    } elseif ($orderId) {
        // Find delivery by order_id
        $stmt = $pdo->prepare("
            SELECT Delivery_ID, Driver_ID, Delivery_Status
            FROM deliveries 
            WHERE Order_ID = :order_id
            ORDER BY Created_At DESC
            LIMIT 1
        ");
        $stmt->execute(['order_id' => $orderId]);
        $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$delivery) {
            // Delivery Driver must not create deliveries
            if ($userRole === 'Delivery Driver') {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Delivery not found or not assigned to you.'
                ]);
                exit;
            }

            // Create delivery record if it doesn't exist (staff only)
            // Only set Driver_ID if explicitly provided (for admin/employee assignment)
            // Otherwise leave it NULL for later assignment
            if (!empty($driverId) && isset($data['driver_id'])) {
                $stmt = $pdo->prepare("
                    INSERT INTO deliveries (Order_ID, Delivery_Status, Driver_ID, Created_At, Updated_At)
                    VALUES (:order_id, :status, :driver_id, NOW(), NOW())
                ");
                $stmt->execute([
                    'order_id' => $orderId,
                    'status' => $status,
                    'driver_id' => $driverId
                ]);
            } else {
                $stmt = $pdo->prepare("
                    INSERT INTO deliveries (Order_ID, Delivery_Status, Created_At, Updated_At)
                    VALUES (:order_id, :status, NOW(), NOW())
                ");
                $stmt->execute([
                    'order_id' => $orderId,
                    'status' => $status
                ]);
            }
            $targetDeliveryId = $pdo->lastInsertId();
            $targetOrderId = $orderId;
            $currentDeliveryStatus = 'Pending'; // New delivery starts at Pending
            // Use driver_id from request if provided, otherwise use session user_id
            $assignedDriverId = isset($data['driver_id']) && !empty($data['driver_id']) ? (int)$data['driver_id'] : $driverId;
        } else {
            $targetDeliveryId = $delivery['Delivery_ID'];
            $targetOrderId = $orderId;
            $currentDeliveryStatus = $delivery['Delivery_Status'] ?? 'Pending';
            $assignedDriverId = $delivery['Driver_ID'] ?? null;
        }
    } else {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Either delivery_id or order_id is required'
        ]);
        $pdo->rollBack();
        exit;
    }

    // Normalize current status (handle legacy values)
    $normalizeCurrent = function($s) {
        if ($s === null) return 'Pending';
        $t = strtolower(trim((string)$s));
        if ($t === '' || $t === 'pending') return 'Pending';
        if ($t === 'preparing') return 'Preparing';
        if ($t === 'out for delivery' || $t === 'on the way') return 'Out for Delivery';
        if ($t === 'delivered') return 'Delivered';
        if ($t === 'cancelled' || $t === 'canceled') return 'Cancelled';
        return trim((string)$s);
    };
    $currentDeliveryStatus = $normalizeCurrent($currentDeliveryStatus);

    // Delivery Driver restriction: can only update deliveries assigned to them
    if ($userRole === 'Delivery Driver') {
        $isAssignedToDriver = (!empty($assignedDriverId) && (int)$assignedDriverId === (int)$driverId);

        if (!$isAssignedToDriver) {
            // Also allow assignment via multi-driver junction table, if present
            try {
                $checkJunction = $pdo->query("SHOW TABLES LIKE 'delivery_drivers'");
                if ($checkJunction->rowCount() > 0) {
                    $jStmt = $pdo->prepare("SELECT 1 FROM delivery_drivers WHERE Delivery_ID = :delivery_id AND Driver_ID = :driver_id LIMIT 1");
                    $jStmt->execute([
                        'delivery_id' => (int)$targetDeliveryId,
                        'driver_id' => (int)$driverId
                    ]);
                    $isAssignedToDriver = (bool)$jStmt->fetchColumn();
                }
            } catch (Throwable $e) {
                // ignore
            }
        }

        if (!$isAssignedToDriver) {
            $pdo->rollBack();
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access Denied: This action is not available for your role',
                'details' => 'You can only update deliveries assigned to you.'
            ]);
            exit;
        }
    }
    
    // Validate status progression - step-by-step only (no skipping, no going backward)
    // Final statuses cannot be changed
    $finalStatuses = ['Delivered', 'Cancelled'];
    $currentStatusNormalized = trim($currentDeliveryStatus);
    
    // Check if current status is final
    if (in_array($currentStatusNormalized, $finalStatuses)) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => "Cannot update delivery status. Delivery is already {$currentStatusNormalized}. Final statuses cannot be changed.",
            'current_status' => $currentStatusNormalized,
            'attempted_status' => $status
        ]);
        exit;
    }
    
    $statusOrder = ['Pending', 'Preparing', 'Out for Delivery', 'Delivered'];
    $nextMap = [
        'Pending' => 'Preparing',
        'Preparing' => 'Out for Delivery',
        'Out for Delivery' => 'Delivered'
    ];
    
    // Allow same status (no-op change)
    if ($status === $currentStatusNormalized) {
        // Allowed
    } elseif ($status === 'Cancelled') {
        // Allowed for staff (driver was blocked earlier)
    } else {
        $expectedNext = $nextMap[$currentStatusNormalized] ?? null;
        if ($expectedNext === null || $status !== $expectedNext) {
            $allowedStatuses = [];
            if ($expectedNext !== null) $allowedStatuses[] = $expectedNext;
            $allowedStatuses[] = 'Cancelled';

            $pdo->rollBack();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => "Invalid status change. Cannot change from '{$currentStatusNormalized}' to '{$status}'. Status must move step-by-step. Valid statuses: " . implode(', ', $allowedStatuses),
                'current_status' => $currentStatusNormalized,
                'attempted_status' => $status,
                'allowed_statuses' => $allowedStatuses
            ]);
            exit;
        }
    }
    
    // Block "Out for Delivery" if delivery date is not yet reached
    if ($status === 'Out for Delivery') {
        $scheduledDate = null;
        $hasAvailabilityDate = $pdo->query("SHOW COLUMNS FROM orders LIKE 'availability_date'")->rowCount() > 0;
        if ($hasAvailabilityDate) {
            $oStmt = $pdo->prepare("SELECT availability_date FROM orders WHERE Order_ID = :order_id");
            $oStmt->execute(['order_id' => (int)$targetOrderId]);
            $row = $oStmt->fetch(PDO::FETCH_ASSOC);
            $scheduledDate = $row['availability_date'] ?? null;
        }
        if (!$scheduledDate) {
            $slotStmt = $pdo->prepare("SELECT availability_date FROM order_availability_slots WHERE order_id = :order_id AND is_preferred = 1 LIMIT 1");
            $slotStmt->execute(['order_id' => (int)$targetOrderId]);
            $slot = $slotStmt->fetch(PDO::FETCH_ASSOC);
            $scheduledDate = $slot['availability_date'] ?? null;
        }
        if ($scheduledDate) {
            $scheduledDateOnly = date('Y-m-d', strtotime($scheduledDate));
            $today = date('Y-m-d');
            if ($scheduledDateOnly > $today) {
                $pdo->rollBack();
                $formatted = date('M j, Y', strtotime($scheduledDate));
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => "Cannot set delivery to Out for Delivery. Delivery date has not been reached. Scheduled date: {$formatted}.",
                    'scheduled_date' => $scheduledDateOnly
                ]);
                exit;
            }
        }
    }
    
    // Update delivery status
    $updateFields = ['Delivery_Status = :status', 'Updated_At = NOW()'];
    $updateParams = ['status' => $status, 'delivery_id' => $targetDeliveryId];
    
    // Update driver if explicitly provided in request (for admin/employee assignment)
    // Otherwise, only update if not already set (for delivery drivers using their own ID)
    if (isset($data['driver_id']) && !empty($data['driver_id'])) {
        // Explicit driver assignment - always update
        $updateFields[] = 'Driver_ID = :driver_id';
        $updateParams['driver_id'] = (int)$data['driver_id'];
    } else {
        // No explicit driver_id in request - only set if not already assigned (for delivery drivers)
        $updateFields[] = 'Driver_ID = COALESCE(Driver_ID, :driver_id)';
        $updateParams['driver_id'] = $driverId;
    }
    
    // Update delivery details if provided (merge delivery_proof_image when status is Delivered)
    if ($deliveryProofImage !== null && $status === 'Delivered') {
        $detailsObj = [];
        if ($deliveryDetails !== null) {
            $decoded = is_string($deliveryDetails) ? json_decode($deliveryDetails, true) : $deliveryDetails;
            if (is_array($decoded)) {
                $detailsObj = $decoded;
            }
        }
        $detailsObj['proof_image'] = $deliveryProofImage;
        $deliveryDetails = json_encode($detailsObj);
    }
    if ($deliveryDetails !== null) {
        $updateFields[] = 'delivery_details = :delivery_details';
        $updateParams['delivery_details'] = $deliveryDetails;
    }
    
    $sql = "UPDATE deliveries SET " . implode(', ', $updateFields) . " WHERE Delivery_ID = :delivery_id";
    $stmt = $pdo->prepare($sql);
    
    try {
        $result = $stmt->execute($updateParams);
    } catch (PDOException $e) {
        // Check if it's an enum value error
        $errorCode = $e->getCode();
        $errorMessage = $e->getMessage();
        
        // MySQL error 1265: Data truncated for column (enum value doesn't exist)
        // MySQL error 1366: Incorrect string value (enum value doesn't exist)
        if ($errorCode == 1265 || $errorCode == 1366 || strpos($errorMessage, 'enum') !== false || strpos($errorMessage, 'ENUM') !== false) {
            error_log("Update Delivery Status - Enum Error: Status '{$status}' is not in the database enum. Error: {$errorMessage}");
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => "Status '{$status}' is not valid in the database. Please run the fix script: http://localhost/MatarixWEB/api/fix_delivery_status_enum.php",
                'error_code' => $errorCode,
                'error_message' => $errorMessage,
                'attempted_status' => $status,
                'fix_url' => 'http://localhost/MatarixWEB/api/fix_delivery_status_enum.php'
            ]);
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            exit;
        }
        throw $e; // Re-throw if it's not an enum error
    }
    
    // Check if update was successful
    if (!$result) {
        $errorInfo = $stmt->errorInfo();
        error_log("Update Delivery Status - SQL Error: " . json_encode($errorInfo));
        
        // Check for enum-related errors in errorInfo
        if (isset($errorInfo[2]) && (strpos($errorInfo[2], 'enum') !== false || strpos($errorInfo[2], 'ENUM') !== false)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => "Status '{$status}' is not valid in the database. Please run the fix script: http://localhost/MatarixWEB/api/fix_delivery_status_enum.php",
                'error_info' => $errorInfo,
                'attempted_status' => $status,
                'fix_url' => 'http://localhost/MatarixWEB/api/fix_delivery_status_enum.php'
            ]);
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            exit;
        }
        
        throw new PDOException("Failed to update delivery status: " . ($errorInfo[2] ?? 'Unknown error'));
    }
    
    // Verify the update actually changed a row
    $rowsAffected = $stmt->rowCount();
    if ($rowsAffected === 0) {
        error_log("Update Delivery Status - No rows affected for Delivery_ID: {$targetDeliveryId}");
        // This might be okay if the status is already the same, but log it
    }
    
    error_log("Update Delivery Status - Updated Delivery_ID: {$targetDeliveryId} to status: {$status} (rows affected: {$rowsAffected})");
    
    // Best-effort: keep order status in sync, but NEVER block delivery updates if the orders schema/enum differs.
    try {
        $orderStatusMap = [
            'Preparing' => 'Processing',
            'Out for Delivery' => 'Ready',
            // Many deployments treat "Ready" as the final/complete state.
            'Delivered' => 'Ready'
        ];

        if (isset($orderStatusMap[$status])) {
            $hasLastUpdated = false;
            try {
                $hasLastUpdated = $pdo->query("SHOW COLUMNS FROM orders LIKE 'last_updated'")->rowCount() > 0;
            } catch (Throwable $e) {
                $hasLastUpdated = false;
            }

            if ($hasLastUpdated) {
                $stmt = $pdo->prepare("
                    UPDATE orders 
                    SET status = :status, last_updated = NOW()
                    WHERE Order_ID = :order_id
                ");
            } else {
                $stmt = $pdo->prepare("
                    UPDATE orders 
                    SET status = :status
                    WHERE Order_ID = :order_id
                ");
            }

            $stmt->execute([
                'status' => $orderStatusMap[$status],
                'order_id' => $targetOrderId
            ]);
        }
    } catch (Throwable $e) {
        error_log("Update Delivery Status - Skipping order status sync: " . $e->getMessage());
    }
    
    $pdo->commit();
    
    // Fetch updated delivery record to verify the update
    $stmt = $pdo->prepare("
        SELECT 
            Delivery_ID,
            Order_ID,
            Delivery_Status,
            delivery_details,
            Driver_ID,
            Created_At,
            Updated_At
        FROM deliveries
        WHERE Delivery_ID = :delivery_id
    ");
    $stmt->execute(['delivery_id' => $targetDeliveryId]);
    $updatedDelivery = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$updatedDelivery) {
        error_log("Update Delivery Status - Failed to fetch updated delivery record for Delivery_ID: {$targetDeliveryId}");
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Status updated but failed to verify the update'
        ]);
        exit;
    }
    
    // Log the actual saved status
    error_log("Update Delivery Status - Verified update. Delivery_ID: {$targetDeliveryId}, Saved Status: {$updatedDelivery['Delivery_Status']}");
    
    // Get customer info for notifications
    $orderId = $updatedDelivery['Order_ID'] ?? $targetOrderId;
    $customerStmt = $pdo->prepare("
        SELECT u.User_ID, u.email, u.First_Name, u.Middle_Name, u.Last_Name
        FROM orders o 
        JOIN users u ON o.User_ID = u.User_ID 
        WHERE o.Order_ID = :order_id
    ");
    $customerStmt->execute(['order_id' => (int)$orderId]);
    $customer = $customerStmt->fetch(PDO::FETCH_ASSOC);
    $customerUserId = $customer['User_ID'] ?? null;
    $customerEmail = $customer['email'] ?? null;
    $customerName = trim(($customer['First_Name'] ?? '') . ' ' . ($customer['Middle_Name'] ?? '') . ' ' . ($customer['Last_Name'] ?? ''));
    
    // Create admin notification for delivery status change
    require_once __DIR__ . '/create_admin_activity_notification.php';
    $activityType = $status === 'Delivered' ? 'delivery_completed' : 'delivery_status_changed';
    createAdminActivityNotification($pdo, $activityType, [
        'order_id' => $orderId,
        'message' => "Delivery status changed to {$status} for order #{$orderId}"
    ]);
    
    // Create customer notification for delivery status change
    if ($customerUserId) {
        require_once __DIR__ . '/create_customer_notification.php';
        $customerActivityType = $status === 'Delivered' ? 'delivery_completed' : 'delivery_status_changed';
        $customerMessage = $status === 'Delivered' 
            ? "Your order #{$orderId} has been delivered successfully!" 
            : "Your delivery for order #{$orderId} status has been updated to {$status}";
        
        createCustomerNotification($pdo, $customerUserId, $customerActivityType, [
            'order_id' => (int)$orderId,
            'new_status' => $status,
            'message' => $customerMessage
        ]);
        
        // Send SMS notification for status changes: Preparing, Out for Delivery, Delivered
        if (in_array($status, ['Preparing', 'Out for Delivery', 'Delivered'])) {
            try {
                require_once __DIR__ . '/../includes/SemaphoreSMS.php';
                $semaphoreSMS = new SemaphoreSMS($pdo);
                $smsResult = $semaphoreSMS->sendOrderStatusNotification((int)$orderId, $status);
                
                if ($smsResult['success']) {
                    error_log("SMS notification sent successfully for order #{$orderId} - Status: {$status}");
                } else {
                    error_log("SMS notification failed for order #{$orderId} - Status: {$status} - " . $smsResult['message']);
                    // Don't fail the whole operation if SMS fails
                }
            } catch (Exception $e) {
                error_log("SMS notification exception for order #{$orderId} - Status: {$status} - " . $e->getMessage());
                // Don't fail the whole operation if SMS fails
            }
        }
    }

    // Send email notification when delivery is "Out for Delivery" (in transit)
    if ($status === 'Out for Delivery' && $customerEmail) {
        try {
            $emailSender = new EmailSender();
            $trackingLink = matarix_base_url() . '/Customer/delivery-tracking.html?order_id=' . (int)$orderId;
            $emailSender->sendOrderInTransitEmail($customerEmail, (int)$orderId, $trackingLink, $customerName);
        } catch (Exception $e) {
            error_log("Email notification exception for delivery in transit: " . $e->getMessage());
            // Don't fail the whole operation if email fails
        }
    }
    
    // Send email notification when delivery is "Delivered"
    if ($status === 'Delivered' && $customerEmail) {
        try {
            $emailSender = new EmailSender();
            $orderLink = matarix_base_url() . '/Customer/receipt.html?order_id=' . (int)$orderId;
            $emailSender->sendDeliveryCompletedEmail($customerEmail, (int)$orderId, $orderLink, $customerName);
        } catch (Exception $e) {
            error_log("Email notification exception for delivery completed: " . $e->getMessage());
            // Don't fail the whole operation if email fails
        }
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Delivery status updated successfully',
        'delivery' => $updatedDelivery,
        'delivery_id' => (int)$targetDeliveryId, // Include delivery_id for vehicle assignment
        'saved_status' => $updatedDelivery['Delivery_Status'] // Include the actual saved status
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Update Delivery Status Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update delivery status: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Update Delivery Status Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update delivery status: ' . $e->getMessage()
    ]);
}
?>

