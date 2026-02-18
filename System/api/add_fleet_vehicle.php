<?php
/**
 * Add Fleet Vehicle API
 * Adds a new vehicle to the fleet
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST');
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
        'message' => 'Access denied. Only admins and store employees can add fleet vehicles.'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);

// Validate required fields
if (empty($data['vehicle_model'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Vehicle model is required'
    ]);
    exit;
}

$vehicleModel = trim($data['vehicle_model']);
$status = $data['status'] ?? 'Available';
$capacity = isset($data['capacity']) ? (float)$data['capacity'] : null;
$capacityUnit = $data['capacity_unit'] ?? 'kg';

// Validate status (In Use is set automatically when vehicle is assigned to a delivery)
if (!in_array($status, ['Available', 'Unavailable'])) {
    $status = 'Available';
}

// Validate capacity unit
if (!in_array($capacityUnit, ['kg', 'g', 'lb', 'oz', 'ton'])) {
    $capacityUnit = 'kg';
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Check if capacity columns exist, if not add them dynamically
    $checkCapacity = $pdo->query("SHOW COLUMNS FROM fleet LIKE 'capacity'");
    $hasCapacity = $checkCapacity->rowCount() > 0;
    
    if ($hasCapacity) {
        // Insert vehicle into fleet with capacity
        $stmt = $pdo->prepare("
            INSERT INTO fleet (vehicle_model, status, capacity, capacity_unit)
            VALUES (:vehicle_model, :status, :capacity, :capacity_unit)
        ");
        $result = $stmt->execute([
            'vehicle_model' => $vehicleModel,
            'status' => $status,
            'capacity' => $capacity,
            'capacity_unit' => $capacityUnit
        ]);
    } else {
        // Insert vehicle into fleet without capacity (backward compatibility)
        $stmt = $pdo->prepare("
            INSERT INTO fleet (vehicle_model, status)
            VALUES (:vehicle_model, :status)
        ");
        $result = $stmt->execute([
            'vehicle_model' => $vehicleModel,
            'status' => $status
        ]);
    }
    
    if (!$result) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to add vehicle'
        ]);
        exit;
    }
    
    $vehicleId = $pdo->lastInsertId();
    
    // Verify vehicle ID was created successfully
    if (!$vehicleId || $vehicleId == 0) {
        // Try to get the vehicle ID that was just created by querying
        $checkStmt = $pdo->prepare("SELECT Vehicle_ID FROM fleet WHERE vehicle_model = :vehicle_model ORDER BY Vehicle_ID DESC LIMIT 1");
        $checkStmt->execute(['vehicle_model' => $vehicleModel]);
        $newVehicle = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($newVehicle && $newVehicle['Vehicle_ID'] > 0) {
            $vehicleId = $newVehicle['Vehicle_ID'];
        } else {
            throw new Exception("Failed to create vehicle. Vehicle_ID AUTO_INCREMENT may not be enabled. Please run fix_fleet_table.php");
        }
    }
    
    error_log("Fleet vehicle added: Vehicle_ID {$vehicleId}, Model {$vehicleModel} by user {$_SESSION['user_id']}");
    
    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Vehicle added successfully',
        'vehicle' => [
            'vehicle_id' => (int)$vehicleId,
            'vehicle_model' => $vehicleModel,
            'status' => $status,
            'capacity' => $capacity,
            'capacity_unit' => $capacityUnit
        ]
    ]);
    
} catch (PDOException $e) {
    error_log("Add Fleet Vehicle Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to add vehicle: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Add Fleet Vehicle Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to add vehicle: ' . $e->getMessage()
    ]);
}
?>

