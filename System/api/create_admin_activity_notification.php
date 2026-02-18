<?php
/**
 * Create Admin Activity Notification
 * Helper function to create notifications for all admin activities
 */

require_once __DIR__ . '/../includes/db_functions.php';

/**
 * Create a notification for admin activities
 * 
 * @param PDO $pdo Database connection
 * @param string $activityType Type of activity (order_created, order_status_changed, user_added, user_updated, user_deleted, product_added, product_updated, product_deleted, payment_updated, delivery_updated, etc.)
 * @param array $data Activity data (order_id, user_id, customer_name, message, etc.)
 * @return bool Success status
 */
function createAdminActivityNotification($pdo, $activityType, $data = []) {
    try {
        // Ensure notifications table exists
        $checkTableStmt = $pdo->query("SHOW TABLES LIKE 'admin_notifications'");
        $tableExists = $checkTableStmt->rowCount() > 0;
        
        if (!$tableExists) {
            // Create the notifications table with activity type support
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `admin_notifications` (
                  `Notification_ID` int(11) NOT NULL AUTO_INCREMENT,
                  `Activity_Type` varchar(50) DEFAULT 'order_created',
                  `Order_ID` int(11) DEFAULT NULL,
                  `User_ID` int(11) DEFAULT NULL,
                  `Customer_Name` varchar(255) DEFAULT NULL,
                  `Order_Date` datetime DEFAULT NULL,
                  `Message` text DEFAULT NULL,
                  `Is_Read` tinyint(1) DEFAULT 0,
                  `Created_At` timestamp NOT NULL DEFAULT current_timestamp(),
                  PRIMARY KEY (`Notification_ID`),
                  KEY `fk_notifications_order` (`Order_ID`),
                  KEY `fk_notifications_user` (`User_ID`),
                  KEY `idx_is_read` (`Is_Read`),
                  KEY `idx_created_at` (`Created_At`),
                  KEY `idx_activity_type` (`Activity_Type`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
        } else {
            // Check if Activity_Type column exists, add if not
            $checkColumnStmt = $pdo->query("SHOW COLUMNS FROM admin_notifications LIKE 'Activity_Type'");
            if ($checkColumnStmt->rowCount() == 0) {
                $pdo->exec("ALTER TABLE admin_notifications ADD COLUMN Activity_Type varchar(50) DEFAULT 'order_created' AFTER Notification_ID");
                $pdo->exec("ALTER TABLE admin_notifications ADD INDEX idx_activity_type (Activity_Type)");
            }
        }
        
        // Prepare notification data
        $orderId = $data['order_id'] ?? null;
        $userId = $data['user_id'] ?? ($_SESSION['user_id'] ?? null);
        $customerName = $data['customer_name'] ?? null;
        $orderDate = $data['order_date'] ?? null;
        $message = $data['message'] ?? generateDefaultMessage($activityType, $data);
        
        // Insert notification
        $notificationStmt = $pdo->prepare("
            INSERT INTO admin_notifications (Activity_Type, Order_ID, User_ID, Customer_Name, Order_Date, Message, Is_Read)
            VALUES (:activity_type, :order_id, :user_id, :customer_name, :order_date, :message, 0)
        ");
        
        $notificationStmt->execute([
            'activity_type' => $activityType,
            'order_id' => $orderId,
            'user_id' => $userId,
            'customer_name' => $customerName,
            'order_date' => $orderDate ?: (in_array($activityType, ['order_created', 'order_status_changed', 'payment_updated']) ? date('Y-m-d H:i:s') : null),
            'message' => $message
        ]);
        
        return true;
    } catch (PDOException $e) {
        error_log("Create Admin Activity Notification Error: " . $e->getMessage());
        return false;
    }
}

/**
 * Generate default message based on activity type
 */
function generateDefaultMessage($activityType, $data = []) {
    $messages = [
        'order_created' => "New order #{$data['order_id']} from {$data['customer_name']}",
        'order_status_changed' => "Order #{$data['order_id']} status changed to {$data['new_status']}",
        'order_approved' => "Order #{$data['order_id']} has been approved",
        'order_rejected' => "Order #{$data['order_id']} has been rejected",
        'payment_updated' => "Payment status updated for order #{$data['order_id']}",
        'payment_received' => "Payment received for order #{$data['order_id']}",
        'user_added' => "New user added: {$data['user_name']}",
        'user_updated' => "User updated: {$data['user_name']}",
        'user_deleted' => "User deleted: {$data['user_name']}",
        'user_status_changed' => "User status changed: {$data['user_name']} to {$data['new_status']}",
        'product_added' => "New product added: {$data['product_name']}",
        'product_updated' => "Product updated: {$data['product_name']}",
        'product_deleted' => "Product deleted: {$data['product_name']}",
        'inventory_updated' => "Inventory updated for product: {$data['product_name']}",
        'delivery_assigned' => "Delivery assigned for order #{$data['order_id']}",
        'delivery_status_changed' => "Delivery status changed for order #{$data['order_id']}",
        'delivery_completed' => "Delivery completed for order #{$data['order_id']}",
        'proof_of_payment_updated' => "Customer uploaded proof of payment for order #{$data['order_id']}",
        'proof_rejected' => "Proof of payment rejected for order #{$data['order_id']}"
    ];
    
    return $messages[$activityType] ?? "Activity: {$activityType}";
}

?>