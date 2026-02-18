<?php
/**
 * Remove Fleet Vehicle API
 * Removes a vehicle from the fleet
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, DELETE');
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
        'message' => 'Access denied. Only admins and store employees can remove fleet vehicles.'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$vehicleId = $data['vehicle_id'] ?? null;

if (!$vehicleId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Vehicle ID is required'
    ]);
    exit;
}

$vehicleId = (int)$vehicleId;

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Start transaction
    $pdo->beginTransaction();
    
    // Verify vehicle exists
    $stmt = $pdo->prepare("SELECT Vehicle_ID, vehicle_model, status FROM fleet WHERE Vehicle_ID = :vehicle_id");
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
    
    // Check if vehicle is currently in use
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as active_count
        FROM deliveries
        WHERE Vehicle_ID = :vehicle_id 
        AND Delivery_Status NOT IN ('Delivered', 'Cancelled')
    ");
    $stmt->execute(['vehicle_id' => $vehicleId]);
    $activeCount = $stmt->fetch(PDO::FETCH_ASSOC)['active_count'];
    
    if ($activeCount > 0) {
        // Unassign vehicle from active deliveries
        $stmt = $pdo->prepare("
            UPDATE deliveries 
            SET Vehicle_ID = NULL 
            WHERE Vehicle_ID = :vehicle_id 
            AND Delivery_Status NOT IN ('Delivered', 'Cancelled')
        ");
        $stmt->execute(['vehicle_id' => $vehicleId]);
    }
    
    // Delete vehicle from fleet
    $stmt = $pdo->prepare("DELETE FROM fleet WHERE Vehicle_ID = :vehicle_id");
    $result = $stmt->execute(['vehicle_id' => $vehicleId]);
    
    if (!$result) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to remove vehicle'
        ]);
        exit;
    }
    
    // Commit transaction
    $pdo->commit();
    
    error_log("Fleet vehicle removed: Vehicle_ID {$vehicleId}, Model {$vehicle['vehicle_model']} by user {$_SESSION['user_id']}");
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Vehicle removed successfully. Active deliveries have been unassigned.',
        'vehicle_id' => $vehicleId
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Remove Fleet Vehicle Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to remove vehicle: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Remove Fleet Vehicle Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to remove vehicle: ' . $e->getMessage()
    ]);
}
?>

