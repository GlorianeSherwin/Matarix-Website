<?php
/**
 * Get Cancelled Deliveries API
 * Returns cancelled deliveries for the logged-in customer
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

// Close any existing session first
if (session_status() !== PHP_SESSION_NONE) {
    session_write_close();
}

// Set cookie parameters BEFORE session name
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
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'User not authenticated. Please log in again.'
    ]);
    exit;
}

$userId = $_SESSION['user_id'];

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Get cancelled deliveries for this customer
    $sql = "
        SELECT 
            d.Delivery_ID,
            d.Order_ID,
            d.Delivery_Status,
            d.cancellation_reason,
            d.cancelled_at,
            d.reschedule_count,
            d.last_rescheduled_at,
            o.amount,
            o.order_date,
            o.availability_date,
            o.availability_time,
            o.status as Order_Status,
            u.First_Name as Customer_First_Name,
            u.Last_Name as Customer_Last_Name,
            u.address as Customer_Address,
            u.Phone_Number as Customer_Phone
        FROM deliveries d
        INNER JOIN orders o ON d.Order_ID = o.Order_ID
        INNER JOIN users u ON o.User_ID = u.User_ID
        WHERE o.User_ID = :user_id
        AND d.Delivery_Status = 'Cancelled'
        ORDER BY d.cancelled_at DESC, d.Updated_At DESC
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['user_id' => (int)$userId]);
    $deliveries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get order items for each delivery
    foreach ($deliveries as &$delivery) {
        $orderId = $delivery['Order_ID'];
        
        // Get order items
        $itemsStmt = $pdo->prepare("
            SELECT 
                ti.Item_ID,
                ti.Product_ID,
                ti.Quantity,
                ti.Price,
                p.Product_Name,
                p.category
            FROM transaction_items ti
            JOIN products p ON ti.Product_ID = p.Product_ID
            WHERE ti.Order_ID = :order_id
        ");
        $itemsStmt->execute(['order_id' => $orderId]);
        $delivery['items'] = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get availability slots
        $slotStmt = $pdo->prepare("
            SELECT 
                slot_number,
                availability_date,
                availability_time,
                is_preferred
            FROM order_availability_slots
            WHERE order_id = :order_id
            ORDER BY slot_number
        ");
        $slotStmt->execute(['order_id' => $orderId]);
        $delivery['availability_slots'] = $slotStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format customer name
        $delivery['customer_name'] = trim(($delivery['Customer_First_Name'] ?? '') . ' ' . ($delivery['Customer_Last_Name'] ?? ''));
    }
    unset($delivery);
    
    echo json_encode([
        'success' => true,
        'deliveries' => $deliveries,
        'count' => count($deliveries)
    ]);
    
} catch (PDOException $e) {
    error_log("Get Cancelled Deliveries Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch cancelled deliveries: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Get Cancelled Deliveries Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch cancelled deliveries: ' . $e->getMessage()
    ]);
}
?>
