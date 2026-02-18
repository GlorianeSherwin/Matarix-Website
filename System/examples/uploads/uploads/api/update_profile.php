<?php
/**
 * Update User Profile API Endpoint
 * Updates current logged-in user's profile data
 */

// Start output buffering to prevent any output before headers
ob_start();

// Suppress error display for production
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, PUT');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('customer');
}

// Check if user is logged in
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true || !isset($_SESSION['user_id'])) {
    ob_end_clean();
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Not authenticated'
    ]);
    exit;
}

// Only allow POST or PUT requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Get user ID from session
$userId = $_SESSION['user_id'];

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Fallback to POST data if JSON is not available
if (!$input) {
    $input = $_POST;
}

// Initialize database functions
$db = new DatabaseFunctions();

// Get PDO connection for custom update
$pdo = $db->getConnection();

try {
    // Build update query dynamically based on provided fields
    $updateFields = [];
    $params = ['user_id' => $userId];
    
    // Allowed fields that can be updated
    $allowedFields = [
        'first_name' => 'First_Name',
        'last_name' => 'Last_Name',
        'middle_name' => 'Middle_Name',
        'email' => 'email',
        'phone_number' => 'Phone_Number',
        'address' => 'address', // Keep for backward compatibility
        'address_street' => 'address_street',
        'address_city' => 'address_city',
        'address_district' => 'address_district',
        'address_barangay' => 'address_barangay',
        'address_postal_code' => 'address_postal_code',
        'address_region' => 'address_region'
    ];
    
    // Validate and prepare update fields
    foreach ($allowedFields as $inputKey => $dbColumn) {
        if (isset($input[$inputKey])) {
            $value = trim($input[$inputKey]);
            
            // Validate email format
            if ($inputKey === 'email' && !empty($value)) {
                if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Invalid email format'
                    ]);
                    exit;
                }
                
                // Check if email already exists (excluding current user)
                $checkStmt = $pdo->prepare("SELECT User_ID FROM users WHERE email = :email AND User_ID != :user_id");
                $checkStmt->execute(['email' => $value, 'user_id' => $userId]);
                if ($checkStmt->fetch()) {
                    http_response_code(409);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Email already in use by another account'
                    ]);
                    exit;
                }
            }
            
            // Validate phone number
            if ($inputKey === 'phone_number' && !empty($value)) {
                $phoneNumber = preg_replace('/\D/', '', $value); // Remove non-digits
                if (empty($phoneNumber) || strlen($phoneNumber) < 10 || strlen($phoneNumber) > 11) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Please enter a valid phone number (10-11 digits for Philippines)'
                    ]);
                    exit;
                }
                // Store as string to preserve leading zeros (e.g., "09123456789")
                $value = $phoneNumber; // Keep as string, don't convert to integer
            }
            
            // Validate postal code
            if ($inputKey === 'address_postal_code' && !empty($value)) {
                if (!preg_match('/^\d{4}$/', trim($value))) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Postal code must be 4 digits'
                    ]);
                    exit;
                }
            }
            
            // Auto-update concatenated address field when structured fields are updated
            if (in_array($inputKey, ['address_street', 'address_city', 'address_district', 'address_barangay', 'address_postal_code', 'address_region'])) {
                // Get current address fields to build full address
                $currentUser = $db->getUserById($userId);
                $street = $input['address_street'] ?? $currentUser['address_street'] ?? '';
                $city = $input['address_city'] ?? $currentUser['address_city'] ?? '';
                $district = $input['address_district'] ?? $currentUser['address_district'] ?? '';
                $barangay = $input['address_barangay'] ?? $currentUser['address_barangay'] ?? '';
                $postal = $input['address_postal_code'] ?? $currentUser['address_postal_code'] ?? '';
                $region = $input['address_region'] ?? $currentUser['address_region'] ?? '';
                
                // Build full address string (only include region if it's not empty)
                $addressParts = array_filter([$street, $city, $district, $barangay, $postal, $region]);
                $fullAddress = trim(implode(', ', $addressParts));
                
                // Add address field update
                if (!in_array('address', array_keys($input))) {
                    $updateFields[] = "address = :address";
                    $params['address'] = $fullAddress;
                }
            }
            
            // Validate names
            if (($inputKey === 'first_name' || $inputKey === 'last_name') && !empty($value)) {
                $namePattern = "/^[a-zA-Z\s'-]+$/";
                if (!preg_match($namePattern, $value)) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => ucfirst(str_replace('_', ' ', $inputKey)) . ' should only contain letters'
                    ]);
                    exit;
                }
            }
            
            $updateFields[] = "{$dbColumn} = :{$inputKey}";
            $params[$inputKey] = $value;
        }
    }
    
    // If no fields to update
    if (empty($updateFields)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'No valid fields to update'
        ]);
        exit;
    }
    
    // Build and execute update query
    $sql = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE User_ID = :user_id";
    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute($params);
    
    if ($result) {
        // Get updated user data
        $user = $db->getUserById($userId);
        
        if ($user) {
            http_response_code(200);
            ob_end_clean();
            echo json_encode([
                'success' => true,
                'message' => 'Profile updated successfully',
                'user' => [
                    'user_id' => $user['User_ID'],
                    'first_name' => $user['First_Name'] ?? '',
                    'middle_name' => $user['Middle_Name'] ?? '',
                    'last_name' => $user['Last_Name'] ?? '',
                    'email' => $user['email'] ?? '',
                    'phone_number' => $user['Phone_Number'] ?? '',
                    'address' => $user['address'] ?? '',
                    'address_street' => $user['address_street'] ?? '',
                    'address_city' => $user['address_city'] ?? '',
                    'address_district' => $user['address_district'] ?? '',
                    'address_barangay' => $user['address_barangay'] ?? '',
                    'address_postal_code' => $user['address_postal_code'] ?? '',
                    'address_region' => $user['address_region'] ?? null,
                    'role' => $user['role'] ?? '',
                    'full_name' => trim(($user['First_Name'] ?? '') . ' ' . ($user['Middle_Name'] ?? '') . ' ' . ($user['Last_Name'] ?? '')),
                    'profile_picture' => $user['profile_picture'] ?? null
                ]
            ]);
            exit;
        } else {
            ob_end_clean();
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Profile updated successfully'
            ]);
            exit;
        }
    } else {
        ob_end_clean();
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to update profile'
        ]);
        exit;
    }
    
} catch (PDOException $e) {
    ob_end_clean();
    error_log("Update Profile API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while updating profile data'
    ]);
    exit;
} catch (Exception $e) {
    ob_end_clean();
    error_log("Update Profile API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while updating profile data'
    ]);
    exit;
}

