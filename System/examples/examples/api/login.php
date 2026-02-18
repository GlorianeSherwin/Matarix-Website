<?php
/**
 * Login API Endpoint
 * Handles user authentication for both Customer and Admin
 */

// Start output buffering to prevent any output before headers
ob_start();

// Suppress PHP errors from output - send to error log instead
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
// When using credentials, we must specify the origin, not use *
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 
          (isset($_SERVER['HTTP_REFERER']) ? parse_url($_SERVER['HTTP_REFERER'], PHP_URL_SCHEME) . '://' . parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST) : '*');
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ob_end_clean();
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

// Validate input
if (!isset($input['email']) || !isset($input['password'])) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email and password are required']);
    exit;
}

$email = trim($input['email']);
$password = $input['password'];
$userType = $input['user_type'] ?? 'Customer'; // Default to Customer, can be 'Admin', 'Customer', etc.

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email format']);
    exit;
}

// Initialize database functions
$db = new DatabaseFunctions();

// Attempt login
try {
    $user = $db->login($email, $password);
    
    if ($user) {
        // Check if user role matches the requested login type
        $userRole = $user['role'];
        
        // Determine session context based on USER ROLE, not user_type from request
        // This ensures admins always get admin sessions, even if they use customer login page
        if (in_array($userRole, ['Admin', 'Store Employee', 'Delivery Driver'])) {
            $sessionContext = 'admin';
            $requiredUserType = 'Admin';
        } else {
            $sessionContext = 'customer';
            $requiredUserType = 'Customer';
        }
        
        // Check if user has permission to login (role-based check)
        $canLogin = false;
        if ($userType === 'Admin' && in_array($userRole, ['Admin', 'Store Employee', 'Delivery Driver'])) {
            $canLogin = true;
        } elseif ($userType === 'Customer' && in_array($userRole, ['Customer', 'Store Employee', 'Delivery Driver', 'Admin'])) {
            $canLogin = true;
        }
        
        if ($canLogin) {
            // Start session with appropriate name based on USER ROLE (not user_type)
            require_once __DIR__ . '/../includes/session_helper.php';
            // Close any existing session first to ensure clean switch
            if (session_status() !== PHP_SESSION_NONE) {
                session_write_close();
            }
            
            // Log what we're about to do
            error_log("Login - User Type from request: " . $userType);
            error_log("Login - User Role from database: " . $userRole);
            error_log("Login - Session Context (based on role): " . $sessionContext);
            
            startSession($sessionContext);
            
            // Verify the session name is correct
            error_log("Login - Session Name After startSession: " . session_name());
            $expectedSessionName = $sessionContext === 'admin' ? 'MATARIX_ADMIN_SESSION' : 'MATARIX_CUSTOMER_SESSION';
            if (session_name() !== $expectedSessionName) {
                error_log("Login - ERROR: Session name mismatch! Expected " . $expectedSessionName . ", got: " . session_name());
                // Force correct session name
                session_write_close();
                require_once __DIR__ . '/../includes/path_helper.php';
                session_set_cookie_params([
                    'lifetime' => 0,
                    'path' => getBasePath(),
                    'domain' => '',
                    'secure' => isSecure(),
                    'httponly' => true,
                    'samesite' => 'Lax'
                ]);
                session_name($expectedSessionName);
                session_start();
                error_log("Login - Session Name After Fix: " . session_name());
            }
            
            $_SESSION['user_id'] = $user['User_ID'];
            $_SESSION['user_email'] = $user['email'];
            $_SESSION['user_role'] = $user['role'];
            $_SESSION['user_name'] = trim(($user['First_Name'] ?? '') . ' ' . ($user['Middle_Name'] ?? '') . ' ' . ($user['Last_Name'] ?? ''));
            $_SESSION['logged_in'] = true;
            $_SESSION['login_time'] = time();
            
            // Log session info for debugging
            error_log("Login - Session Name: " . session_name());
            error_log("Login - Session ID: " . session_id());
            error_log("Login - User ID in session: " . ($_SESSION['user_id'] ?? 'NOT SET'));
            error_log("Login - User Role in session: " . ($_SESSION['user_role'] ?? 'NOT SET'));
            error_log("Login - Full Session Data: " . json_encode($_SESSION));
            
            // Force session to be written by touching it
            // PHP will auto-save on script end, but we can also explicitly save
            // Don't close the session - let it stay open for the response
            
            // Update last_login timestamp and reactivate if inactive
            try {
                $pdo = $db->getConnection();
                
                // Check if last_login column exists
                $checkStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'last_login'");
                $lastLoginExists = $checkStmt->fetch() !== false;
                
                if ($lastLoginExists) {
                    $updateStmt = $pdo->prepare("
                        UPDATE users 
                        SET last_login = NOW(), 
                            status = CASE 
                                WHEN status = 'inactive' THEN 'active' 
                                ELSE status 
                            END
                        WHERE User_ID = :user_id
                    ");
                    $updateStmt->execute(['user_id' => $user['User_ID']]);
                }
            } catch (Exception $e) {
                // Log error but don't fail login
                error_log("Last login update error: " . $e->getMessage());
            }
            
            // Determine redirect URL based on role
            $redirectUrl = '../Customer/MainPage.html'; // Default for Customer
            if ($userRole === 'Admin' || $userRole === 'Store Employee') {
                $redirectUrl = '../Admin/OrdersAdmin.html';
            } elseif ($userRole === 'Delivery Driver') {
                $redirectUrl = '../Admin/DeliveriesAdmin.html';
            }
            
            // Ensure session is written before sending response
            // PHP will auto-save, but let's be explicit
            session_write_close();
            
            // Reopen session for any final operations
            require_once __DIR__ . '/../includes/path_helper.php';
            session_set_cookie_params([
                'lifetime' => 0,
                'path' => getBasePath(),
                'domain' => '',
                'secure' => isSecure(),
                'httponly' => true,
                'samesite' => 'Lax'
            ]);
            session_name($sessionContext === 'admin' ? 'MATARIX_ADMIN_SESSION' : 'MATARIX_CUSTOMER_SESSION');
            session_start();
            
            // Verify session was saved
            $savePath = session_save_path();
            if (empty($savePath)) {
                $savePath = sys_get_temp_dir();
            }
            $sessionFile = $savePath . '/sess_' . session_id();
            if (file_exists($sessionFile)) {
                $fileSize = filesize($sessionFile);
                error_log("Login - Final Session File Size: " . $fileSize . " bytes");
                if ($fileSize === 0) {
                    error_log("Login - ERROR: Session file is still empty after write!");
                    // Re-set session data as fallback
                    $_SESSION['user_id'] = $user['User_ID'];
                    $_SESSION['user_email'] = $user['email'];
                    $_SESSION['user_role'] = $user['role'];
                    $_SESSION['user_name'] = trim(($user['First_Name'] ?? '') . ' ' . ($user['Middle_Name'] ?? '') . ' ' . ($user['Last_Name'] ?? ''));
                    $_SESSION['logged_in'] = true;
                    $_SESSION['login_time'] = time();
                }
            }
            
            ob_end_clean();
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Login successful',
                'user' => [
                    'id' => $user['User_ID'],
                    'email' => $user['email'],
                    'role' => $user['role'],
                    'name' => trim(($user['First_Name'] ?? '') . ' ' . ($user['Middle_Name'] ?? '') . ' ' . ($user['Last_Name'] ?? ''))
                ],
                'redirect_url' => $redirectUrl
            ]);
            exit;
        } else {
            ob_end_clean();
            http_response_code(403);
            echo json_encode([
                'success' => false, 
                'message' => 'Access denied. This account does not have permission to access this login page.'
            ]);
            exit;
        }
    } else {
        ob_end_clean();
        http_response_code(401);
        echo json_encode([
            'success' => false, 
            'message' => 'Invalid email or password. Please check your credentials and try again.'
        ]);
        exit;
    }
} catch (Exception $e) {
    ob_end_clean();
    error_log("Login API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'An error occurred during login. Please try again later.'
    ]);
    exit;
}

