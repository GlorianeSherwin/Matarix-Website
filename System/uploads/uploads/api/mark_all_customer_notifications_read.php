<?php
/**
 * Mark All Customer Notifications as Read API
 * Marks all unread notifications as read for the current user
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
$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Mark all unread notifications as read
    $stmt = $pdo->prepare("
        UPDATE customer_notifications 
        SET Is_Read = 1 
        WHERE User_ID = :user_id AND Is_Read = 0
    ");
    $stmt->execute(['user_id' => $userId]);
    
    $updatedCount = $stmt->rowCount();
    
    echo json_encode([
        'success' => true,
        'message' => "Marked {$updatedCount} notification(s) as read",
        'updated_count' => $updatedCount
    ]);
    
} catch (PDOException $e) {
    error_log("Mark All Customer Notifications Read Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to mark notifications as read: ' . $e->getMessage()
    ]);
}
?>
