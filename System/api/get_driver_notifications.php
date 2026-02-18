<?php
/**
 * Get Driver Notifications API
 * Returns notifications for the logged-in delivery driver
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

// Always start admin session for driver APIs
startSession('admin');

rbac_require_permission_api('notifications.view_driver');

$driverId = (int)($_SESSION['user_id'] ?? 0);
if ($driverId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
$limit = max(1, min(200, $limit));
$unreadOnly = isset($_GET['unread_only']) && $_GET['unread_only'] === 'true';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    // Ensure driver_notifications table exists
    $checkTableStmt = $pdo->query("SHOW TABLES LIKE 'driver_notifications'");
    $tableExists = $checkTableStmt->rowCount() > 0;
    if (!$tableExists) {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `driver_notifications` (
              `Notification_ID` int(11) NOT NULL AUTO_INCREMENT,
              `Driver_ID` int(11) NOT NULL,
              `Activity_Type` varchar(50) DEFAULT 'delivery_assigned',
              `Order_ID` int(11) DEFAULT NULL,
              `Delivery_ID` int(11) DEFAULT NULL,
              `Message` text DEFAULT NULL,
              `Is_Read` tinyint(1) DEFAULT 0,
              `Created_At` timestamp NOT NULL DEFAULT current_timestamp(),
              PRIMARY KEY (`Notification_ID`),
              KEY `idx_driver_id` (`Driver_ID`),
              KEY `idx_is_read` (`Is_Read`),
              KEY `idx_created_at` (`Created_At`),
              KEY `idx_activity_type` (`Activity_Type`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    }

    if ($unreadOnly) {
        $stmt = $pdo->prepare("
            SELECT Notification_ID, Activity_Type, Order_ID, Delivery_ID, Message, Is_Read, Created_At
            FROM driver_notifications
            WHERE Driver_ID = :driver_id AND Is_Read = 0
            ORDER BY Created_At DESC
            LIMIT :limit
        ");
    } else {
        $stmt = $pdo->prepare("
            SELECT Notification_ID, Activity_Type, Order_ID, Delivery_ID, Message, Is_Read, Created_At
            FROM driver_notifications
            WHERE Driver_ID = :driver_id
            ORDER BY Created_At DESC
            LIMIT :limit
        ");
    }
    $stmt->bindValue(':driver_id', $driverId, PDO::PARAM_INT);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $formatted = [];
    foreach ($rows as $n) {
        $formatted[] = [
            'id' => (int)$n['Notification_ID'],
            'activity_type' => $n['Activity_Type'] ?? 'delivery_assigned',
            'order_id' => $n['Order_ID'] ? (int)$n['Order_ID'] : null,
            'delivery_id' => $n['Delivery_ID'] ? (int)$n['Delivery_ID'] : null,
            'message' => $n['Message'],
            'is_read' => (bool)$n['Is_Read'],
            'created_at' => $n['Created_At']
        ];
    }

    $countStmt = $pdo->prepare("SELECT COUNT(*) as unread_count FROM driver_notifications WHERE Driver_ID = :driver_id AND Is_Read = 0");
    $countStmt->execute(['driver_id' => $driverId]);
    $countRow = $countStmt->fetch(PDO::FETCH_ASSOC);
    $unreadCount = (int)($countRow['unread_count'] ?? 0);

    echo json_encode([
        'success' => true,
        'notifications' => $formatted,
        'unread_count' => $unreadCount
    ]);
} catch (Throwable $e) {
    error_log("Get Driver Notifications Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch driver notifications']);
}

