<?php
/**
 * Mark Driver Notification as Read API
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

rbac_require_permission_api('notifications.view_driver');

$driverId = (int)($_SESSION['user_id'] ?? 0);
if ($driverId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$notificationId = isset($data['notification_id']) ? (int)$data['notification_id'] : 0;
if ($notificationId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Notification ID is required']);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    $checkTableStmt = $pdo->query("SHOW TABLES LIKE 'driver_notifications'");
    if ($checkTableStmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Notifications table does not exist']);
        exit;
    }

    $stmt = $pdo->prepare("
        UPDATE driver_notifications
        SET Is_Read = 1
        WHERE Notification_ID = :id AND Driver_ID = :driver_id
    ");
    $stmt->execute(['id' => $notificationId, 'driver_id' => $driverId]);

    echo json_encode(['success' => true, 'message' => 'Notification marked as read']);
} catch (Throwable $e) {
    error_log("Mark Driver Notification Read Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to mark notification as read']);
}

