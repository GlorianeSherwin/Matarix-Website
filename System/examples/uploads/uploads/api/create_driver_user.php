<?php
/**
 * Create Driver User
 * Creates a sample delivery driver user in the database
 * 
 * Access via: http://localhost/MatarixWEBs/api/create_driver_user.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Driver data
    $driverData = [
        'email' => 'driver@matarik.com',
        'password' => 'driver123',
        'first_name' => 'Juan',
        'middle_name' => 'Dela',
        'last_name' => 'Cruz',
        'phone_number' => '9123456789',
        'address' => '123 Driver Street, Manila',
        'role' => 'Delivery Driver'
    ];
    
    // Check if driver already exists
    if ($db->emailExists($driverData['email'])) {
        echo json_encode([
            'success' => false,
            'message' => 'Driver with email ' . $driverData['email'] . ' already exists',
            'info' => 'The driver user already exists in the database.'
        ], JSON_PRETTY_PRINT);
        exit;
    }
    
    // Insert driver
    $userId = $db->insertUser($driverData);
    
    if (!$userId) {
        throw new Exception('Failed to create driver user');
    }
    
    // Get created driver
    $driver = $db->getUserById($userId);
    
    echo json_encode([
        'success' => true,
        'message' => 'Driver user created successfully',
        'driver' => [
            'user_id' => (int)$userId,
            'email' => $driver['email'],
            'first_name' => $driver['First_Name'],
            'last_name' => $driver['Last_Name'],
            'role' => $driver['role']
        ],
        'credentials' => [
            'email' => $driverData['email'],
            'password' => $driverData['password']
        ]
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    error_log("Create Driver User Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to create driver: ' . $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
?>

