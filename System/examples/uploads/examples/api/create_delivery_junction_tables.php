<?php
/**
 * Create Delivery Junction Tables
 * Creates junction tables to support multiple drivers and vehicles per delivery
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// Check if user is logged in and is admin
$userRole = $_SESSION['user_role'] ?? $_SESSION['role'] ?? '';
if (!isset($_SESSION['user_id']) || (!in_array($userRole, ['Admin', 'Store Employee']))) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Access denied. Only admins and store employees can create tables.'
    ]);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Start transaction
    $pdo->beginTransaction();
    
    $results = [
        'steps_completed' => [],
        'errors' => []
    ];
    
    // Create delivery_drivers junction table
    try {
        $stmt = $pdo->query("
            CREATE TABLE IF NOT EXISTS delivery_drivers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                Delivery_ID INT NOT NULL,
                Driver_ID INT NOT NULL,
                Assigned_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (Delivery_ID) REFERENCES deliveries(Delivery_ID) ON DELETE CASCADE,
                FOREIGN KEY (Driver_ID) REFERENCES users(User_ID) ON DELETE CASCADE,
                UNIQUE KEY unique_delivery_driver (Delivery_ID, Driver_ID)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        $results['steps_completed'][] = "Created delivery_drivers junction table";
    } catch (Exception $e) {
        $results['errors'][] = "Error creating delivery_drivers table: " . $e->getMessage();
    }
    
    // Create delivery_vehicles junction table
    try {
        $stmt = $pdo->query("
            CREATE TABLE IF NOT EXISTS delivery_vehicles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                Delivery_ID INT NOT NULL,
                Vehicle_ID INT NOT NULL,
                Assigned_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (Delivery_ID) REFERENCES deliveries(Delivery_ID) ON DELETE CASCADE,
                FOREIGN KEY (Vehicle_ID) REFERENCES fleet(Vehicle_ID) ON DELETE CASCADE,
                UNIQUE KEY unique_delivery_vehicle (Delivery_ID, Vehicle_ID)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        $results['steps_completed'][] = "Created delivery_vehicles junction table";
    } catch (Exception $e) {
        $results['errors'][] = "Error creating delivery_vehicles table: " . $e->getMessage();
    }
    
    // Migrate existing data from deliveries table to junction tables
    try {
        // Migrate drivers
        $stmt = $pdo->query("
            INSERT IGNORE INTO delivery_drivers (Delivery_ID, Driver_ID, Assigned_At)
            SELECT Delivery_ID, Driver_ID, Created_At
            FROM deliveries
            WHERE Driver_ID IS NOT NULL AND Driver_ID > 0
        ");
        $driverCount = $stmt->rowCount();
        $results['steps_completed'][] = "Migrated {$driverCount} driver assignment(s) to delivery_drivers table";
        
        // Migrate vehicles
        $stmt = $pdo->query("
            INSERT IGNORE INTO delivery_vehicles (Delivery_ID, Vehicle_ID, Assigned_At)
            SELECT Delivery_ID, Vehicle_ID, Created_At
            FROM deliveries
            WHERE Vehicle_ID IS NOT NULL AND Vehicle_ID > 0
        ");
        $vehicleCount = $stmt->rowCount();
        $results['steps_completed'][] = "Migrated {$vehicleCount} vehicle assignment(s) to delivery_vehicles table";
    } catch (Exception $e) {
        $results['errors'][] = "Error migrating existing data: " . $e->getMessage();
    }
    
    // Commit transaction
    $pdo->commit();
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Junction tables created and data migrated successfully',
        'results' => $results
    ]);
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Create Delivery Junction Tables Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to create junction tables: ' . $e->getMessage(),
        'results' => $results ?? []
    ]);
}
?>

