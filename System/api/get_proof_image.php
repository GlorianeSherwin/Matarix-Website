<?php
/**
 * Get Proof of Payment Image API
 * Serves proof of payment images with correct path resolution (works when hosted in subdirectories)
 */

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/path_helper.php';

// Start session for auth check
if (session_status() !== PHP_SESSION_NONE) {
    session_write_close();
}
session_set_cookie_params([
    'lifetime' => 0,
    'path' => getBasePath(),
    'domain' => '',
    'secure' => isSecure(),
    'httponly' => true,
    'samesite' => 'Lax'
]);
session_name('MATARIX_ADMIN_SESSION');
@session_start();

// Require admin login
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    @session_write_close();
    session_set_cookie_params(['path' => getBasePath(), 'domain' => '', 'secure' => isSecure(), 'httponly' => true, 'samesite' => 'Lax']);
    session_name('MATARIX_CUSTOMER_SESSION');
    @session_start();
    if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
        http_response_code(401);
        header('Content-Type: text/plain');
        echo 'Unauthorized';
        exit;
    }
}

$path = isset($_GET['path']) ? trim($_GET['path']) : '';
$orderId = isset($_GET['order_id']) ? (int) $_GET['order_id'] : 0;

// If order_id provided, look up proof_of_payment from transaction (more reliable than path)
if ($orderId > 0) {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    $stmt = $pdo->prepare("
        SELECT t.proof_of_payment
        FROM transactions t
        INNER JOIN orders o ON t.Order_ID = o.Order_ID
        WHERE t.Order_ID = :order_id
        AND t.proof_of_payment IS NOT NULL
        AND TRIM(t.proof_of_payment) != ''
        LIMIT 1
    ");
    $stmt->execute(['order_id' => $orderId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && !empty($row['proof_of_payment'])) {
        $path = trim($row['proof_of_payment']);
    }
}

// Normalize path - remove leading slashes, backslashes, and extra slashes
$path = str_replace('\\', '/', $path);
$path = preg_replace('#/+#', '/', $path);
$path = trim($path, '/');

// Empty path = no proof found (e.g. order_id had no proof)
if (empty($path)) {
    http_response_code(404);
    header('Content-Type: text/plain');
    echo 'Proof of payment not found';
    exit;
}

// Ensure path is in uploads/proof_of_payment/ format (handle various stored formats)
if (!preg_match('#^uploads/proof_of_payment/#', $path)) {
    if (preg_match('#^proof_of_payment/([a-zA-Z0-9_\-\.]+)$#', $path, $m)) {
        $path = 'uploads/proof_of_payment/' . $m[1];
    } elseif (preg_match('#^([a-zA-Z0-9_\-\.]+)$#', $path)) {
        $path = 'uploads/proof_of_payment/' . $path;
    }
}

// Must be within uploads/proof_of_payment/ (allow filenames with letters, numbers, underscore, hyphen, dot)
if (!preg_match('#^uploads/proof_of_payment/[a-zA-Z0-9_\-\.]+$#', $path)) {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo 'Invalid path';
    exit;
}

$baseDir = realpath(__DIR__ . '/../');
$allowedDir = $baseDir ? realpath($baseDir . '/uploads/proof_of_payment') : null;
$fullPath = $baseDir ? realpath($baseDir . '/' . $path) : false;

// Fallback: try direct file path if realpath fails (e.g. symlinks, non-canonical paths)
if (!$fullPath && $allowedDir && file_exists($allowedDir)) {
    $filename = basename($path);
    $directPath = $allowedDir . DIRECTORY_SEPARATOR . $filename;
    if (file_exists($directPath) && is_file($directPath)) {
        $fullPath = $directPath;
    }
}

// Verify the resolved path is actually inside our uploads/proof_of_payment directory
if (!$fullPath || !$allowedDir || strpos(str_replace('\\', '/', $fullPath), str_replace('\\', '/', $allowedDir)) !== 0) {
    http_response_code(404);
    header('Content-Type: text/plain');
    echo 'File not found';
    exit;
}

if (!file_exists($fullPath) || !is_file($fullPath)) {
    http_response_code(404);
    header('Content-Type: text/plain');
    echo 'File not found';
    exit;
}

$ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
$mimeTypes = [
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'webp' => 'image/webp'
];
$contentType = $mimeTypes[$ext] ?? 'application/octet-stream';

header('Content-Type: ' . $contentType);
header('Cache-Control: private, max-age=3600');
readfile($fullPath);
exit;
