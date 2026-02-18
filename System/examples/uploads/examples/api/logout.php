<?php
/**
 * Logout API Endpoint
 * Handles user logout
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

try {
    // Start session (will use appropriate session name)
    if (session_status() === PHP_SESSION_NONE) {
        startSession(); // Auto-detects context
    }

    // Destroy session
    logout();

    ob_end_clean();
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Logged out successfully'
    ]);
    exit;
} catch (Exception $e) {
    ob_end_clean();
    error_log("Logout API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred during logout. Please try again.'
    ]);
    exit;
}

