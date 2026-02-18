<?php
/**
 * Add Delivery Driver API
 * Creates a new user with role "Delivery Driver"
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
        'message' => 'Access denied. Only admins and store employees can add drivers.'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$requiredFields = ['email', 'password', 'first_name', 'last_name', 'phone_number'];
foreach ($requiredFields as $field) {
    if (empty($data[$field])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => ucfirst(str_replace('_', ' ', $field)) . ' is required'
        ]);
        exit;
    }
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Check if email already exists
    if ($db->emailExists($data['email'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Email already exists'
        ]);
        exit;
    }
    
    // Prepare user data
    $userData = [
        'email' => $data['email'],
        'password' => $data['password'],
        'first_name' => $data['first_name'],
        'middle_name' => $data['middle_name'] ?? null,
        'last_name' => $data['last_name'],
        'phone_number' => $data['phone_number'],
        'role' => 'Delivery Driver'
    ];
    
    // Insert user
    $userId = $db->insertUser($userData);
    
    if (!$userId) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to create driver'
        ]);
        exit;
    }
    
    // Get created driver data
    $driver = $db->getUserById($userId);
    
    // Build full name
    $fullName = trim(($driver['First_Name'] ?? '') . ' ' . ($driver['Middle_Name'] ?? '') . ' ' . ($driver['Last_Name'] ?? ''));
    if (empty(trim($fullName))) {
        $fullName = 'Driver #' . $userId;
    }
    
    error_log("Driver added: User_ID {$userId}, Email {$data['email']} by user {$_SESSION['user_id']}");
    
    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Driver added successfully',
        'driver' => [
            'user_id' => (int)$userId,
            'first_name' => $driver['First_Name'] ?? '',
            'middle_name' => $driver['Middle_Name'] ?? '',
            'last_name' => $driver['Last_Name'] ?? '',
            'full_name' => $fullName,
            'email' => $driver['email'] ?? '',
            'phone_number' => $driver['Phone_Number'] ?? '',
            'role' => 'Delivery Driver'
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Add Driver Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to add driver: ' . $e->getMessage()
    ]);
}
?>

