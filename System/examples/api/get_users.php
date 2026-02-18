<?php
/**
 * Get Users API Endpoint
 * Returns all users with optional filtering by role and status
 */

// Suppress any warnings/notices that might output HTML before JSON
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

// Debug: Log session info
error_log("Get Users - Session Name: " . session_name());
error_log("Get Users - Session ID: " . session_id());
error_log("Get Users - Session Status: " . session_status());
error_log("Get Users - Session Data: " . json_encode($_SESSION));
error_log("Get Users - Cookies: " . json_encode($_COOKIE));

// RBAC: user management view (Admin only, by config)
rbac_require_permission_api('users.view');

// Initialize database functions
$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Ensure status and last_login columns exist
    try {
        $checkStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'status'");
        $statusColumnExists = $checkStmt->fetch() !== false;
        if (!$statusColumnExists) {
            $pdo->exec("ALTER TABLE users ADD COLUMN status ENUM('active', 'inactive', 'pending', 'archived') DEFAULT 'active'");
            $statusColumnExists = true;
        }
    } catch (PDOException $e) {
        $statusColumnExists = false;
    }
    
    try {
        $checkStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'last_login'");
        $lastLoginExists = $checkStmt->fetch() !== false;
        if (!$lastLoginExists) {
            $pdo->exec("ALTER TABLE users ADD COLUMN last_login DATETIME DEFAULT NULL");
            $lastLoginExists = true;
        }
    } catch (PDOException $e) {
        $lastLoginExists = false;
    }
    
    // Update user statuses based on inactivity (quick check, don't block)
    // Only run this check on initial page load, not on every search/filter
    $shouldUpdateStatus = !isset($_GET['search']) || empty($_GET['search']);
    
    if ($shouldUpdateStatus && $statusColumnExists) {
        try {
            $now = new DateTime();
            
            // Get users that might need status update
            $checkStmt = $pdo->query("
                SELECT User_ID, role, last_login, COALESCE(status, 'active') as status, created_at 
                FROM users 
                WHERE COALESCE(status, 'active') != 'archived'
                LIMIT 50
            ");
            $usersToCheck = $checkStmt->fetchAll(PDO::FETCH_ASSOC);
        
            foreach ($usersToCheck as $user) {
                $userId = $user['User_ID'];
                $role = $user['role'];
                $lastLogin = $user['last_login'];
                $currentStatus = $user['status'] ?? 'active';
                
                // Determine inactivity threshold
                $inactivityDays = 90; // Default for customers
                if (in_array($role, ['Admin', 'Store Employee', 'Delivery Driver'])) {
                    $inactivityDays = 30; // 30 days for admin, employees, delivery drivers
                }
                
                $shouldBeInactive = false;
                
                if ($lastLogin) {
                    try {
                        $lastLoginDate = new DateTime($lastLogin);
                        $daysSinceLogin = $now->diff($lastLoginDate)->days;
                        $shouldBeInactive = ($daysSinceLogin >= $inactivityDays);
                    } catch (Exception $dateError) {
                        // Skip if date parsing fails
                        continue;
                    }
                } else {
                    // Check created_at if never logged in
                    if ($user['created_at']) {
                        try {
                            $createdDate = new DateTime($user['created_at']);
                            $daysSinceCreated = $now->diff($createdDate)->days;
                            $shouldBeInactive = ($daysSinceCreated >= $inactivityDays);
                        } catch (Exception $dateError) {
                            // Skip if date parsing fails
                            continue;
                        }
                    }
                }
                
                // Update status if needed
                if ($shouldBeInactive && $currentStatus !== 'inactive') {
                    $updateStmt = $pdo->prepare("UPDATE users SET status = 'inactive' WHERE User_ID = :user_id");
                    $updateStmt->execute(['user_id' => $userId]);
                } elseif (!$shouldBeInactive && $currentStatus === 'inactive') {
                    $updateStmt = $pdo->prepare("UPDATE users SET status = 'active' WHERE User_ID = :user_id");
                    $updateStmt->execute(['user_id' => $userId]);
                }
            }
        } catch (Exception $e) {
            // Ignore errors - status update will happen on next request
            error_log("Quick status update error: " . $e->getMessage());
        }
    }
    
    // Get filter parameters
    $roleFilter = $_GET['role'] ?? '';
    $statusFilter = $_GET['status'] ?? '';
    $searchTerm = $_GET['search'] ?? '';
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
    $offset = ($page - 1) * $limit;
    
    // Build query
    if ($statusColumnExists) {
        if ($lastLoginExists) {
            $sql = "SELECT User_ID, First_Name, Middle_Name, Last_Name, Phone_Number, email, address, 
                    address_street, address_city, address_district, address_barangay, address_postal_code, address_region, 
                    role, COALESCE(status, 'active') as status, created_at, profile_picture, last_login 
                    FROM users WHERE 1=1";
        } else {
            $sql = "SELECT User_ID, First_Name, Middle_Name, Last_Name, Phone_Number, email, address, role, 
                    COALESCE(status, 'active') as status, created_at, profile_picture, NULL as last_login 
                    FROM users WHERE 1=1";
        }
    } else {
        if ($lastLoginExists) {
            $sql = "SELECT User_ID, First_Name, Middle_Name, Last_Name, Phone_Number, email, address, role, 
                    'active' as status, created_at, profile_picture, last_login 
                    FROM users WHERE 1=1";
        } else {
            $sql = "SELECT User_ID, First_Name, Middle_Name, Last_Name, Phone_Number, email, address, role, 
                    'active' as status, created_at, profile_picture, NULL as last_login 
                    FROM users WHERE 1=1";
        }
    }
    $params = [];
    
    // Apply role filter
    if (!empty($roleFilter)) {
        // Map filter values to database values
        $roleMap = [
            'admin' => 'Admin',
            'employee' => 'Store Employee',
            'customer' => 'Customer',
            'delivery-driver' => 'Delivery Driver'
        ];
        if (isset($roleMap[$roleFilter])) {
            $sql .= " AND role = :role";
            $params['role'] = $roleMap[$roleFilter];
        }
    }
    
    // Apply status filter
    if (!empty($statusFilter) && $statusColumnExists) {
        $statusMap = [
            'active' => 'active',
            'inactive' => 'inactive',
            'pending' => 'pending',
            'archived' => 'archived'
        ];
        if (isset($statusMap[$statusFilter])) {
            $sql .= " AND COALESCE(status, 'active') = :status";
            $params['status'] = $statusMap[$statusFilter];
        }
    }
    
    // Apply search filter - search in first name, middle name, last name, and email
    if (!empty($searchTerm)) {
        $searchPattern = "%{$searchTerm}%";
        $sql .= " AND (First_Name LIKE :search1 OR Middle_Name LIKE :search2 OR Last_Name LIKE :search3 OR email LIKE :search4)";
        $params['search1'] = $searchPattern;
        $params['search2'] = $searchPattern;
        $params['search3'] = $searchPattern;
        $params['search4'] = $searchPattern;
    }
    
    // Get total count for pagination - build count query properly
    $countSql = "SELECT COUNT(*) as total FROM users WHERE 1=1";
    $countParams = [];
    
    // Apply role filter to count query
    if (!empty($roleFilter)) {
        $roleMap = [
            'admin' => 'Admin',
            'employee' => 'Store Employee',
            'customer' => 'Customer',
            'delivery-driver' => 'Delivery Driver'
        ];
        if (isset($roleMap[$roleFilter])) {
            $countSql .= " AND role = :role";
            $countParams['role'] = $roleMap[$roleFilter];
        }
    }
    
    // Apply status filter to count query
    if (!empty($statusFilter) && $statusColumnExists) {
        $statusMap = [
            'active' => 'active',
            'inactive' => 'inactive',
            'pending' => 'pending',
            'archived' => 'archived'
        ];
        if (isset($statusMap[$statusFilter])) {
            $countSql .= " AND COALESCE(status, 'active') = :status";
            $countParams['status'] = $statusMap[$statusFilter];
        }
    }
    
    // Apply search filter to count query - search in first name, middle name, last name, and email
    if (!empty($searchTerm)) {
        $searchPattern = "%{$searchTerm}%";
        $countSql .= " AND (First_Name LIKE :search1 OR Middle_Name LIKE :search2 OR Last_Name LIKE :search3 OR email LIKE :search4)";
        $countParams['search1'] = $searchPattern;
        $countParams['search2'] = $searchPattern;
        $countParams['search3'] = $searchPattern;
        $countParams['search4'] = $searchPattern;
    }
    
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($countParams);
    $totalUsers = $countStmt->fetchColumn();
    
    // Add ordering and pagination
    $sql .= " ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
    
    $stmt = $pdo->prepare($sql);
    
    // Bind all parameters
    foreach ($params as $key => $value) {
        $stmt->bindValue(":{$key}", $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    
    // Bind limit and offset as integers
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    
    $stmt->execute();
    
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format user data
    $formattedUsers = [];
    foreach ($users as $user) {
        // Build full name, only including middle name if it exists and is not empty
        $firstName = trim($user['First_Name'] ?? '');
        $middleName = trim($user['Middle_Name'] ?? '');
        $lastName = trim($user['Last_Name'] ?? '');
        
        // Only include middle name if it's not empty
        $nameParts = array_filter([$firstName, $middleName, $lastName], function($part) {
            return !empty($part);
        });
        $fullName = implode(' ', $nameParts);
        
        $formattedUsers[] = [
            'user_id' => $user['User_ID'],
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
            'created_at' => $user['created_at'] ?? '',
            'last_login' => $user['last_login'] ?? null,
            'profile_picture' => $user['profile_picture'] ?? null
        ];
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'users' => $formattedUsers,
        'pagination' => [
            'total' => (int)$totalUsers,
            'page' => $page,
            'limit' => $limit,
            'total_pages' => ceil($totalUsers / $limit)
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Get Users API Error: " . $e->getMessage());
    error_log("Get Users API Error Stack: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching users: ' . $e->getMessage()
    ]);
}
?>

