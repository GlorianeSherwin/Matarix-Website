<?php
/**
 * Forgot Password API Endpoint
 * Handles password reset requests and sends reset link via email
 */

// Start output buffering to prevent any output before headers
ob_start();

// Suppress error display for production
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 
          (isset($_SERVER['HTTP_REFERER']) ? parse_url($_SERVER['HTTP_REFERER'], PHP_URL_SCHEME) . '://' . parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST) : '*');
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/error_handler.php';

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
if (!isset($input['email'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email is required']);
    exit;
}

$email = trim($input['email']);

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email format']);
    exit;
}

try {
    // Use the shared DB helper (keeps DB config consistent across APIs)
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    // Ensure password reset token table exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_token (token),
        INDEX idx_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Look up user (we do not reveal existence to the client)
    $stmt = $pdo->prepare("SELECT User_ID, First_Name, Last_Name, email FROM users WHERE email = :email LIMIT 1");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    // If user exists, create token and attempt to send email
    if ($user) {
        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));

        // Invalidate any existing unused tokens for this email
        $stmt = $pdo->prepare("UPDATE password_reset_tokens SET used = 1 WHERE email = :email AND used = 0");
        $stmt->execute(['email' => $email]);

        // Insert new token
        $stmt = $pdo->prepare("INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (:email, :token, :expires_at)");
        $stmt->execute([
            'email' => $email,
            'token' => $token,
            'expires_at' => $expiresAt
        ]);

        // Build reset link
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $scriptPath = $_SERVER['SCRIPT_NAME'] ?? '';

        require_once __DIR__ . '/../includes/path_helper.php';
        $basePath = rtrim(getBasePath(), '/');
        $resetLink = getBaseUrl() . '/Customer/ResetPassword.html?token=' . urlencode($token);
        error_log("Generated reset link: " . $resetLink);

        // Attempt to send email (do not fail the API if SMTP fails; log instead)
        try {
            require_once __DIR__ . '/../includes/email_sender.php';
            $emailSender = new EmailSender();
            $userName = trim(($user['First_Name'] ?? '') . ' ' . ($user['Last_Name'] ?? ''));

            $emailSent = $emailSender->sendPasswordResetEmail($email, $resetLink, $userName);
            if (!$emailSent) {
                error_log("ERROR: Failed to send password reset email to: " . $email);
            }
        } catch (Throwable $e) {
            error_log("CRITICAL: Email sending error: " . $e->getMessage());
            error_log("Error trace: " . $e->getTraceAsString());
        }
    }

    // Always return success (security: do not reveal if email exists)
    echo json_encode([
        'success' => true,
        'message' => 'If an account with that email exists, a password reset link has been sent to your email address.'
    ]);
    exit;
} catch (Throwable $e) {
    error_log("Forgot Password Error: " . $e->getMessage());
    error_log("Error trace: " . $e->getTraceAsString());
    ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred. Please try again later.'
    ]);
    exit;
}

