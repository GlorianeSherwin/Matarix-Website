<?php
/**
 * Get Admin Notifications API
 * Returns unread notifications for admin users
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

// RBAC: admin notifications are for Admin + Store Employee (not Delivery Driver)
rbac_require_permission_api('notifications.view_admin');

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Check if notifications table exists
    $checkTableStmt = $pdo->query("SHOW TABLES LIKE 'admin_notifications'");
    $tableExists = $checkTableStmt->rowCount() > 0;
    
    if (!$tableExists) {
        echo json_encode([
            'success' => true,
            'notifications' => [],
            'unread_count' => 0,
            'message' => 'Notifications table does not exist yet'
        ]);
        exit;
    }
    
    // Get all notifications (or unread only if specified)
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
    $unreadOnly = isset($_GET['unread_only']) && $_GET['unread_only'] === 'true';
    
    if ($unreadOnly) {
        $stmt = $pdo->prepare("
            SELECT 
                Notification_ID,
                COALESCE(Activity_Type, 'order_created') as Activity_Type,
                Order_ID,
                Customer_Name,
                Order_Date,
                Message,
                Is_Read,
                Created_At
            FROM admin_notifications
            WHERE Is_Read = 0
            ORDER BY Created_At DESC
            LIMIT :limit
        ");
    } else {
        $stmt = $pdo->prepare("
            SELECT 
                Notification_ID,
                COALESCE(Activity_Type, 'order_created') as Activity_Type,
                Order_ID,
                Customer_Name,
                Order_Date,
                Message,
                Is_Read,
                Created_At
            FROM admin_notifications
            ORDER BY Created_At DESC
            LIMIT :limit
        ");
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format notifications
    $formattedNotifications = [];
    foreach ($notifications as $notification) {
        $formattedNotifications[] = [
            'id' => (int)$notification['Notification_ID'],
            'activity_type' => $notification['Activity_Type'] ?? 'order_created',
            'order_id' => $notification['Order_ID'] ? (int)$notification['Order_ID'] : null,
            'customer_name' => $notification['Customer_Name'],
            'order_date' => $notification['Order_Date'],
            'message' => $notification['Message'],
            'is_read' => (bool)$notification['Is_Read'],
            'created_at' => $notification['Created_At']
        ];
    }
    
    // Get total unread count
    $countStmt = $pdo->query("SELECT COUNT(*) as unread_count FROM admin_notifications WHERE Is_Read = 0");
    $countResult = $countStmt->fetch(PDO::FETCH_ASSOC);
    $unreadCount = (int)$countResult['unread_count'];
    
    echo json_encode([
        'success' => true,
        'notifications' => $formattedNotifications,
        'unread_count' => $unreadCount
    ]);
    
} catch (PDOException $e) {
    error_log("Get Admin Notifications Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch notifications: ' . $e->getMessage()
    ]);
}
?>
