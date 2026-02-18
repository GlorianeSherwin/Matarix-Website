<?php
/**
 * Mark Customer Notification as Read API
 * Marks a single notification as read
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

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
$data = json_decode(file_get_contents('php://input'), true);
$notificationId = $data['notification_id'] ?? null;

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
    // Verify notification belongs to user and update
    $stmt = $pdo->prepare("
        UPDATE customer_notifications 
        SET Is_Read = 1 
        WHERE Notification_ID = :notification_id AND User_ID = :user_id
    ");
    $stmt->execute([
        'notification_id' => (int)$notificationId,
        'user_id' => $userId
    ]);
    
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Notification not found or does not belong to user'
        ]);
        exit;
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Notification marked as read'
    ]);
    
} catch (PDOException $e) {
    error_log("Mark Customer Notification Read Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to mark notification as read: ' . $e->getMessage()
    ]);
}
?>
