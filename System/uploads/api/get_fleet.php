<?php
/**
 * Get Fleet Vehicles API
 * Returns all vehicles in the fleet
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'User not authenticated'
    ]);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Get all fleet vehicles
    $stmt = $pdo->prepare("
        SELECT 
            f.Vehicle_ID,
            f.vehicle_model,
            f.status,
            f.capacity,
            f.capacity_unit,
            COUNT(CASE WHEN d.Delivery_Status NOT IN ('Delivered', 'Cancelled') THEN 1 END) as active_deliveries
        FROM fleet f
        LEFT JOIN deliveries d ON f.Vehicle_ID = d.Vehicle_ID
        GROUP BY f.Vehicle_ID, f.vehicle_model, f.status, f.capacity, f.capacity_unit
        ORDER BY f.Vehicle_ID ASC
    ");
    
    $stmt->execute();
    $vehicles = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format vehicle data
    $formattedVehicles = [];
    foreach ($vehicles as $vehicle) {
        // Get current driver if vehicle is assigned to an active delivery
        $driverName = null;
        if ($vehicle['active_deliveries'] > 0) {
            $driverStmt = $pdo->prepare("
                SELECT CONCAT(u.First_Name, ' ', COALESCE(u.Middle_Name, ''), ' ', u.Last_Name) as driver_name
                FROM deliveries d
                JOIN users u ON d.Driver_ID = u.User_ID
                WHERE d.Vehicle_ID = :vehicle_id 
                AND d.Delivery_Status NOT IN ('Delivered', 'Cancelled')
                LIMIT 1
            ");
            $driverStmt->execute(['vehicle_id' => $vehicle['Vehicle_ID']]);
            $driverResult = $driverStmt->fetch(PDO::FETCH_ASSOC);
            $driverName = $driverResult['driver_name'] ?? null;
        }
        
        $formattedVehicles[] = [
            'vehicle_id' => (int)$vehicle['Vehicle_ID'],
            'vehicle_model' => $vehicle['vehicle_model'],
            'status' => $vehicle['status'],
            'capacity' => $vehicle['capacity'] !== null ? (float)$vehicle['capacity'] : null,
            'capacity_unit' => $vehicle['capacity_unit'] ?? 'kg',
            'active_deliveries' => (int)$vehicle['active_deliveries'],
            'driver_name' => $driverName
        ];
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'vehicles' => $formattedVehicles,
        'count' => count($formattedVehicles)
    ]);
    
} catch (Exception $e) {
    error_log("Get Fleet API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching fleet: ' . $e->getMessage()
    ]);
}
?>

