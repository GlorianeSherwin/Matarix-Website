<?php
/**
 * Get User (by ID) API Endpoint
 * Used by Admin/UserManagement for robust view/edit (pagination-safe).
 */

// Suppress output noise - JSON only
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: user management view
rbac_require_permission_api('users.view');

$userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'user_id is required']);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $user = $db->getUserById($userId);
    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'User not found']);
        exit;
    }

    $firstName = trim($user['First_Name'] ?? '');
    $middleName = trim($user['Middle_Name'] ?? '');
    $lastName = trim($user['Last_Name'] ?? '');
    $nameParts = array_filter([$firstName, $middleName, $lastName], function ($p) { return $p !== ''; });
    $fullName = implode(' ', $nameParts);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'user' => [
            'user_id' => $user['User_ID'] ?? $userId,
            'first_name' => $user['First_Name'] ?? '',
            'middle_name' => $user['Middle_Name'] ?? '',
            'last_name' => $user['Last_Name'] ?? '',
            'full_name' => $fullName,
            'email' => $user['email'] ?? '',
            'phone_number' => $user['Phone_Number'] ?? null,
            'address' => $user['address'] ?? '',
            'address_street' => $user['address_street'] ?? '',
            'address_city' => $user['address_city'] ?? '',
            'address_district' => $user['address_district'] ?? '',
            'address_barangay' => $user['address_barangay'] ?? '',
            'address_postal_code' => $user['address_postal_code'] ?? '',
            'address_region' => $user['address_region'] ?? null,
            'role' => $user['role'] ?? 'Customer',
            'status' => $user['status'] ?? 'active',
            'created_at' => $user['created_at'] ?? null,
            'last_login' => $user['last_login'] ?? null
        ]
    ]);
} catch (Throwable $e) {
    error_log("Get User API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An error occurred while fetching the user.']);
}

