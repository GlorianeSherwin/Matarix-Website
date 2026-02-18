<?php
/**
 * Get Delivery Details for ViewDelivery page
 * Returns delivery + order + customer info for Complete/Cancel delivery actions
 * Supports both order_id and delivery_id query params
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
    error_log("RBAC check error in get_delivery_details.php: " . $e->getMessage());
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Permission check failed']);
    exit;
}

$orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;
$deliveryId = isset($_GET['delivery_id']) ? (int)$_GET['delivery_id'] : null;

if (!$orderId && !$deliveryId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'order_id or delivery_id is required'
    ]);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    // Build base query for delivery + order + customer
    $sql = "
        SELECT 
            d.Delivery_ID,
            d.Order_ID,
            d.Delivery_Status,
            d.delivery_details,
            d.Driver_ID,
            d.Vehicle_ID,
            d.Created_At,
            d.Updated_At,
            o.amount,
            o.status as Order_Status,
            o.order_date,
            o.availability_date,
            o.availability_time,
            u.First_Name as Customer_First_Name,
            u.Last_Name as Customer_Last_Name,
            u.address as Customer_Address,
            u.Phone_Number as Customer_Phone,
            u.email as Customer_Email,
            driver.First_Name as Driver_First_Name,
            driver.Last_Name as Driver_Last_Name,
            f.vehicle_model
        FROM deliveries d
        INNER JOIN orders o ON d.Order_ID = o.Order_ID
        LEFT JOIN users u ON o.User_ID = u.User_ID
        LEFT JOIN users driver ON d.Driver_ID = driver.User_ID
        LEFT JOIN fleet f ON d.Vehicle_ID = f.Vehicle_ID
        WHERE " . ($orderId ? "d.Order_ID = :order_id" : "d.Delivery_ID = :delivery_id") . "
        ORDER BY d.Created_At DESC
        LIMIT 1
    ";

    $stmt = $pdo->prepare($sql);
    if ($orderId) {
        $stmt->execute(['order_id' => $orderId]);
    } else {
        $stmt->execute(['delivery_id' => $deliveryId]);
    }
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Delivery not found'
        ]);
        exit;
    }

    // Delivery Driver: verify the order is assigned to them
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
            WHERE d.Delivery_ID = :delivery_id
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
                'delivery_id' => (int)$row['Delivery_ID'],
                'driver_id_main' => (int)$userId,
                'driver_id_junction' => (int)$userId
            ]);
        } else {
            $driverCheckStmt->execute([
                'delivery_id' => (int)$row['Delivery_ID'],
                'driver_id_main' => (int)$userId
            ]);
        }
        $driverCheckResult = $driverCheckStmt->fetch(PDO::FETCH_ASSOC);
        if (!$driverCheckResult || (int)$driverCheckResult['count'] === 0) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Access Denied: This delivery is not assigned to you.'
            ]);
            exit;
        }
    }

    // Format response
    $customerName = trim(($row['Customer_First_Name'] ?? '') . ' ' . ($row['Customer_Last_Name'] ?? ''));
    $driverName = trim(($row['Driver_First_Name'] ?? '') . ' ' . ($row['Driver_Last_Name'] ?? ''));

    $orderIdForItems = (int)$row['Order_ID'];
    $hasTiVariation = $pdo->query("SHOW COLUMNS FROM transaction_items LIKE 'variation'")->rowCount() > 0;
    $tiVarCol = $hasTiVariation ? 'ti.variation as item_variation,' : '';
    $itemsStmt = $pdo->prepare("
        SELECT 
            ti.Item_ID,
            ti.Product_ID,
            ti.Quantity,
            ti.Price,
            {$tiVarCol}
            COALESCE(p.Product_Name, CONCAT('Product (ID: ', ti.Product_ID, ')')) as Product_Name,
            p.image_path
        FROM transaction_items ti
        LEFT JOIN products p ON ti.Product_ID = p.Product_ID
        WHERE ti.Order_ID = :order_id
        ORDER BY ti.Item_ID
    ");
    $itemsStmt->execute(['order_id' => $orderIdForItems]);
    $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($items as &$it) {
        $it['Quantity'] = (int)($it['Quantity'] ?? 0);
        $it['Price'] = (float)($it['Price'] ?? 0);
        $it['line_total'] = $it['Quantity'] * $it['Price'];
        if (!empty($it['item_variation'])) {
            $it['variation'] = trim($it['item_variation']);
        } else {
            $it['variation'] = null;
        }
        unset($it['item_variation']);
    }
    unset($it);

    $delivery = [
        'Delivery_ID' => (int)$row['Delivery_ID'],
        'Order_ID' => (int)$row['Order_ID'],
        'Delivery_Status' => $row['Delivery_Status'] ?? 'Pending',
        'delivery_details' => $row['delivery_details'] ?? null,
        'Driver_ID' => $row['Driver_ID'] ? (int)$row['Driver_ID'] : null,
        'Vehicle_ID' => $row['Vehicle_ID'] ? (int)$row['Vehicle_ID'] : null,
        'Created_At' => $row['Created_At'] ?? null,
        'Updated_At' => $row['Updated_At'] ?? null,
        'amount' => $row['amount'] ?? 0,
        'Order_Status' => $row['Order_Status'] ?? 'Pending',
        'order_date' => $row['order_date'] ?? null,
        'availability_date' => $row['availability_date'] ?? null,
        'availability_time' => $row['availability_time'] ?? null,
        'customer_name' => $customerName ?: 'Customer',
        'address' => $row['Customer_Address'] ?? 'No address provided',
        'phone' => $row['Customer_Phone'] ?? null,
        'email' => $row['Customer_Email'] ?? null,
        'driver_name' => $driverName ?: 'Unassigned',
        'vehicle_model' => $row['vehicle_model'] ?? null,
        'items' => $items
    ];

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'delivery' => $delivery
    ]);

} catch (Exception $e) {
    error_log("Get Delivery Details API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to load delivery details: ' . $e->getMessage()
    ]);
}
