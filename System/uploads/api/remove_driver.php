<?php
/**
 * Remove Delivery Driver API
 * Removes a delivery driver from the system
 * Note: This will set the driver's role to 'Customer' instead of deleting to preserve data integrity
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
        'message' => 'Access denied. Only admins and store employees can remove drivers.'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$driverId = $data['driver_id'] ?? null;

if (!$driverId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Driver ID is required'
    ]);
    exit;
}

$driverId = (int)$driverId;

// Prevent self-deletion
if ($driverId == $_SESSION['user_id']) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'You cannot remove yourself'
    ]);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Start transaction
    $pdo->beginTransaction();
    
    // Verify driver exists and has correct role
    $stmt = $pdo->prepare("SELECT User_ID, First_Name, Last_Name, email FROM users WHERE User_ID = :driver_id AND role = 'Delivery Driver'");
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
    
    // Check if driver has active deliveries
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as active_count
        FROM deliveries
        WHERE Driver_ID = :driver_id 
        AND Delivery_Status NOT IN ('Delivered', 'Cancelled')
    ");
    $stmt->execute(['driver_id' => $driverId]);
    $activeCount = $stmt->fetch(PDO::FETCH_ASSOC)['active_count'];
    
    if ($activeCount > 0) {
        // Unassign driver from active deliveries instead of blocking removal
        $stmt = $pdo->prepare("
            UPDATE deliveries 
            SET Driver_ID = NULL 
            WHERE Driver_ID = :driver_id 
            AND Delivery_Status NOT IN ('Delivered', 'Cancelled')
        ");
        $stmt->execute(['driver_id' => $driverId]);
    }
    
    // Change role to Customer instead of deleting (preserves data integrity)
    $stmt = $pdo->prepare("UPDATE users SET role = 'Customer' WHERE User_ID = :driver_id");
    $result = $stmt->execute(['driver_id' => $driverId]);
    
    if (!$result) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to remove driver'
        ]);
        exit;
    }
    
    // Commit transaction
    $pdo->commit();
    
    error_log("Driver removed: User_ID {$driverId}, Email {$driver['email']} by user {$_SESSION['user_id']}");
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Driver removed successfully. Active deliveries have been unassigned.',
        'driver_id' => $driverId
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Remove Driver Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to remove driver: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Remove Driver Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to remove driver: ' . $e->getMessage()
    ]);
}
?>

