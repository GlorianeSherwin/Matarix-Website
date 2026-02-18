<?php
/**
 * Get Delivery Drivers API
 * Returns all users with role "Delivery Driver"
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

// RBAC: only roles that can manage assignments should fetch driver list
rbac_require_permission_api('deliveries.assign');

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Get all users with role "Delivery Driver"
    $stmt = $pdo->prepare("
        SELECT 
            User_ID,
            First_Name,
            Middle_Name,
            Last_Name,
            Phone_Number,
            email,
            address,
            created_at,
            profile_picture
        FROM users
        WHERE role = 'Delivery Driver'
        ORDER BY First_Name ASC, Last_Name ASC
    ");
    
    $stmt->execute();
    $drivers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format driver data
    $formattedDrivers = [];
    foreach ($drivers as $driver) {
        // Get driver's current active deliveries count
        // Check if junction table exists, if so use it, otherwise use old method
        $junctionTableExists = false;
        try {
            $checkStmt = $pdo->query("SHOW TABLES LIKE 'delivery_drivers'");
            $junctionTableExists = $checkStmt->rowCount() > 0;
        } catch (Exception $e) {
            // Table doesn't exist
        }
        
        if ($junctionTableExists) {
            // Use junction table for multiple drivers per delivery
            $activeCountStmt = $pdo->prepare("
                SELECT COUNT(DISTINCT dd.Delivery_ID) as active_count
                FROM delivery_drivers dd
                JOIN deliveries d ON dd.Delivery_ID = d.Delivery_ID
                WHERE dd.Driver_ID = :driver_id 
                AND d.Delivery_Status NOT IN ('Delivered', 'Cancelled')
            ");
        } else {
            // Fallback to old method (single driver per delivery)
            $activeCountStmt = $pdo->prepare("
                SELECT COUNT(*) as active_count
                FROM deliveries
                WHERE Driver_ID = :driver_id 
                AND Delivery_Status NOT IN ('Delivered', 'Cancelled')
            ");
        }
        $activeCountStmt->execute(['driver_id' => $driver['User_ID']]);
        $activeCount = (int)$activeCountStmt->fetch(PDO::FETCH_ASSOC)['active_count'];
        
        // Get vehicle from active deliveries first (most recent)
        $vehicleStmt = $pdo->prepare("
            SELECT 
                d.Vehicle_ID,
                f.vehicle_model
            FROM deliveries d
            LEFT JOIN fleet f ON d.Vehicle_ID = f.Vehicle_ID
            WHERE d.Driver_ID = :driver_id 
            AND d.Delivery_Status NOT IN ('Delivered', 'Cancelled')
            AND d.Vehicle_ID IS NOT NULL
            ORDER BY d.Updated_At DESC
            LIMIT 1
        ");
        $vehicleStmt->execute(['driver_id' => $driver['User_ID']]);
        $activeDelivery = $vehicleStmt->fetch(PDO::FETCH_ASSOC);
        
        $vehicleModel = $activeDelivery['vehicle_model'] ?? null;
        $vehicleId = $activeDelivery['Vehicle_ID'] ?? null;
        
        // If no vehicle from active deliveries, check all deliveries (including completed)
        if (!$vehicleModel) {
            $allDeliveriesStmt = $pdo->prepare("
                SELECT 
                    d.Vehicle_ID,
                    f.vehicle_model
                FROM deliveries d
                LEFT JOIN fleet f ON d.Vehicle_ID = f.Vehicle_ID
                WHERE d.Driver_ID = :driver_id 
                AND d.Vehicle_ID IS NOT NULL
                ORDER BY d.Updated_At DESC
                LIMIT 1
            ");
            $allDeliveriesStmt->execute(['driver_id' => $driver['User_ID']]);
            $recentDelivery = $allDeliveriesStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($recentDelivery) {
                $vehicleModel = $recentDelivery['vehicle_model'] ?? null;
                $vehicleId = $recentDelivery['Vehicle_ID'] ?? null;
            }
        }
        
        // Build full name
        $fullName = trim(($driver['First_Name'] ?? '') . ' ' . ($driver['Middle_Name'] ?? '') . ' ' . ($driver['Last_Name'] ?? ''));
        if (empty(trim($fullName))) {
            $fullName = 'Driver #' . $driver['User_ID'];
        }
        
        $formattedDrivers[] = [
            'user_id' => (int)$driver['User_ID'],
            'first_name' => $driver['First_Name'] ?? '',
            'middle_name' => $driver['Middle_Name'] ?? '',
            'last_name' => $driver['Last_Name'] ?? '',
            'full_name' => $fullName,
            'phone_number' => $driver['Phone_Number'] ?? '',
            'email' => $driver['email'] ?? '',
            'address' => $driver['address'] ?? '',
            'active_deliveries' => $activeCount,
            'status' => $activeCount > 0 ? 'Busy' : 'Available',
            'vehicle_model' => $vehicleModel,
            'vehicle_id' => $vehicleId ? (int)$vehicleId : null,
            'created_at' => $driver['created_at'] ?? '',
            'profile_picture' => $driver['profile_picture'] ?? null
        ];
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'drivers' => $formattedDrivers,
        'count' => count($formattedDrivers)
    ]);
    
} catch (Exception $e) {
    error_log("Get Delivery Drivers API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching drivers: ' . $e->getMessage()
    ]);
}
?>

