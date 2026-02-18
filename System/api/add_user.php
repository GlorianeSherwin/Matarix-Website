<?php
/**
 * Add User API Endpoint
 * Creates a new user in the system
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: user management create (Admin only, by config)
rbac_require_permission_api('users.create');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Fallback to POST data if JSON is not available
if (!$input) {
    $input = $_POST;
}

// Construct address from structured fields if provided (before validation)
if (isset($input['address_street']) || isset($input['address_city']) || 
    isset($input['address_district']) || isset($input['address_barangay']) || 
    isset($input['address_postal_code']) || isset($input['address_region'])) {
    
    // Build address from structured fields
    $street = trim($input['address_street'] ?? '');
    $city = trim($input['address_city'] ?? '');
    $district = trim($input['address_district'] ?? '');
    $barangay = trim($input['address_barangay'] ?? '');
    $postal = trim($input['address_postal_code'] ?? '');
    $region = trim($input['address_region'] ?? '');
    
    $addressParts = array_filter([$street, $city, $district, $barangay, $postal, $region], function($part) {
        return !empty(trim($part));
    });
    $input['address'] = !empty($addressParts) ? trim(implode(', ', $addressParts)) : '';
}

// Validate required fields (address is now optional)
$requiredFields = ['first_name', 'last_name', 'email', 'role', 'password'];
foreach ($requiredFields as $field) {
    if (!isset($input[$field]) || empty(trim($input[$field]))) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => "Field '{$field}' is required"
        ]);
        exit;
    }
}

// Validate email format
if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid email format'
    ]);
    exit;
}

// Validate role
$validRoles = ['Admin', 'Store Employee', 'Customer', 'Delivery Driver'];
$roleMap = [
    'admin' => 'Admin',
    'employee' => 'Store Employee',
    'customer' => 'Customer',
    'delivery-driver' => 'Delivery Driver'
];

$role = $input['role'];
if (isset($roleMap[$role])) {
    $role = $roleMap[$role];
}

if (!in_array($role, $validRoles)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid role specified'
    ]);
    exit;
}

// Validate password
if (strlen($input['password']) < 6) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Password must be at least 6 characters long'
    ]);
    exit;
}

// Initialize database functions
$db = new DatabaseFunctions();

// Check if email already exists
if ($db->emailExists($input['email'])) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => 'Email already exists'
    ]);
    exit;
}

// Prepare user data
$userData = [
    'first_name' => trim($input['first_name']),
    'middle_name' => isset($input['middle_name']) ? trim($input['middle_name']) : null,
    'last_name' => trim($input['last_name']),
    'phone_number' => isset($input['phone_number']) && !empty($input['phone_number']) ? $input['phone_number'] : null,
    'email' => trim($input['email']),
    'address' => isset($input['address']) && !empty(trim($input['address'])) ? trim($input['address']) : '',
    'password' => $input['password'],
    'role' => $role
];

// Add structured address fields if provided
if (isset($input['address_street'])) {
    $userData['address_street'] = trim($input['address_street']);
}
if (isset($input['address_city'])) {
    $userData['address_city'] = trim($input['address_city']);
}
if (isset($input['address_district'])) {
    $userData['address_district'] = trim($input['address_district']);
}
if (isset($input['address_barangay'])) {
    $userData['address_barangay'] = trim($input['address_barangay']);
}
if (isset($input['address_postal_code'])) {
    $userData['address_postal_code'] = trim($input['address_postal_code']);
}
if (isset($input['address_region'])) {
    $userData['address_region'] = !empty(trim($input['address_region'])) ? trim($input['address_region']) : null;
}

// Insert user
try {
    $userId = $db->insertUser($userData);
    
    if ($userId) {
        // Set status if provided
        if (isset($input['status']) && !empty($input['status'])) {
            $pdo = $db->getConnection();
            $statusMap = [
                'active' => 'active',
                'inactive' => 'inactive',
                'pending' => 'pending',
                'archived' => 'archived'
            ];
            $status = $statusMap[$input['status']] ?? 'active';
            
            // Check if status column exists, if not, add it
            try {
                $stmt = $pdo->prepare("UPDATE users SET status = :status WHERE User_ID = :user_id");
                $stmt->execute(['status' => $status, 'user_id' => $userId]);
            } catch (PDOException $e) {
                // Status column might not exist, that's okay
                error_log("Status update skipped: " . $e->getMessage());
            }
        }
        
        // Get the created user
        $newUser = $db->getUserById($userId);
        
        // Create notification for user added
        require_once __DIR__ . '/create_admin_activity_notification.php';
        $userName = trim(($newUser['First_Name'] ?? '') . ' ' . ($newUser['Middle_Name'] ?? '') . ' ' . ($newUser['Last_Name'] ?? ''));
        createAdminActivityNotification($pdo, 'user_added', [
            'user_id' => $userId,
            'user_name' => $userName ?: ($newUser['email'] ?? 'New User'),
            'message' => "New user added: {$userName}" . ($newUser['role'] ? " (Role: {$newUser['role']})" : '')
        ]);
        
        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'User created successfully',
            'user' => [
                'user_id' => $userId,
                'first_name' => $newUser['First_Name'] ?? '',
                'last_name' => $newUser['Last_Name'] ?? '',
                'email' => $newUser['email'] ?? '',
                'role' => $newUser['role'] ?? ''
            ]
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to create user'
        ]);
    }
} catch (Exception $e) {
    error_log("Add User API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while creating the user.'
    ]);
}
?>

