<?php
/**
 * Create Admin Notifications Table
 * Creates the admin_notifications table if it doesn't exist
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Check if table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'admin_notifications'");
    $tableExists = $stmt->rowCount() > 0;
    
    if ($tableExists) {
        echo json_encode([
            'success' => true,
            'message' => 'admin_notifications table already exists',
            'table_exists' => true
        ]);
        exit;
    }
    
    // Create table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `admin_notifications` (
          `Notification_ID` int(11) NOT NULL AUTO_INCREMENT,
          `Order_ID` int(11) NOT NULL,
          `User_ID` int(11) NOT NULL,
          `Customer_Name` varchar(255) NOT NULL,
          `Order_Date` datetime NOT NULL,
          `Message` text DEFAULT NULL,
          `Is_Read` tinyint(1) DEFAULT 0,
          `Created_At` timestamp NOT NULL DEFAULT current_timestamp(),
          PRIMARY KEY (`Notification_ID`),
          KEY `fk_notifications_order` (`Order_ID`),
          KEY `fk_notifications_user` (`User_ID`),
          KEY `idx_is_read` (`Is_Read`),
          KEY `idx_created_at` (`Created_At`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    
    // Try to add foreign key constraints
    try {
        $pdo->exec("
            ALTER TABLE `admin_notifications`
            ADD CONSTRAINT `fk_notifications_order` FOREIGN KEY (`Order_ID`) REFERENCES `orders` (`Order_ID`) ON DELETE CASCADE,
            ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`User_ID`) REFERENCES `users` (`User_ID`) ON DELETE CASCADE
        ");
    } catch (PDOException $e) {
        error_log("Foreign key constraint warning: " . $e->getMessage());
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'admin_notifications table created successfully',
        'table_exists' => true
    ]);
    
} catch (PDOException $e) {
    error_log("Create Admin Notifications Table Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to create admin_notifications table: ' . $e->getMessage()
    ]);
}
?>
