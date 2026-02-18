<?php
/**
 * Get Driver Deliveries API
 * Returns all deliveries assigned to the logged-in driver
 * Useful for delivery driver dashboard
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

// Always start admin session for driver APIs
startSession('admin');

$userRole = $_SESSION['user_role'] ?? '';
$userId = $_SESSION['user_id'];

// RBAC: drivers can view assigned deliveries only, staff can view all deliveries
if ($userRole === 'Delivery Driver') {
    rbac_require_permission_api('deliveries.view_assigned');
} else {
    rbac_require_permission_api('deliveries.view');
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Detect whether multi-driver junction table exists (for correct driver filtering)
    $hasDeliveryDriversJunction = false;
    try {
        $checkJunctionStmt = $pdo->query("SHOW TABLES LIKE 'delivery_drivers'");
        $hasDeliveryDriversJunction = $checkJunctionStmt->rowCount() > 0;
    } catch (Throwable $e) {
        $hasDeliveryDriversJunction = false;
    }

    // If admin or store employee, show all deliveries
    // If driver, show only their assigned deliveries
    if (in_array($userRole, ['Admin', 'Store Employee'])) {
        $sql = "
            SELECT 
                d.Delivery_ID,
                d.Order_ID,
                d.Delivery_Status,
                d.delivery_details,
                d.Driver_ID,
                d.Created_At,
                d.Updated_At,
                o.User_ID as Customer_ID,
                o.amount,
                o.status as Order_Status,
                u.First_Name as Customer_First_Name,
                u.Last_Name as Customer_Last_Name,
                u.address as Customer_Address,
                u.Phone_Number as Customer_Phone,
                driver.First_Name as Driver_First_Name,
                driver.Last_Name as Driver_Last_Name
            FROM deliveries d
            LEFT JOIN orders o ON d.Order_ID = o.Order_ID
            LEFT JOIN users u ON o.User_ID = u.User_ID
            LEFT JOIN users driver ON d.Driver_ID = driver.User_ID
            ORDER BY d.Created_At DESC
        ";
        $stmt = $pdo->query($sql);
    } else {
        // Driver view - only their deliveries
        $driverWhere = " (d.Driver_ID = :driver_id_main) ";
        if ($hasDeliveryDriversJunction) {
            $driverWhere = " (d.Driver_ID = :driver_id_main OR EXISTS (
                SELECT 1 FROM delivery_drivers dd
                WHERE dd.Delivery_ID = d.Delivery_ID AND dd.Driver_ID = :driver_id_junction
            )) ";
        }

        $sql = "
            SELECT 
                d.Delivery_ID,
                d.Order_ID,
                d.Delivery_Status,
                d.delivery_details,
                d.Driver_ID,
                d.Created_At,
                d.Updated_At,
                o.User_ID as Customer_ID,
                o.amount,
                o.status as Order_Status,
                u.First_Name as Customer_First_Name,
                u.Last_Name as Customer_Last_Name,
                u.address as Customer_Address,
                u.Phone_Number as Customer_Phone
            FROM deliveries d
            LEFT JOIN orders o ON d.Order_ID = o.Order_ID
            LEFT JOIN users u ON o.User_ID = u.User_ID
            WHERE {$driverWhere}
            ORDER BY d.Created_At DESC
        ";
        $stmt = $pdo->prepare($sql);
        if ($hasDeliveryDriversJunction) {
            $stmt->execute([
                'driver_id_main' => (int)$userId,
                'driver_id_junction' => (int)$userId
            ]);
        } else {
            $stmt->execute([
                'driver_id_main' => (int)$userId
            ]);
        }
    }
    
    $deliveries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'deliveries' => $deliveries,
        'count' => count($deliveries)
    ]);
    
} catch (PDOException $e) {
    error_log("Get Driver Deliveries Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch deliveries: ' . $e->getMessage()
    ]);
}
?>

