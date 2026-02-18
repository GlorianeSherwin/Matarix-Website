<?php
/**
 * Test Delivery Status API
 * Helper endpoint to test and debug delivery status updates
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

$orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;

if (!$orderId) {
    echo json_encode([
        'error' => 'Order ID is required',
        'usage' => '?order_id=9'
    ]);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Get order info
    $stmt = $pdo->prepare("SELECT Order_ID, User_ID, status, payment FROM orders WHERE Order_ID = :order_id");
    $stmt->execute(['order_id' => $orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Get delivery info
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
        WHERE Order_ID = :order_id
        ORDER BY Created_At DESC
        LIMIT 1
    ");
    $stmt->execute(['order_id' => $orderId]);
    $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'order_id' => $orderId,
        'order_exists' => $order !== false,
        'order' => $order,
        'delivery_exists' => $delivery !== false,
        'delivery' => $delivery,
        'delivery_status' => $delivery ? $delivery['Delivery_Status'] : 'NO RECORD',
        'timestamp' => time()
    ], JSON_PRETTY_PRINT);
    
} catch (PDOException $e) {
    echo json_encode([
        'error' => $e->getMessage()
    ]);
}
?>

