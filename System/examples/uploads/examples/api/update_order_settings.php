<?php
/**
 * Update Order Settings API
 * Allows admins to update minimum order configuration settings
 */

// Suppress HTML error output - we want JSON only
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start output buffering to catch any unexpected output
ob_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

// Start session for admin - use same pattern as other admin APIs
$adminSessionCookieName = 'MATARIX_ADMIN_SESSION';
$hasAdminCookie = isset($_COOKIE[$adminSessionCookieName]);

if (session_status() !== PHP_SESSION_NONE) {
    session_write_close();
}

// Set cookie parameters BEFORE starting session
require_once __DIR__ . '/../includes/path_helper.php';
session_set_cookie_params([
    'lifetime' => 0,
    'path' => getBasePath(),
    'domain' => '',
    'secure' => isSecure(),
    'httponly' => true,
    'samesite' => 'Lax'
]);

// Set session name FIRST
session_name($adminSessionCookieName);

// If we have a session cookie, use that EXACT session ID to resume the existing session
// Must set session_id BEFORE session_start()
if ($hasAdminCookie && !empty($_COOKIE[$adminSessionCookieName])) {
    $cookieSessionId = $_COOKIE[$adminSessionCookieName];
    session_id($cookieSessionId);
}

session_start();

// Check if user is logged in
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Not authenticated. Please log in.',
        'debug' => [
            'session_name' => session_name(),
            'session_id' => session_id(),
            'has_logged_in' => isset($_SESSION['logged_in']),
            'logged_in_value' => $_SESSION['logged_in'] ?? null,
            'has_user_id' => isset($_SESSION['user_id']),
            'session_keys' => array_keys($_SESSION ?? [])
        ]
    ]);
    exit;
}

// Check if user has admin privileges
$userRole = $_SESSION['user_role'] ?? '';
if (!in_array($userRole, ['Admin', 'Store Employee'])) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Access denied. Admin privileges required.',
        'debug' => [
            'user_role' => $userRole,
            'user_id' => $_SESSION['user_id'] ?? null
        ]
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed. Use POST.'
    ]);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Check if order_settings table exists, create if not
    $tableExists = $pdo->query("SHOW TABLES LIKE 'order_settings'")->rowCount() > 0;
    if (!$tableExists) {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS order_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        ob_end_clean(); // Clear any output
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid JSON input.'
        ]);
        exit;
    }
    
    // Define allowed settings
    $allowedSettings = [
        'min_order_weight_kg',
        'min_order_value',
        'min_order_weight_percentage',
        'disable_minimum_weight',
        'disable_minimum_order_value',
        'allow_below_minimum_with_fee',
        'premium_delivery_fee',
        'allow_heavy_single_items',
        'auto_calculate_from_fleet',
        'min_advance_notice_days',
        'max_advance_notice_days',
        'max_deliveries_per_day',
        'volume_discount_tier1_min',
        'volume_discount_tier1_percent',
        'volume_discount_tier2_min',
        'volume_discount_tier2_percent',
        'volume_discount_tier3_min',
        'volume_discount_tier3_percent',
        'volume_discount_tier4_min',
        'volume_discount_tier4_percent'
    ];
    
    $pdo->beginTransaction();
    
    $updated = [];
    $errors = [];
    
    foreach ($allowedSettings as $key) {
        if (isset($input[$key])) {
            $value = $input[$key];
            
            // Validate based on setting type
            switch ($key) {
                case 'min_order_weight_kg':
                case 'min_order_value':
                case 'premium_delivery_fee':
                case 'min_order_weight_percentage':
                    $value = (float)$value;
                    if ($value < 0) {
                        $errors[] = "$key must be non-negative";
                        continue 2;
                    }
                    $value = (string)$value;
                    break;
                    
                case 'min_advance_notice_days':
                case 'max_advance_notice_days':
                    $value = (int)$value;
                    if ($value < 0) {
                        $errors[] = "$key must be non-negative";
                        continue 2;
                    }
                    if ($key === 'min_advance_notice_days' && $value > 30) {
                        $errors[] = "$key must be 30 or less";
                        continue 2;
                    }
                    if ($key === 'max_advance_notice_days' && $value > 90) {
                        $errors[] = "$key must be 90 or less";
                        continue 2;
                    }
                    $value = (string)$value;
                    break;

                case 'max_deliveries_per_day':
                    $value = (int)$value;
                    if ($value < 0) {
                        $errors[] = "max_deliveries_per_day must be non-negative";
                        continue 2;
                    }
                    $value = (string)$value;
                    break;
                    
                case 'allow_below_minimum_with_fee':
                case 'allow_heavy_single_items':
                case 'auto_calculate_from_fleet':
                case 'disable_minimum_weight':
                case 'disable_minimum_order_value':
                    $value = ($value === true || $value === '1' || $value === 1) ? '1' : '0';
                    break;
                    
                default:
                    $value = (string)$value;
            }
            
            // Update or insert setting
            $stmt = $pdo->prepare("
                INSERT INTO order_settings (setting_key, setting_value, updated_at)
                VALUES (:key, :value, NOW())
                ON DUPLICATE KEY UPDATE 
                    setting_value = VALUES(setting_value),
                    updated_at = NOW()
            ");
            
            $stmt->execute([
                'key' => $key,
                'value' => $value
            ]);
            
            $updated[] = $key;
        }
    }
    
    if (!empty($errors)) {
        $pdo->rollBack();
        ob_end_clean(); // Clear any output
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Validation errors: ' . implode(', ', $errors)
        ]);
        exit;
    }
    
    $pdo->commit();
    
    // Clear any unexpected output before sending JSON
    ob_end_clean();
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Order settings updated successfully.',
        'updated' => $updated
    ]);
    
} catch (Exception $e) {
    // Rollback transaction if active
    try {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
    } catch (Exception $rollbackException) {
        error_log("Rollback error: " . $rollbackException->getMessage());
    }
    
    // Clear any unexpected output before sending JSON
    ob_end_clean();
    
    error_log("Update Order Settings Error: " . $e->getMessage());
    error_log("Update Order Settings Error Trace: " . $e->getTraceAsString());
    error_log("Update Order Settings Input: " . json_encode($input ?? []));
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update order settings: ' . $e->getMessage(),
        'error_details' => $e->getMessage()
    ]);
}
?>

