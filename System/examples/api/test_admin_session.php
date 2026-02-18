<?php
/**
 * Test Admin Session API
 * Quick test to verify admin session is working
 */

header('Content-Type: application/json');
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 
          (isset($_SERVER['HTTP_REFERER']) ? parse_url($_SERVER['HTTP_REFERER'], PHP_URL_SCHEME) . '://' . parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST) : '*');
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/session_helper.php';

// Start admin session
if (session_status() !== PHP_SESSION_NONE) {
    session_write_close();
}
startSession('admin');

echo json_encode([
    'session_name' => session_name(),
    'session_id' => session_id(),
    'user_id' => $_SESSION['user_id'] ?? null,
    'user_role' => $_SESSION['user_role'] ?? null,
    'logged_in' => isset($_SESSION['logged_in']) ? $_SESSION['logged_in'] : false,
    'all_session_data' => $_SESSION,
    'all_cookies' => $_COOKIE,
    'has_session_cookie' => isset($_COOKIE[session_name()]),
    'session_cookie_value' => $_COOKIE[session_name()] ?? 'NOT SET'
]);

