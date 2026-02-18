<?php
/**
 * Get Delivery Proof Image API
 * Serves delivery proof images with correct path resolution.
 * Accepts: path=... (admin/driver) or order_id=... (customer - looks up proof for that order and verifies ownership).
 */

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/path_helper.php';

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

$isAdmin = isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true && isset($_SESSION['user_id']);
if (!$isAdmin) {
    @session_write_close();
    session_set_cookie_params(['path' => getBasePath(), 'domain' => '', 'secure' => isSecure(), 'httponly' => true, 'samesite' => 'Lax']);
    session_name('MATARIX_CUSTOMER_SESSION');
    @session_start();
    if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true || !isset($_SESSION['user_id'])) {
        http_response_code(401);
        header('Content-Type: text/plain');
        echo 'Unauthorized';
        exit;
    }
}

$path = isset($_GET['path']) ? trim($_GET['path']) : '';
$orderIdParam = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;

// Customer-friendly: resolve path from order_id (verify order belongs to user)
if ($path === '' && $orderIdParam > 0) {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    $userId = (int)$_SESSION['user_id'];
    if ($isAdmin) {
        $stmt = $pdo->prepare("SELECT o.Order_ID FROM orders o WHERE o.Order_ID = :order_id");
        $stmt->execute(['order_id' => $orderIdParam]);
    } else {
        $stmt = $pdo->prepare("SELECT o.Order_ID FROM orders o WHERE o.Order_ID = :order_id AND o.User_ID = :user_id");
        $stmt->execute(['order_id' => $orderIdParam, 'user_id' => $userId]);
    }
    if (!$stmt->fetch()) {
        http_response_code(404);
        header('Content-Type: text/plain');
        echo 'Not found';
        exit;
    }
    $dStmt = $pdo->prepare("SELECT delivery_details FROM deliveries WHERE Order_ID = :order_id LIMIT 1");
    $dStmt->execute(['order_id' => $orderIdParam]);
    $row = $dStmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || empty($row['delivery_details'])) {
        http_response_code(404);
        header('Content-Type: text/plain');
        echo 'No proof of delivery';
        exit;
    }
    $details = is_string($row['delivery_details']) ? json_decode($row['delivery_details'], true) : $row['delivery_details'];
    $path = isset($details['proof_image']) ? trim($details['proof_image']) : '';
    if ($path === '') {
        http_response_code(404);
        header('Content-Type: text/plain');
        echo 'No proof of delivery';
        exit;
    }
}

$path = str_replace('\\', '/', $path);
$path = preg_replace('#/+#', '/', $path);
$path = trim($path, '/');

// Ensure path is in uploads/delivery_proof/ format
if (!preg_match('#^uploads/delivery_proof/#', $path)) {
    if (preg_match('#^delivery_proof/([a-zA-Z0-9_\-\.]+)$#', $path, $m)) {
        $path = 'uploads/delivery_proof/' . $m[1];
    } elseif (preg_match('#^([a-zA-Z0-9_\-\.]+)$#', $path)) {
        $path = 'uploads/delivery_proof/' . $path;
    }
}

if (!preg_match('#^uploads/delivery_proof/[a-zA-Z0-9_\-\.]+$#', $path)) {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo 'Invalid path';
    exit;
}

$baseDir = realpath(__DIR__ . '/../');
$allowedDir = $baseDir ? realpath($baseDir . '/uploads/delivery_proof') : null;
$fullPath = $baseDir ? realpath($baseDir . '/' . $path) : false;

if (!$fullPath && $allowedDir && file_exists($allowedDir)) {
    $filename = basename($path);
    $directPath = $allowedDir . DIRECTORY_SEPARATOR . $filename;
    if (file_exists($directPath) && is_file($directPath)) {
        $fullPath = $directPath;
    }
}

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
