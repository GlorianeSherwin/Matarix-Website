<?php
/**
 * Get Delivery by Order ID API
 * Returns delivery information for a specific order
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: order management view (Store Employee + Admin) or deliveries.view_assigned (Delivery Driver for assigned orders)
$userRole = trim((string)($_SESSION['user_role'] ?? ''));
$userId = $_SESSION['user_id'] ?? null;
$isDriver = ($userRole === 'Delivery Driver');

try {
    if ($isDriver) {
        rbac_require_permission_api('deliveries.view_assigned');
    } else {
        rbac_require_permission_api('orders.view');
    }
} catch (Throwable $e) {
    error_log("RBAC check error in get_delivery_by_order.php: " . $e->getMessage());
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Permission check failed']);
    exit;
}

// Get order_id from query parameter
$orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;

if (!$orderId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Order ID is required'
    ]);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    // Delivery Driver: verify the order is assigned to them before returning delivery info
    if ($isDriver && $userId) {
        $hasDeliveryDriversJunction = false;
        try {
            $checkJunctionStmt = $pdo->query("SHOW TABLES LIKE 'delivery_drivers'");
            $hasDeliveryDriversJunction = $checkJunctionStmt->rowCount() > 0;
        } catch (Throwable $e) {
            $hasDeliveryDriversJunction = false;
        }
        $driverCheckSql = "
            SELECT COUNT(*) as count
            FROM deliveries d
            WHERE d.Order_ID = :order_id
            AND (
                d.Driver_ID = :driver_id_main
                " . ($hasDeliveryDriversJunction ? "
                OR EXISTS (
                    SELECT 1 FROM delivery_drivers dd
                    WHERE dd.Delivery_ID = d.Delivery_ID AND dd.Driver_ID = :driver_id_junction
                )" : "") . "
            )
        ";
        $driverCheckStmt = $pdo->prepare($driverCheckSql);
        if ($hasDeliveryDriversJunction) {
            $driverCheckStmt->execute([
                'order_id' => $orderId,
                'driver_id_main' => (int)$userId,
                'driver_id_junction' => (int)$userId
            ]);
        } else {
            $driverCheckStmt->execute([
                'order_id' => $orderId,
                'driver_id_main' => (int)$userId
            ]);
        }
        $driverCheckResult = $driverCheckStmt->fetch(PDO::FETCH_ASSOC);
        if (!$driverCheckResult || (int)$driverCheckResult['count'] === 0) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access Denied: This order is not assigned to you.'
            ]);
            exit;
        }
    }
    
    // Get delivery information for the order
    $stmt = $pdo->prepare("
        SELECT 
            d.Delivery_ID,
            d.Order_ID,
            d.Delivery_Status,
            d.delivery_details,
            d.Driver_ID,
            d.Vehicle_ID,
            d.Created_At,
            d.Updated_At
        FROM deliveries d
        WHERE d.Order_ID = :order_id
        ORDER BY d.Created_At DESC
        LIMIT 1
    ");
    
    $stmt->execute(['order_id' => $orderId]);
    $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($delivery) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'delivery' => [
                'Delivery_ID' => (int)$delivery['Delivery_ID'],
                'Order_ID' => (int)$delivery['Order_ID'],
                'Delivery_Status' => $delivery['Delivery_Status'] ?? 'Pending',
                'delivery_details' => $delivery['delivery_details'] ?? null,
                'Driver_ID' => $delivery['Driver_ID'] ? (int)$delivery['Driver_ID'] : null,
                'Vehicle_ID' => $delivery['Vehicle_ID'] ? (int)$delivery['Vehicle_ID'] : null,
                'Created_At' => $delivery['Created_At'] ?? null,
                'Updated_At' => $delivery['Updated_At'] ?? null
            ]
        ]);
    } else {
        // No delivery record exists yet
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'delivery' => null,
            'message' => 'No delivery record found for this order'
        ]);
    }
    
} catch (Exception $e) {
    error_log("Get Delivery by Order API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching delivery information: ' . $e->getMessage()
    ]);
}
?>
