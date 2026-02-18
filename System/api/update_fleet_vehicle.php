<?php
/**
 * Update Fleet Vehicle API
 * Updates vehicle information in the fleet
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, PUT');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// Check if user is logged in and has permission (Admin or Store Employee)
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'User not authenticated'
    ]);
    exit;
}

$userRole = $_SESSION['user_role'] ?? '';
if (!in_array($userRole, ['Admin', 'Store Employee'])) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Access denied. Only admins and store employees can update fleet vehicles.'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$vehicleId = $data['vehicle_id'] ?? null;
$vehicleModel = $data['vehicle_model'] ?? null;
$status = $data['status'] ?? null;
$capacity = isset($data['capacity']) ? (float)$data['capacity'] : null;
$capacityUnit = $data['capacity_unit'] ?? 'kg';

if (!$vehicleId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Vehicle ID is required'
    ]);
    exit;
}

if (empty($vehicleModel)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Vehicle model is required'
    ]);
    exit;
}

// Validate status
if ($status && !in_array($status, ['Available', 'In Use', 'Unavailable'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid status. Must be "Available", "In Use", or "Unavailable"'
    ]);
    exit;
}

// Validate capacity unit
if ($capacityUnit && !in_array($capacityUnit, ['kg', 'g', 'lb', 'oz', 'ton'])) {
    $capacityUnit = 'kg';
}

$vehicleId = (int)$vehicleId;
$vehicleModel = trim($vehicleModel);

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Start transaction
    $pdo->beginTransaction();
    
    // Check if capacity columns exist
    $checkCapacity = $pdo->query("SHOW COLUMNS FROM fleet LIKE 'capacity'");
    $hasCapacity = $checkCapacity->rowCount() > 0;
    
    // Verify vehicle exists
    if ($hasCapacity) {
        $stmt = $pdo->prepare("SELECT Vehicle_ID, vehicle_model, status, capacity, capacity_unit FROM fleet WHERE Vehicle_ID = :vehicle_id");
    } else {
        $stmt = $pdo->prepare("SELECT Vehicle_ID, vehicle_model, status FROM fleet WHERE Vehicle_ID = :vehicle_id");
    }
    $stmt->execute(['vehicle_id' => $vehicleId]);
    $vehicle = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$vehicle) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Vehicle not found'
        ]);
        $pdo->rollBack();
        exit;
    }
    
    // Build update query dynamically based on what's provided
    $updateFields = [];
    $params = ['vehicle_id' => $vehicleId];
    
    if ($vehicleModel) {
        $updateFields[] = "vehicle_model = :vehicle_model";
        $params['vehicle_model'] = $vehicleModel;
    }
    
    if ($status) {
        $updateFields[] = "status = :status";
        $params['status'] = $status;
    }
    
    // Add capacity fields if columns exist
    if ($hasCapacity) {
        if ($capacity !== null) {
            $updateFields[] = "capacity = :capacity";
            $params['capacity'] = $capacity;
        }
        if ($capacityUnit) {
            $updateFields[] = "capacity_unit = :capacity_unit";
            $params['capacity_unit'] = $capacityUnit;
        }
    }
    
    if (empty($updateFields)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'No fields to update'
        ]);
        $pdo->rollBack();
        exit;
    }
    
    // Update vehicle
    $sql = "UPDATE fleet SET " . implode(', ', $updateFields) . " WHERE Vehicle_ID = :vehicle_id";
    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute($params);
    
    if (!$result) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to update vehicle'
        ]);
        exit;
    }
    
    // Commit transaction
    $pdo->commit();
    
    // Get updated vehicle info
    if ($hasCapacity) {
        $stmt = $pdo->prepare("SELECT Vehicle_ID, vehicle_model, status, capacity, capacity_unit FROM fleet WHERE Vehicle_ID = :vehicle_id");
    } else {
        $stmt = $pdo->prepare("SELECT Vehicle_ID, vehicle_model, status FROM fleet WHERE Vehicle_ID = :vehicle_id");
    }
    $stmt->execute(['vehicle_id' => $vehicleId]);
    $updatedVehicle = $stmt->fetch(PDO::FETCH_ASSOC);
    
    error_log("Fleet vehicle updated: Vehicle_ID {$vehicleId} by user {$_SESSION['user_id']}");
    
    $responseVehicle = [
        'vehicle_id' => (int)$updatedVehicle['Vehicle_ID'],
        'vehicle_model' => $updatedVehicle['vehicle_model'],
        'status' => $updatedVehicle['status']
    ];
    
    if ($hasCapacity) {
        $responseVehicle['capacity'] = $updatedVehicle['capacity'] !== null ? (float)$updatedVehicle['capacity'] : null;
        $responseVehicle['capacity_unit'] = $updatedVehicle['capacity_unit'] ?? 'kg';
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Vehicle updated successfully',
        'vehicle' => $responseVehicle
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Update Fleet Vehicle Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update vehicle: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Update Fleet Vehicle Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update vehicle: ' . $e->getMessage()
    ]);
}
?>

