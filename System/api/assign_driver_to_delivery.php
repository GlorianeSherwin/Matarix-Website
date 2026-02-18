<?php
/**
 * Assign Driver to Delivery API
 * Assigns a driver to a specific delivery
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, PUT');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

// Always start admin session
startSession('admin');

// RBAC: delivery assignments (Store Employee + Admin)
rbac_require_permission_api('deliveries.assign');

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$deliveryId = $data['delivery_id'] ?? null;
$driverId = $data['driver_id'] ?? null; // Single driver (for backward compatibility)
$driverIds = $data['driver_ids'] ?? null; // Multiple drivers (new)

if (!$deliveryId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Delivery ID is required'
    ]);
    exit;
}

// Normalize to array: support both single driver_id and multiple driver_ids
$driverIdsArray = [];
if (isset($driverIds) && is_array($driverIds)) {
    $driverIdsArray = array_map('intval', array_filter($driverIds, function($id) {
        return $id !== null && $id > 0;
    }));
} elseif ($driverId !== null && $driverId > 0) {
    // Backward compatibility: single driver_id
    $driverIdsArray = [(int)$driverId];
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Start transaction
    $pdo->beginTransaction();
    
    // Verify delivery exists
    $stmt = $pdo->prepare("SELECT Delivery_ID, Order_ID FROM deliveries WHERE Delivery_ID = :delivery_id");
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
    
    // Verify all drivers exist and have correct role
    $validDriverIds = [];
    if (!empty($driverIdsArray)) {
        $placeholders = implode(',', array_fill(0, count($driverIdsArray), '?'));
        $stmt = $pdo->prepare("SELECT User_ID, First_Name, Last_Name FROM users WHERE User_ID IN ({$placeholders}) AND role = 'Delivery Driver'");
        $stmt->execute($driverIdsArray);
        $validDrivers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (count($validDrivers) !== count($driverIdsArray)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'One or more drivers not found or are not delivery drivers'
            ]);
            $pdo->rollBack();
            exit;
        }
        
        $validDriverIds = array_column($validDrivers, 'User_ID');
    }
    
    // Check if delivery_drivers table exists, if not use old method
    $junctionTableExists = false;
    try {
        $stmt = $pdo->query("SHOW TABLES LIKE 'delivery_drivers'");
        $junctionTableExists = $stmt->rowCount() > 0;
    } catch (Exception $e) {
        // Table doesn't exist, use old method
    }
    
    if ($junctionTableExists) {
        // Use junction table for multiple drivers
        // Remove all existing driver assignments for this delivery
        $stmt = $pdo->prepare("DELETE FROM delivery_drivers WHERE Delivery_ID = :delivery_id");
        $stmt->execute(['delivery_id' => $deliveryId]);
        
        // Insert new driver assignments
        if (!empty($validDriverIds)) {
            $stmt = $pdo->prepare("INSERT INTO delivery_drivers (Delivery_ID, Driver_ID) VALUES (:delivery_id, :driver_id)");
            foreach ($validDriverIds as $driverId) {
                $stmt->execute([
                    'delivery_id' => $deliveryId,
                    'driver_id' => $driverId
                ]);
            }
        }
        
        // Update main deliveries table with first driver (for backward compatibility)
        $firstDriverId = !empty($validDriverIds) ? $validDriverIds[0] : null;
        $stmt = $pdo->prepare("UPDATE deliveries SET Driver_ID = :driver_id WHERE Delivery_ID = :delivery_id");
        $stmt->execute([
            'driver_id' => $firstDriverId,
            'delivery_id' => $deliveryId
        ]);
    } else {
        // Fallback to old method (single driver)
        $firstDriverId = !empty($validDriverIds) ? $validDriverIds[0] : null;
        $stmt = $pdo->prepare("UPDATE deliveries SET Driver_ID = :driver_id WHERE Delivery_ID = :delivery_id");
        $stmt->execute([
            'driver_id' => $firstDriverId,
            'delivery_id' => $deliveryId
        ]);
    }
    
    // Commit transaction
    $pdo->commit();
    
    // Get updated delivery info with all driver names
    $drivers = [];
    if ($junctionTableExists) {
        $stmt = $pdo->prepare("
            SELECT 
                dd.Driver_ID,
                CONCAT(u.First_Name, ' ', COALESCE(u.Middle_Name, ''), ' ', u.Last_Name) as driver_name
            FROM delivery_drivers dd
            LEFT JOIN users u ON dd.Driver_ID = u.User_ID
            WHERE dd.Delivery_ID = :delivery_id
        ");
        $stmt->execute(['delivery_id' => $deliveryId]);
        $drivers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } else {
        // Fallback: get single driver
        $stmt = $pdo->prepare("
            SELECT 
                d.Driver_ID,
                CONCAT(u.First_Name, ' ', COALESCE(u.Middle_Name, ''), ' ', u.Last_Name) as driver_name
            FROM deliveries d
            LEFT JOIN users u ON d.Driver_ID = u.User_ID
            WHERE d.Delivery_ID = :delivery_id AND d.Driver_ID IS NOT NULL
        ");
        $stmt->execute(['delivery_id' => $deliveryId]);
        $driver = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($driver) {
            $drivers = [$driver];
        }
    }
    
    $driverNames = array_column($drivers, 'driver_name');
    $assignedDriverIds = array_column($drivers, 'Driver_ID');
    
    error_log("Driver(s) assigned to delivery: Delivery_ID {$deliveryId}, Driver_IDs: " . implode(', ', $assignedDriverIds) . " by user {$_SESSION['user_id']}");
    
    // Create notifications for delivery assigned
    if (!empty($validDriverIds)) {
        $orderId = $delivery['Order_ID'] ?? null;
        $driverNamesStr = implode(', ', $driverNames);
        
        // Get customer info for notifications
        $customerStmt = $pdo->prepare("SELECT u.User_ID FROM orders o JOIN users u ON o.User_ID = u.User_ID WHERE o.Order_ID = :order_id");
        $customerStmt->execute(['order_id' => (int)$orderId]);
        $customer = $customerStmt->fetch(PDO::FETCH_ASSOC);
        $customerUserId = $customer['User_ID'] ?? null;
        
        // Create admin notification
        require_once __DIR__ . '/create_admin_activity_notification.php';
        createAdminActivityNotification($pdo, 'delivery_assigned', [
            'order_id' => $orderId,
            'message' => "Delivery assigned to driver(s): {$driverNamesStr}" . ($orderId ? " for order #{$orderId}" : '')
        ]);

        // Create driver notifications (per assigned driver)
        try {
            // Ensure driver_notifications table exists
            $checkDrvTable = $pdo->query("SHOW TABLES LIKE 'driver_notifications'");
            if ($checkDrvTable->rowCount() === 0) {
                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `driver_notifications` (
                      `Notification_ID` int(11) NOT NULL AUTO_INCREMENT,
                      `Driver_ID` int(11) NOT NULL,
                      `Activity_Type` varchar(50) DEFAULT 'delivery_assigned',
                      `Order_ID` int(11) DEFAULT NULL,
                      `Delivery_ID` int(11) DEFAULT NULL,
                      `Message` text DEFAULT NULL,
                      `Is_Read` tinyint(1) DEFAULT 0,
                      `Created_At` timestamp NOT NULL DEFAULT current_timestamp(),
                      PRIMARY KEY (`Notification_ID`),
                      KEY `idx_driver_id` (`Driver_ID`),
                      KEY `idx_is_read` (`Is_Read`),
                      KEY `idx_created_at` (`Created_At`),
                      KEY `idx_activity_type` (`Activity_Type`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                ");
            }

            $stmtDrvNotif = $pdo->prepare("
                INSERT INTO driver_notifications (Driver_ID, Activity_Type, Order_ID, Delivery_ID, Message, Is_Read)
                VALUES (:driver_id, :activity_type, :order_id, :delivery_id, :message, 0)
            ");

            foreach ($validDriverIds as $drvId) {
                $stmtDrvNotif->execute([
                    'driver_id' => (int)$drvId,
                    'activity_type' => 'delivery_assigned',
                    'order_id' => $orderId ? (int)$orderId : null,
                    'delivery_id' => (int)$deliveryId,
                    'message' => "New delivery assigned: Delivery #{$deliveryId}" . ($orderId ? " (Order #{$orderId})" : '')
                ]);
            }
        } catch (Throwable $e) {
            error_log("Driver notification insert failed: " . $e->getMessage());
        }
        
        // Create customer notification
        if ($customerUserId) {
            require_once __DIR__ . '/create_customer_notification.php';
            createCustomerNotification($pdo, $customerUserId, 'delivery_assigned', [
                'order_id' => (int)$orderId,
                'message' => "A driver has been assigned to your order #{$orderId}"
            ]);
        }
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => !empty($validDriverIds) ? 'Driver(s) assigned successfully' : 'Driver(s) unassigned successfully',
        'delivery_id' => $deliveryId,
        'driver_ids' => $assignedDriverIds,
        'driver_names' => $driverNames,
        'driver_count' => count($assignedDriverIds)
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Assign Driver to Delivery Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to assign driver: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Assign Driver to Delivery Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to assign driver: ' . $e->getMessage()
    ]);
}
?>

