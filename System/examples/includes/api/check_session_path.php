<?php
/**
 * Check Session Path Configuration
 * Helps diagnose session cookie path issues
 */

header('Content-Type: text/html; charset=utf-8');

require_once __DIR__ . '/../includes/session_helper.php';

echo "<h2>Session Path Diagnostic</h2>";
echo "<hr>";

// Get current URL path
$currentPath = $_SERVER['REQUEST_URI'] ?? '';
$scriptPath = $_SERVER['SCRIPT_NAME'] ?? '';
$documentRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';

echo "<h3>Current Request Information</h3>";
echo "<table border='1' cellpadding='10' cellspacing='0'>";
echo "<tr><th>Property</th><th>Value</th></tr>";
echo "<tr><td><strong>REQUEST_URI</strong></td><td>" . htmlspecialchars($currentPath) . "</td></tr>";
echo "<tr><td><strong>SCRIPT_NAME</strong></td><td>" . htmlspecialchars($scriptPath) . "</td></tr>";
echo "<tr><td><strong>DOCUMENT_ROOT</strong></td><td>" . htmlspecialchars($documentRoot) . "</td></tr>";

// Calculate expected cookie path
$pathParts = explode('/', trim($scriptPath, '/'));
if (count($pathParts) >= 2) {
    $expectedPath = '/' . $pathParts[0] . '/' . $pathParts[1] . '/';
} else {
    $expectedPath = '/MatarixWEBs/';
}

echo "<tr><td><strong>Calculated Cookie Path</strong></td><td>" . htmlspecialchars($expectedPath) . "</td></tr>";
echo "<tr><td><strong>Current Cookie Path (in session_helper)</strong></td><td>/MatarixWEBs/</td></tr>";
echo "</table>";

echo "<hr>";
echo "<h3>Session Cookie Information</h3>";

// Try to start session and check cookie
if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

$sessionName = session_name();
$sessionId = session_id();

echo "<table border='1' cellpadding='10' cellspacing='0'>";
echo "<tr><th>Property</th><th>Value</th></tr>";
echo "<tr><td><strong>Session Name</strong></td><td>" . htmlspecialchars($sessionName) . "</td></tr>";
echo "<tr><td><strong>Session ID</strong></td><td>" . htmlspecialchars($sessionId) . "</td></tr>";

// Check if cookie exists
$cookieExists = isset($_COOKIE[$sessionName]);
echo "<tr><td><strong>Cookie Exists in Request</strong></td><td>" . ($cookieExists ? 'YES' : 'NO') . "</td></tr>";

if ($cookieExists) {
    echo "<tr><td><strong>Cookie Value</strong></td><td>" . htmlspecialchars($_COOKIE[$sessionName]) . "</td></tr>";
}

// Get cookie parameters
$cookieParams = session_get_cookie_params();
echo "<tr><td><strong>Cookie Path (configured)</strong></td><td>" . htmlspecialchars($cookieParams['path']) . "</td></tr>";
echo "<tr><td><strong>Cookie Domain</strong></td><td>" . htmlspecialchars($cookieParams['domain'] ?: 'empty (current domain)') . "</td></tr>";
echo "<tr><td><strong>Cookie Secure</strong></td><td>" . ($cookieParams['secure'] ? 'true' : 'false') . "</td></tr>";
echo "<tr><td><strong>Cookie HttpOnly</strong></td><td>" . ($cookieParams['httponly'] ? 'true' : 'false') . "</td></tr>";

echo "</table>";

echo "<hr>";
echo "<h3>All Cookies Received</h3>";
echo "<pre>";
print_r($_COOKIE);
echo "</pre>";

echo "<hr>";
echo "<h3>Session Data</h3>";
echo "<pre>";
print_r($_SESSION ?? []);
echo "</pre>";

echo "<hr>";
echo "<h3>Recommendation</h3>";

if ($cookieParams['path'] !== $expectedPath && $expectedPath !== '/MatarixWEBs/') {
    echo "<p style='color: orange;'><strong>⚠️ Cookie path mismatch detected!</strong></p>";
    echo "<p>Current cookie path: <code>" . htmlspecialchars($cookieParams['path']) . "</code></p>";
    echo "<p>Expected path based on URL: <code>" . htmlspecialchars($expectedPath) . "</code></p>";
    echo "<p><strong>Solution:</strong> Update the cookie path in <code>includes/session_helper.php</code> to match your actual URL path.</p>";
} else {
    echo "<p style='color: green;'>✓ Cookie path appears to be configured correctly.</p>";
}

if (!$cookieExists) {
    echo "<p style='color: red;'><strong>❌ Session cookie not found in request!</strong></p>";
    echo "<p>This means the browser is not sending the session cookie. Possible causes:</p>";
    echo "<ul>";
    echo "<li>Cookie path doesn't match the request path</li>";
    echo "<li>Cookie was set with different domain</li>";
    echo "<li>Browser is blocking cookies</li>";
    echo "<li>Session expired or was cleared</li>";
    echo "</ul>";
    echo "<p><strong>Solution:</strong> Make sure you're logged in and the cookie path matches your URL structure.</p>";
}

echo "<hr>";
echo "<p><a href='javascript:history.back()'>← Go Back</a></p>";
?>

