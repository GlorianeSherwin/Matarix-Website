<?php
/**
 * Assign Vehicle API
 * Assigns a vehicle to a delivery
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
$deliveryId = $data['delivery_id'] ?? null;
$vehicleId = $data['vehicle_id'] ?? null; // Single vehicle (for backward compatibility)
$vehicleIds = $data['vehicle_ids'] ?? null; // Multiple vehicles (new)

if (!$deliveryId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Delivery ID is required'
    ]);
    exit;
}

// Normalize to array: support both single vehicle_id and multiple vehicle_ids
$vehicleIdsArray = [];
if (isset($vehicleIds) && is_array($vehicleIds)) {
    $vehicleIdsArray = array_map('intval', array_filter($vehicleIds, function($id) {
        return $id !== null && $id > 0;
    }));
} elseif ($vehicleId !== null && $vehicleId > 0) {
    // Backward compatibility: single vehicle_id
    $vehicleIdsArray = [(int)$vehicleId];
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Start transaction
    $pdo->beginTransaction();
    
    // Verify delivery exists
    $stmt = $pdo->prepare("SELECT Delivery_ID, Order_ID, Driver_ID FROM deliveries WHERE Delivery_ID = :delivery_id");
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
    
    // Enforce workflow: a driver must be assigned before assigning a vehicle
    if (!empty($vehicleIdsArray)) {
        $hasAssignedDriver = !empty($delivery['Driver_ID']) && (int)$delivery['Driver_ID'] > 0;
        if (!$hasAssignedDriver) {
            // If multi-driver table exists, allow driver assignment through junction table
            try {
                $checkDriversJunction = $pdo->query("SHOW TABLES LIKE 'delivery_drivers'");
                if ($checkDriversJunction->rowCount() > 0) {
                    $driverCheckStmt = $pdo->prepare("SELECT 1 FROM delivery_drivers WHERE Delivery_ID = :delivery_id LIMIT 1");
                    $driverCheckStmt->execute(['delivery_id' => $deliveryId]);
                    $hasAssignedDriver = (bool)$driverCheckStmt->fetchColumn();
                }
            } catch (Throwable $e) {
                // ignore - treat as no assigned driver
            }
        }

        if (!$hasAssignedDriver) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Please assign a driver first, then assign a vehicle.'
            ]);
            $pdo->rollBack();
            exit;
        }
    }

    // Verify all vehicles exist and are not Unavailable
    $validVehicleIds = [];
    if (!empty($vehicleIdsArray)) {
        $placeholders = implode(',', array_fill(0, count($vehicleIdsArray), '?'));
        $stmt = $pdo->prepare("SELECT Vehicle_ID, vehicle_model, status FROM fleet WHERE Vehicle_ID IN ({$placeholders})");
        $stmt->execute($vehicleIdsArray);
        $validVehicles = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (count($validVehicles) !== count($vehicleIdsArray)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'One or more vehicles not found'
            ]);
            $pdo->rollBack();
            exit;
        }
        
        // Reject vehicles with status Unavailable
        $unavailable = array_filter($validVehicles, function($v) { return (isset($v['status']) && $v['status'] === 'Unavailable'); });
        if (!empty($unavailable)) {
            $pdo->rollBack();
            $names = array_column($unavailable, 'vehicle_model');
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Cannot assign vehicle(s) with status "Unavailable": ' . implode(', ', $names)
            ]);
            exit;
        }
        
        $validVehicleIds = array_column($validVehicles, 'Vehicle_ID');
    }
    
    // Check if delivery_vehicles table exists, if not use old method
    $junctionTableExists = false;
    try {
        $stmt = $pdo->query("SHOW TABLES LIKE 'delivery_vehicles'");
        $junctionTableExists = $stmt->rowCount() > 0;
    } catch (Exception $e) {
        // Table doesn't exist, use old method
    }
    
    if ($junctionTableExists) {
        // Use junction table for multiple vehicles
        // Get previous vehicle IDs to update their status
        $stmt = $pdo->prepare("SELECT Vehicle_ID FROM delivery_vehicles WHERE Delivery_ID = :delivery_id");
        $stmt->execute(['delivery_id' => $deliveryId]);
        $previousVehicleIds = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Vehicle_ID');
        
        // Remove all existing vehicle assignments for this delivery
        $stmt = $pdo->prepare("DELETE FROM delivery_vehicles WHERE Delivery_ID = :delivery_id");
        $stmt->execute(['delivery_id' => $deliveryId]);
        
        // Insert new vehicle assignments
        if (!empty($validVehicleIds)) {
            $stmt = $pdo->prepare("INSERT INTO delivery_vehicles (Delivery_ID, Vehicle_ID) VALUES (:delivery_id, :vehicle_id)");
            foreach ($validVehicleIds as $vehicleId) {
                $stmt->execute([
                    'delivery_id' => $deliveryId,
                    'vehicle_id' => $vehicleId
                ]);
            }
        }
        
        // Update vehicle statuses
        // Set newly assigned vehicles to "In Use"
        if (!empty($validVehicleIds)) {
            $placeholders = implode(',', array_fill(0, count($validVehicleIds), '?'));
            $stmt = $pdo->prepare("UPDATE fleet SET status = 'In Use' WHERE Vehicle_ID IN ({$placeholders})");
            $stmt->execute($validVehicleIds);
        }
        
        // Check if previously assigned vehicles have other active deliveries
        $vehiclesToFree = [];
        foreach ($previousVehicleIds as $prevVehicleId) {
            if (!in_array($prevVehicleId, $validVehicleIds)) {
                // This vehicle was unassigned, check if it has other active deliveries
                $stmt = $pdo->prepare("
                    SELECT COUNT(*) as active_count
                    FROM delivery_vehicles dv
                    JOIN deliveries d ON dv.Delivery_ID = d.Delivery_ID
                    WHERE dv.Vehicle_ID = :vehicle_id 
                    AND d.Delivery_Status NOT IN ('Delivered', 'Cancelled')
                ");
                $stmt->execute(['vehicle_id' => $prevVehicleId]);
                $activeCount = $stmt->fetch(PDO::FETCH_ASSOC)['active_count'];
                
                if ($activeCount == 0) {
                    $vehiclesToFree[] = $prevVehicleId;
                }
            }
        }
        
        // Set unassigned vehicles with no active deliveries to "Available"
        if (!empty($vehiclesToFree)) {
            $placeholders = implode(',', array_fill(0, count($vehiclesToFree), '?'));
            $stmt = $pdo->prepare("UPDATE fleet SET status = 'Available' WHERE Vehicle_ID IN ({$placeholders})");
            $stmt->execute($vehiclesToFree);
        }
        
        // Update main deliveries table with first vehicle (for backward compatibility)
        $firstVehicleId = !empty($validVehicleIds) ? $validVehicleIds[0] : null;
        $stmt = $pdo->prepare("UPDATE deliveries SET Vehicle_ID = :vehicle_id, Updated_At = NOW() WHERE Delivery_ID = :delivery_id");
        $stmt->execute([
            'vehicle_id' => $firstVehicleId,
            'delivery_id' => $deliveryId
        ]);
    } else {
        // Fallback to old method (single vehicle)
        $firstVehicleId = !empty($validVehicleIds) ? $validVehicleIds[0] : null;
        $stmt = $pdo->prepare("UPDATE deliveries SET Vehicle_ID = :vehicle_id, Updated_At = NOW() WHERE Delivery_ID = :delivery_id");
        $stmt->execute([
            'vehicle_id' => $firstVehicleId,
            'delivery_id' => $deliveryId
        ]);
        
        // Update vehicle status if assigned
        if ($firstVehicleId !== null && $firstVehicleId > 0) {
            $stmt = $pdo->prepare("UPDATE fleet SET status = 'In Use' WHERE Vehicle_ID = :vehicle_id");
            $stmt->execute(['vehicle_id' => $firstVehicleId]);
        }
        
        // If unassigning, check if vehicle has other active deliveries
        if ($firstVehicleId === null && isset($data['previous_vehicle_id']) && $data['previous_vehicle_id']) {
            $prevVehicleId = (int)$data['previous_vehicle_id'];
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as active_count
                FROM deliveries
                WHERE Vehicle_ID = :vehicle_id 
                AND Delivery_Status NOT IN ('Delivered', 'Cancelled')
            ");
            $stmt->execute(['vehicle_id' => $prevVehicleId]);
            $activeCount = $stmt->fetch(PDO::FETCH_ASSOC)['active_count'];
            
            // If no active deliveries, set vehicle status to Available
            if ($activeCount == 0) {
                $stmt = $pdo->prepare("UPDATE fleet SET status = 'Available' WHERE Vehicle_ID = :vehicle_id");
                $stmt->execute(['vehicle_id' => $prevVehicleId]);
            }
        }
    }
    
    // Commit transaction
    $pdo->commit();
    
    // Get updated delivery info with all vehicle info
    $vehicles = [];
    if ($junctionTableExists) {
        $stmt = $pdo->prepare("
            SELECT 
                dv.Vehicle_ID,
                f.vehicle_model
            FROM delivery_vehicles dv
            LEFT JOIN fleet f ON dv.Vehicle_ID = f.Vehicle_ID
            WHERE dv.Delivery_ID = :delivery_id
        ");
        $stmt->execute(['delivery_id' => $deliveryId]);
        $vehicles = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } else {
        // Fallback: get single vehicle
        $stmt = $pdo->prepare("
            SELECT 
                d.Vehicle_ID,
                f.vehicle_model
            FROM deliveries d
            LEFT JOIN fleet f ON d.Vehicle_ID = f.Vehicle_ID
            WHERE d.Delivery_ID = :delivery_id AND d.Vehicle_ID IS NOT NULL
        ");
        $stmt->execute(['delivery_id' => $deliveryId]);
        $vehicle = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($vehicle) {
            $vehicles = [$vehicle];
        }
    }
    
    $vehicleModels = array_column($vehicles, 'vehicle_model');
    $assignedVehicleIds = array_column($vehicles, 'Vehicle_ID');
    
    error_log("Vehicle(s) assigned to delivery: Delivery_ID {$deliveryId}, Vehicle_IDs: " . implode(', ', $assignedVehicleIds) . " by user {$_SESSION['user_id']}");
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => !empty($validVehicleIds) ? 'Vehicle(s) assigned successfully' : 'Vehicle(s) unassigned successfully',
        'delivery_id' => (int)$deliveryId,
        'vehicle_ids' => $assignedVehicleIds,
        'vehicle_models' => $vehicleModels,
        'vehicle_count' => count($assignedVehicleIds)
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Assign Vehicle Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to assign vehicle: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Assign Vehicle Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to assign vehicle: ' . $e->getMessage()
    ]);
}
?>

