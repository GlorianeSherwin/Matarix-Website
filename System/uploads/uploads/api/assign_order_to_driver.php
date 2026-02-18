<?php
/**
 * Assign Order to Driver API
 * Assigns a driver to an order by creating/updating the delivery record
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, PUT');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: delivery assignments (Store Employee + Admin)
rbac_require_permission_api('deliveries.assign');

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$orderId = $data['order_id'] ?? null;
$driverId = $data['driver_id'] ?? null;

if (!$orderId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Order ID is required'
    ]);
    exit;
}

// Driver ID can be null to unassign a driver
if ($driverId !== null) {
    $driverId = (int)$driverId;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Start transaction
    $pdo->beginTransaction();
    
    // Verify order exists
    $stmt = $pdo->prepare("SELECT Order_ID, status FROM orders WHERE Order_ID = :order_id");
    $stmt->execute(['order_id' => $orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$order) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Order not found'
        ]);
        $pdo->rollBack();
        exit;
    }
    
    // If driver ID is provided, verify driver exists and has correct role
    if ($driverId !== null && $driverId > 0) {
        $stmt = $pdo->prepare("SELECT User_ID, First_Name, Last_Name FROM users WHERE User_ID = :driver_id AND role = 'Delivery Driver'");
        $stmt->execute(['driver_id' => $driverId]);
        $driver = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$driver) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Driver not found or is not a delivery driver'
            ]);
            $pdo->rollBack();
            exit;
        }
    }
    
    // Check if delivery record exists for this order
    $stmt = $pdo->prepare("SELECT Delivery_ID FROM deliveries WHERE Order_ID = :order_id");
    $stmt->execute(['order_id' => $orderId]);
    $existingDelivery = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existingDelivery) {
        $deliveryId = $existingDelivery['Delivery_ID'];
        
        // If assigning a driver, check for vehicle conflicts
        if ($driverId !== null && $driverId > 0) {
            // Check if this delivery has a vehicle assigned
            $stmt = $pdo->prepare("SELECT Vehicle_ID FROM deliveries WHERE Delivery_ID = :delivery_id");
            $stmt->execute(['delivery_id' => $deliveryId]);
            $currentDelivery = $stmt->fetch(PDO::FETCH_ASSOC);
            $vehicleId = $currentDelivery['Vehicle_ID'] ?? null;
            
            if ($vehicleId) {
                // Check if this vehicle is assigned to another active delivery with a different driver
                $stmt = $pdo->prepare("
                    SELECT 
                        d.Delivery_ID,
                        d.Driver_ID,
                        CONCAT(u.First_Name, ' ', COALESCE(u.Middle_Name, ''), ' ', u.Last_Name) as driver_name,
                        f.vehicle_model
                    FROM deliveries d
                    LEFT JOIN users u ON d.Driver_ID = u.User_ID
                    LEFT JOIN fleet f ON d.Vehicle_ID = f.Vehicle_ID
                    WHERE d.Vehicle_ID = :vehicle_id 
                    AND d.Delivery_ID != :delivery_id 
                    AND d.Delivery_Status NOT IN ('Delivered', 'Cancelled')
                    AND d.Driver_ID IS NOT NULL
                    AND d.Driver_ID != :driver_id
                ");
                $stmt->execute([
                    'vehicle_id' => $vehicleId,
                    'delivery_id' => $deliveryId,
                    'driver_id' => $driverId
                ]);
                $conflictingDelivery = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($conflictingDelivery) {
                    $conflictDriverName = $conflictingDelivery['driver_name'] ?? 'Another driver';
                    $vehicleModel = $conflictingDelivery['vehicle_model'] ?? 'this vehicle';
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => "Cannot assign this driver. The vehicle ({$vehicleModel}) is already assigned to {$conflictDriverName} on another active delivery. A vehicle cannot be assigned to two different drivers at the same time."
                    ]);
                    $pdo->rollBack();
                    exit;
                }
            }
        }
        
        // Update existing delivery record
        $stmt = $pdo->prepare("UPDATE deliveries SET Driver_ID = :driver_id, Updated_At = NOW() WHERE Delivery_ID = :delivery_id");
        $stmt->execute([
            'driver_id' => $driverId,
            'delivery_id' => $deliveryId
        ]);
    } else {
        // Create new delivery record
        $stmt = $pdo->prepare("
            INSERT INTO deliveries (Order_ID, Driver_ID, Delivery_Status, Created_At, Updated_At)
            VALUES (:order_id, :driver_id, 'Pending', NOW(), NOW())
        ");
        $stmt->execute([
            'order_id' => $orderId,
            'driver_id' => $driverId
        ]);
        $deliveryId = $pdo->lastInsertId();
    }
    
    // Commit transaction
    $pdo->commit();
    
    // Get updated delivery info with driver name
    $stmt = $pdo->prepare("
        SELECT 
            d.Delivery_ID,
            d.Order_ID,
            d.Driver_ID,
            CONCAT(u.First_Name, ' ', COALESCE(u.Middle_Name, ''), ' ', u.Last_Name) as driver_name
        FROM deliveries d
        LEFT JOIN users u ON d.Driver_ID = u.User_ID
        WHERE d.Delivery_ID = :delivery_id
    ");
    $stmt->execute(['delivery_id' => $deliveryId]);
    $updatedDelivery = $stmt->fetch(PDO::FETCH_ASSOC);
    
    error_log("Order assigned to driver: Order_ID {$orderId}, Delivery_ID {$deliveryId}, Driver_ID " . ($driverId ?? 'NULL') . " by user {$_SESSION['user_id']}");
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => $driverId ? 'Order assigned to driver successfully' : 'Driver unassigned from order successfully',
        'order_id' => (int)$orderId,
        'delivery_id' => (int)$deliveryId,
        'driver_id' => $driverId,
        'driver_name' => $updatedDelivery['driver_name'] ?? null
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Assign Order to Driver Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to assign order to driver: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Assign Order to Driver Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to assign order to driver: ' . $e->getMessage()
    ]);
}
?>

