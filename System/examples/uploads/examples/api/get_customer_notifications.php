<?php
/**
 * Get Customer Notifications API
 * Returns notifications for customer users
 */

// Start output buffering to prevent any output before headers
ob_start();

// Suppress error display for production
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit;
}

// Start customer session
if (session_status() !== PHP_SESSION_NONE) {
    @session_write_close();
}

require_once __DIR__ . '/../includes/path_helper.php';
session_set_cookie_params([
    'lifetime' => 0,
    'path' => getBasePath(),
    'domain' => '',
    'secure' => isSecure(),
    'httponly' => true,
    'samesite' => 'Lax'
]);
session_name('MATARIX_CUSTOMER_SESSION');
@session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Not authenticated'
    ]);
    exit;
}

$userId = $_SESSION['user_id'];
$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Check if notifications table exists
    $checkTableStmt = $pdo->query("SHOW TABLES LIKE 'customer_notifications'");
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
    $orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;
    $activityType = isset($_GET['activity_type']) ? trim($_GET['activity_type']) : null;
    
    // Build WHERE clause
    $whereConditions = ['User_ID = :user_id'];
    $params = [':user_id' => $userId];
    
    if ($unreadOnly) {
        $whereConditions[] = 'Is_Read = 0';
    }
    
    if ($orderId !== null) {
        $whereConditions[] = 'Order_ID = :order_id';
        $params[':order_id'] = $orderId;
    }
    
    if ($activityType !== null && $activityType !== '') {
        $whereConditions[] = 'Activity_Type = :activity_type';
        $params[':activity_type'] = $activityType;
    }
    
    $whereClause = implode(' AND ', $whereConditions);
    
    $stmt = $pdo->prepare("
        SELECT 
            Notification_ID as id,
            Activity_Type as activity_type,
            Order_ID as order_id,
            Message as message,
            Is_Read as is_read,
            Created_At as created_at
        FROM customer_notifications
        WHERE {$whereClause}
        ORDER BY Created_At DESC
        LIMIT :limit
    ");
    
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format notifications (using aliases from SELECT)
    $formattedNotifications = [];
    foreach ($notifications as $notification) {
        $formattedNotifications[] = [
            'id' => (int)$notification['id'],
            'activity_type' => $notification['activity_type'] ?? 'order_approved',
            'order_id' => $notification['order_id'] ? (int)$notification['order_id'] : null,
            'message' => $notification['message'],
            'is_read' => (bool)$notification['is_read'],
            'created_at' => $notification['created_at']
        ];
    }
    
    // Get total unread count
    $countStmt = $pdo->prepare("SELECT COUNT(*) as unread_count FROM customer_notifications WHERE User_ID = :user_id AND Is_Read = 0");
    $countStmt->execute(['user_id' => $userId]);
    $countResult = $countStmt->fetch(PDO::FETCH_ASSOC);
    $unreadCount = (int)$countResult['unread_count'];
    
    ob_end_clean();
    echo json_encode([
        'success' => true,
        'notifications' => $formattedNotifications,
        'unread_count' => $unreadCount
    ]);
    exit;
    
} catch (PDOException $e) {
    ob_end_clean();
    error_log("Get Customer Notifications Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch notifications'
    ]);
    exit;
} catch (Exception $e) {
    ob_end_clean();
    error_log("Get Customer Notifications Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch notifications'
    ]);
    exit;
}
?>
