<?php
/**
 * Update User API Endpoint
 * Updates user information
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: PUT, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: user management edit (Admin only, by config)
rbac_require_permission_api('users.edit');

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Fallback to POST data if JSON is not available
if (!$input) {
    $input = $_POST;
}

// Validate user_id
if (!isset($input['user_id']) || empty($input['user_id'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'User ID is required'
    ]);
    exit;
}

$userId = (int)$input['user_id'];

// Initialize database functions
$db = new DatabaseFunctions();
$pdo = $db->getConnection();

// Check if user exists
$existingUser = $db->getUserById($userId);
if (!$existingUser) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'User not found'
    ]);
    exit;
}

try {
    // Build update query
    $updateFields = [];
    $params = ['user_id' => $userId];
    
    // Update first name
    if (isset($input['first_name']) && !empty(trim($input['first_name']))) {
        $updateFields[] = "First_Name = :first_name";
        $params['first_name'] = trim($input['first_name']);
    }
    
    // Update middle name
    if (isset($input['middle_name'])) {
        $updateFields[] = "Middle_Name = :middle_name";
        $params['middle_name'] = !empty(trim($input['middle_name'])) ? trim($input['middle_name']) : null;
    }
    
    // Update last name
    if (isset($input['last_name']) && !empty(trim($input['last_name']))) {
        $updateFields[] = "Last_Name = :last_name";
        $params['last_name'] = trim($input['last_name']);
    }
    
    // Update phone number
    if (isset($input['phone_number'])) {
        $updateFields[] = "Phone_Number = :phone_number";
        $params['phone_number'] = !empty($input['phone_number']) ? $input['phone_number'] : null;
    }
    
    // Update email (check if it's different and not already taken)
    if (isset($input['email']) && !empty(trim($input['email']))) {
        $newEmail = trim($input['email']);
        if ($newEmail !== $existingUser['email']) {
            if (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid email format'
                ]);
                exit;
            }
            if ($db->emailExists($newEmail)) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email already exists'
                ]);
                exit;
            }
            $updateFields[] = "email = :email";
            $params['email'] = $newEmail;
        }
    }
    
    // Update structured address fields
    $addressFieldsUpdated = false;
    
    // Update address_street
    if (isset($input['address_street'])) {
        $updateFields[] = "address_street = :address_street";
        $params['address_street'] = !empty(trim($input['address_street'])) ? trim($input['address_street']) : null;
        $addressFieldsUpdated = true;
    }
    
    // Update address_city
    if (isset($input['address_city'])) {
        $updateFields[] = "address_city = :address_city";
        $params['address_city'] = !empty(trim($input['address_city'])) ? trim($input['address_city']) : null;
        $addressFieldsUpdated = true;
    }
    
    // Update address_district
    if (isset($input['address_district'])) {
        $updateFields[] = "address_district = :address_district";
        $params['address_district'] = !empty(trim($input['address_district'])) ? trim($input['address_district']) : null;
        $addressFieldsUpdated = true;
    }
    
    // Update address_barangay
    if (isset($input['address_barangay'])) {
        $updateFields[] = "address_barangay = :address_barangay";
        $params['address_barangay'] = !empty(trim($input['address_barangay'])) ? trim($input['address_barangay']) : null;
        $addressFieldsUpdated = true;
    }
    
    // Update address_postal_code
    if (isset($input['address_postal_code'])) {
        $postalCode = trim($input['address_postal_code']);
        if (!empty($postalCode) && !preg_match('/^\d{4}$/', $postalCode)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Postal code must be 4 digits'
            ]);
            exit;
        }
        $updateFields[] = "address_postal_code = :address_postal_code";
        $params['address_postal_code'] = !empty($postalCode) ? $postalCode : null;
        $addressFieldsUpdated = true;
    }
    
    // Update address_region
    if (isset($input['address_region'])) {
        $updateFields[] = "address_region = :address_region";
        $params['address_region'] = !empty(trim($input['address_region'])) ? trim($input['address_region']) : null;
        $addressFieldsUpdated = true;
    }
    
    // Auto-construct concatenated address field from structured fields
    // Always construct address if any structured address fields are present in input
    $hasStructuredAddressFields = isset($input['address_street']) || isset($input['address_city']) || 
                                   isset($input['address_district']) || isset($input['address_barangay']) || 
                                   isset($input['address_postal_code']) || isset($input['address_region']);
    
    if ($hasStructuredAddressFields || $addressFieldsUpdated) {
        // Get current user data to use existing values for fields not being updated
        $currentUser = $db->getUserById($userId);
        $street = isset($input['address_street']) ? trim($input['address_street']) : ($currentUser['address_street'] ?? '');
        $city = isset($input['address_city']) ? trim($input['address_city']) : ($currentUser['address_city'] ?? '');
        $district = isset($input['address_district']) ? trim($input['address_district']) : ($currentUser['address_district'] ?? '');
        $barangay = isset($input['address_barangay']) ? trim($input['address_barangay']) : ($currentUser['address_barangay'] ?? '');
        $postal = isset($input['address_postal_code']) ? trim($input['address_postal_code']) : ($currentUser['address_postal_code'] ?? '');
        $region = isset($input['address_region']) ? trim($input['address_region']) : ($currentUser['address_region'] ?? '');
        
        // Build full address string (only include non-empty parts)
        $addressParts = array_filter([$street, $city, $district, $barangay, $postal, $region], function($part) {
            return !empty(trim($part));
        });
        $fullAddress = !empty($addressParts) ? trim(implode(', ', $addressParts)) : '';
        
        // Always update the concatenated address field (set to empty string if no parts, to satisfy NOT NULL constraint if exists)
        $updateFields[] = "address = :address";
        $params['address'] = $fullAddress ?: '';
    } else if (isset($input['address'])) {
        // Fallback: if only the old address field is provided
        $updateFields[] = "address = :address";
        $params['address'] = trim($input['address']);
    }
    
    // Role is immutable after account creation (RBAC fixed permissions). Do NOT allow updates here.
    
    // Update password if provided
    if (isset($input['password']) && !empty($input['password'])) {
        if (strlen($input['password']) < 6) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Password must be at least 6 characters long'
            ]);
            exit;
        }
        $hashedPassword = password_hash($input['password'], PASSWORD_DEFAULT);
        $updateFields[] = "password = :password";
        $params['password'] = $hashedPassword;
    }
    
    // Update status
    if (isset($input['status']) && !empty($input['status'])) {
        $statusMap = [
            'active' => 'active',
            'inactive' => 'inactive',
            'pending' => 'pending',
            'archived' => 'archived'
        ];
        $status = $statusMap[$input['status']] ?? 'active';
        $updateFields[] = "status = :status";
        $params['status'] = $status;
    }
    
    if (empty($updateFields)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'No fields to update'
        ]);
        exit;
    }
    
    // Execute update
    $sql = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE User_ID = :user_id";
    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute($params);
    
    if ($result) {
        // Get updated user
        $updatedUser = $db->getUserById($userId);
        
        // Create notification for user updated
        require_once __DIR__ . '/create_admin_activity_notification.php';
        $userName = trim(($updatedUser['First_Name'] ?? '') . ' ' . ($updatedUser['Middle_Name'] ?? '') . ' ' . ($updatedUser['Last_Name'] ?? ''));
        $statusChanged = isset($input['status']) ? " (Status: {$input['status']})" : '';
        createAdminActivityNotification($pdo, 'user_updated', [
            'user_id' => $userId,
            'user_name' => $userName ?: ($updatedUser['email'] ?? 'User'),
            'message' => "User updated: {$userName}{$statusChanged}"
        ]);
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'User updated successfully',
            'user' => [
                'user_id' => $updatedUser['User_ID'],
                'first_name' => $updatedUser['First_Name'] ?? '',
                'last_name' => $updatedUser['Last_Name'] ?? '',
                'email' => $updatedUser['email'] ?? '',
                'role' => $updatedUser['role'] ?? ''
            ]
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to update user'
        ]);
    }
    
} catch (Exception $e) {
    error_log("Update User API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while updating the user.'
    ]);
}
?>

