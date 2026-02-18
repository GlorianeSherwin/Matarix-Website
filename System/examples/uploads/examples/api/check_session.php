<?php
/**
 * Check Session API Endpoint
 * Returns current user session status and role
 * Checks both admin and customer sessions to find active one
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

require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/path_helper.php';

// Try to find active session by checking both admin and customer sessions
$sessionFound = false;
$activeSession = null;

// First, try admin session
if (session_status() !== PHP_SESSION_NONE) {
    @session_write_close();
}

// Set cookie path dynamically for admin session
$basePath = getBasePath();
$isSecure = isSecure();

session_set_cookie_params([
    'lifetime' => 0,
    'path' => $basePath,
    'domain' => '',
    'secure' => $isSecure,
    'httponly' => true,
    'samesite' => 'Lax'
]);
session_name('MATARIX_ADMIN_SESSION');
@session_start();

if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
    $sessionFound = true;
    $activeSession = $_SESSION;
} else {
    // Close admin session and try customer session
    @session_write_close();
    
    // Set cookie path dynamically for customer session
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $basePath,
        'domain' => '',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_name('MATARIX_CUSTOMER_SESSION');
    @session_start();
    
    if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
        $sessionFound = true;
        $activeSession = $_SESSION;
    }
}

if ($sessionFound && $activeSession) {
    ob_end_clean();
    http_response_code(200);
    echo json_encode([
        'logged_in' => true,
        'user_id' => $activeSession['user_id'] ?? null,
        'user_email' => $activeSession['user_email'] ?? null,
        'user_role' => $activeSession['user_role'] ?? null,
        'user_name' => $activeSession['user_name'] ?? null
    ]);
    exit;
} else {
    ob_end_clean();
    http_response_code(200);
    echo json_encode([
        'logged_in' => false
    ]);
    exit;
}

