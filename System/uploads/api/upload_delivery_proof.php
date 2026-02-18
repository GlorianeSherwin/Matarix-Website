<?php
/**
 * Upload Delivery Proof Image API
 * Allows delivery drivers to upload a photo as proof when completing delivery
 */

ob_start();
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: delivery drivers and staff can upload delivery proof
rbac_require_permission_api('deliveries.update_status');

if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'No file uploaded or upload error'
    ]);
    exit;
}

$file = $_FILES['image'];
$deliveryId = isset($_POST['delivery_id']) ? (int)$_POST['delivery_id'] : 0;
$orderId = isset($_POST['order_id']) ? (int)$_POST['order_id'] : 0;

// Validate file type
$allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
if (!in_array($file['type'], $allowedTypes)) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'
    ]);
    exit;
}

// Validate file size (max 5MB)
if ($file['size'] > 5 * 1024 * 1024) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'File size too large. Maximum size is 5MB.'
    ]);
    exit;
}

$uploadDir = __DIR__ . '/../uploads/delivery_proof/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$rawExtension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION) ?: '');
$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$extension = in_array($rawExtension, $allowedExtensions) ? $rawExtension : 'jpg';
$filename = 'delivery_' . ($deliveryId ?: '') . '_' . uniqid() . '_' . time() . '.' . $extension;
$filepath = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $filepath)) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to save file'
    ]);
    exit;
}

$relativePath = 'uploads/delivery_proof/' . $filename;

ob_end_clean();
echo json_encode([
    'success' => true,
    'message' => 'Image uploaded successfully',
    'file_path' => $relativePath,
    'filename' => $filename
]);
