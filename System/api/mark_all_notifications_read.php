<?php
/**
 * Mark All Notifications as Read API
 * Marks all notifications as read
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
    
    // Mark all notifications as read
    $stmt = $pdo->prepare("
        UPDATE admin_notifications
        SET Is_Read = 1
        WHERE Is_Read = 0
    ");
    $stmt->execute();
    $affectedRows = $stmt->rowCount();
    
    echo json_encode([
        'success' => true,
        'message' => 'All notifications marked as read',
        'affected_rows' => $affectedRows
    ]);
    
} catch (PDOException $e) {
    error_log("Mark All Notifications Read Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to mark all notifications as read: ' . $e->getMessage()
    ]);
}
?>
