<?php
/**
 * Mark Notification as Read API
 * Marks a notification as read
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

// RBAC: admin notifications
rbac_require_permission_api('notifications.view_admin');

$data = json_decode(file_get_contents('php://input'), true);
$notificationId = isset($data['notification_id']) ? (int)$data['notification_id'] : null;

if (!$notificationId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Notification ID is required'
    ]);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Check if notifications table exists
    $checkTableStmt = $pdo->query("SHOW TABLES LIKE 'admin_notifications'");
    $tableExists = $checkTableStmt->rowCount() > 0;
    
    if (!$tableExists) {
        echo json_encode([
            'success' => false,
            'message' => 'Notifications table does not exist'
        ]);
        exit;
    }
    
    // Mark notification as read
    $stmt = $pdo->prepare("
        UPDATE admin_notifications
        SET Is_Read = 1
        WHERE Notification_ID = :notification_id
    ");
    $stmt->execute(['notification_id' => $notificationId]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Notification marked as read'
    ]);
    
} catch (PDOException $e) {
    error_log("Mark Notification Read Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to mark notification as read: ' . $e->getMessage()
    ]);
}
?>
