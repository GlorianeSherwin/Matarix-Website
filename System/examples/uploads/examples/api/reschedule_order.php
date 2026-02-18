<?php
/**
 * Reschedule Order API
 * Allows customers to reschedule a cancelled order by updating the delivery date
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
header('Access-Control-Allow-Methods: POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit;
}

// Close any existing session first
if (session_status() !== PHP_SESSION_NONE) {
    session_write_close();
}

// Set cookie parameters BEFORE session name (critical for cookie path)
require_once __DIR__ . '/../includes/path_helper.php';
session_set_cookie_params([
    'lifetime' => 0,
    'path' => getBasePath(),
    'domain' => '',
    'secure' => isSecure(),
    'httponly' => true,
    'samesite' => 'Lax'
]);

// Start customer session
session_name('MATARIX_CUSTOMER_SESSION');
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    ob_end_clean();
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'User not authenticated. Please log in again.'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$orderId = $data['order_id'] ?? null;
$availabilityDate = $data['availability_date'] ?? null;
$availabilityTime = $data['availability_time'] ?? null;

// Validate input
if (!$orderId) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Order ID is required'
    ]);
    exit;
}

if (!$availabilityDate) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Availability date is required'
    ]);
    exit;
}

// Validate date format (YYYY-MM-DD)
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $availabilityDate)) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid date format. Expected YYYY-MM-DD'
    ]);
    exit;
}

// Validate time format and business hours (7:00 AM - 6:00 PM)
if ($availabilityTime) {
    if (!preg_match('/^\d{2}:\d{2}:\d{2}$/', $availabilityTime)) {
        ob_end_clean();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid time format. Expected HH:MM:SS'
        ]);
        exit;
    }
    
    // Parse time
    $timeParts = explode(':', $availabilityTime);
    $hour = (int)$timeParts[0];
    
    // Validate business hours: 7:00 AM (07:00) to 6:00 PM (18:00)
    if ($hour < 7 || $hour >= 18) {
        ob_end_clean();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Delivery hours are 7:00 AM to 6:00 PM only. Please select a time within business hours.',
            'business_hours' => [
                'start' => '07:00:00',
                'end' => '18:00:00',
                'start_display' => '7:00 AM',
                'end_display' => '6:00 PM'
            ]
        ]);
        exit;
    }
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    $pdo->beginTransaction();
    
    $userId = $_SESSION['user_id'];
    
    // Verify order belongs to user and is cancelled
    $stmt = $pdo->prepare("
        SELECT o.Order_ID, o.status, o.User_ID, d.Delivery_ID
        FROM orders o
        LEFT JOIN deliveries d ON o.Order_ID = d.Order_ID
        WHERE o.Order_ID = :order_id AND o.User_ID = :user_id
    ");
    $stmt->execute([
        'order_id' => (int)$orderId,
        'user_id' => $userId
    ]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$order) {
        $pdo->rollBack();
        ob_end_clean();
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Order not found or you do not have permission to reschedule it'
        ]);
        exit;
    }
    
    // Check if order is cancelled (delivery status should be Cancelled)
    // We'll check the delivery status, but also allow rescheduling if order status is Cancelled
    $deliveryId = $order['Delivery_ID'] ?? null;
    $isCancelled = false;
    $rescheduleCount = 0;
    
    if ($deliveryId) {
        // Check if cancellation fields exist
        $checkColumns = $pdo->query("SHOW COLUMNS FROM deliveries LIKE 'reschedule_count'");
        $hasRescheduleFields = $checkColumns->rowCount() > 0;
        
        if ($hasRescheduleFields) {
            $stmt = $pdo->prepare("SELECT Delivery_Status, reschedule_count FROM deliveries WHERE Delivery_ID = :delivery_id");
        } else {
            $stmt = $pdo->prepare("SELECT Delivery_Status FROM deliveries WHERE Delivery_ID = :delivery_id");
        }
        $stmt->execute(['delivery_id' => $deliveryId]);
        $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($delivery && ($delivery['Delivery_Status'] === 'Cancelled' || $delivery['Delivery_Status'] === 'cancelled')) {
            $isCancelled = true;
            $rescheduleCount = isset($delivery['reschedule_count']) ? (int)$delivery['reschedule_count'] : 0;
        }
    }
    
    // Also check if order status indicates cancellation
    if ($order['status'] === 'Cancelled' || $order['status'] === 'cancelled') {
        $isCancelled = true;
    }
    
    if (!$isCancelled) {
        $pdo->rollBack();
        ob_end_clean();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'This order cannot be rescheduled. Only cancelled orders can be rescheduled.'
        ]);
        exit;
    }
    
    // Edge Case: Check reschedule limit (max 3 times)
    if ($rescheduleCount >= 3) {
        $pdo->rollBack();
        ob_end_clean();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Maximum reschedule limit reached (3 times). Please contact customer service for assistance.',
            'reschedule_count' => $rescheduleCount,
            'max_reschedules' => 3
        ]);
        exit;
    }
    
    // Update order availability_date and time
    $updateOrderSql = "
        UPDATE orders 
        SET availability_date = :availability_date,
            availability_time = :availability_time,
            status = 'Pending Approval',
            last_updated = NOW()
        WHERE Order_ID = :order_id
    ";
    $stmt = $pdo->prepare($updateOrderSql);
    $stmt->execute([
        'availability_date' => $availabilityDate,
        'availability_time' => $availabilityTime ?: null,
        'order_id' => (int)$orderId
    ]);
    
    // Update or create order_availability_slots entry
    // First, check if slots exist
    $stmt = $pdo->prepare("SELECT slot_number FROM order_availability_slots WHERE order_id = :order_id");
    $stmt->execute(['order_id' => (int)$orderId]);
    $existingSlots = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($existingSlots)) {
        // Create new slot entry
        $stmt = $pdo->prepare("
            INSERT INTO order_availability_slots (order_id, slot_number, availability_date, availability_time, is_preferred)
            VALUES (:order_id, 1, :availability_date, :availability_time, 1)
        ");
        $stmt->execute([
            'order_id' => (int)$orderId,
            'availability_date' => $availabilityDate,
            'availability_time' => $availabilityTime ?: null
        ]);
    } else {
        // Update existing preferred slot
        $stmt = $pdo->prepare("
            UPDATE order_availability_slots 
            SET availability_date = :availability_date,
                availability_time = :availability_time,
                is_preferred = 1
            WHERE order_id = :order_id AND slot_number = 1
        ");
        $stmt->execute([
            'availability_date' => $availabilityDate,
            'availability_time' => $availabilityTime ?: null,
            'order_id' => (int)$orderId
        ]);
        
        // Mark other slots as not preferred
        $stmt = $pdo->prepare("
            UPDATE order_availability_slots 
            SET is_preferred = 0
            WHERE order_id = :order_id AND slot_number != 1
        ");
        $stmt->execute(['order_id' => (int)$orderId]);
    }
    
    // Update delivery status from Cancelled to Pending and increment reschedule count
    if ($deliveryId) {
        // Check if reschedule fields exist
        $checkColumns = $pdo->query("SHOW COLUMNS FROM deliveries LIKE 'reschedule_count'");
        $hasRescheduleFields = $checkColumns->rowCount() > 0;
        
        if ($hasRescheduleFields) {
            $updateDeliverySql = "
                UPDATE deliveries 
                SET Delivery_Status = 'Pending',
                    reschedule_count = reschedule_count + 1,
                    last_rescheduled_at = NOW(),
                    Updated_At = NOW()
                WHERE Delivery_ID = :delivery_id
            ";
        } else {
            $updateDeliverySql = "
                UPDATE deliveries 
                SET Delivery_Status = 'Pending',
                    Updated_At = NOW()
                WHERE Delivery_ID = :delivery_id
            ";
        }
        $stmt = $pdo->prepare($updateDeliverySql);
        $stmt->execute(['delivery_id' => $deliveryId]);
    } else {
        // Create delivery record if it doesn't exist
        $stmt = $pdo->prepare("
            INSERT INTO deliveries (Order_ID, Delivery_Status, Created_At, Updated_At)
            VALUES (:order_id, 'Pending', NOW(), NOW())
        ");
        $stmt->execute(['order_id' => (int)$orderId]);
    }
    
    $pdo->commit();
    
    ob_end_clean();
    echo json_encode([
        'success' => true,
        'message' => 'Order rescheduled successfully. The order is now pending approval again.',
        'order_id' => $orderId,
        'availability_date' => $availabilityDate,
        'availability_time' => $availabilityTime,
        'reschedule_count' => $rescheduleCount + 1
    ]);
    exit;
    
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ob_end_clean();
    error_log("Reschedule Order Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to reschedule order. Please try again.'
    ]);
    exit;
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ob_end_clean();
    error_log("Reschedule Order Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to reschedule order. Please try again.'
    ]);
    exit;
}
?>

