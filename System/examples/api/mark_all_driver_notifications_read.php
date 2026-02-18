<?php
/**
 * Mark All Driver Notifications as Read API
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

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    $checkTableStmt = $pdo->query("SHOW TABLES LIKE 'driver_notifications'");
    if ($checkTableStmt->rowCount() === 0) {
        echo json_encode(['success' => true, 'affected_rows' => 0, 'message' => 'No notifications table yet']);
        exit;
    }

    $stmt = $pdo->prepare("
        UPDATE driver_notifications
        SET Is_Read = 1
        WHERE Driver_ID = :driver_id AND Is_Read = 0
    ");
    $stmt->execute(['driver_id' => $driverId]);

    echo json_encode([
        'success' => true,
        'message' => 'All notifications marked as read',
        'affected_rows' => $stmt->rowCount()
    ]);
} catch (Throwable $e) {
    error_log("Mark All Driver Notifications Read Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to mark all notifications as read']);
}

