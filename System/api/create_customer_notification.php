<?php
/**
 * Create Customer Notification
 * Helper function to create notifications for customer activities
 */

require_once __DIR__ . '/../includes/db_functions.php';

/**
 * Create a notification for customer activities
 * 
 * @param PDO $pdo Database connection
 * @param int $userId Customer user ID
 * @param string $activityType Type of activity (order_approved, order_status_changed, payment_received, delivery_assigned, delivery_status_changed, delivery_completed, order_rejected, etc.)
 * @param array $data Activity data (order_id, message, etc.)
 * @return bool Success status
 */
function createCustomerNotification($pdo, $userId, $activityType, $data = []) {
    try {
        // Ensure notifications table exists
        $checkTableStmt = $pdo->query("SHOW TABLES LIKE 'customer_notifications'");
        $tableExists = $checkTableStmt->rowCount() > 0;
        
        if (!$tableExists) {
            // Create the notifications table
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `customer_notifications` (
                  `Notification_ID` int(11) NOT NULL AUTO_INCREMENT,
                  `User_ID` int(11) NOT NULL,
                  `Activity_Type` varchar(50) DEFAULT 'order_approved',
                  `Order_ID` int(11) DEFAULT NULL,
                  `Message` text DEFAULT NULL,
                  `Is_Read` tinyint(1) DEFAULT 0,
                  `Created_At` timestamp NOT NULL DEFAULT current_timestamp(),
                  PRIMARY KEY (`Notification_ID`),
                  KEY `fk_customer_notifications_user` (`User_ID`),
                  KEY `fk_customer_notifications_order` (`Order_ID`),
                  KEY `idx_is_read` (`Is_Read`),
                  KEY `idx_created_at` (`Created_At`),
                  KEY `idx_activity_type` (`Activity_Type`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
        } else {
            // Check if Activity_Type column exists, add if not
            $checkColumnStmt = $pdo->query("SHOW COLUMNS FROM customer_notifications LIKE 'Activity_Type'");
            if ($checkColumnStmt->rowCount() == 0) {
                $pdo->exec("ALTER TABLE customer_notifications ADD COLUMN Activity_Type varchar(50) DEFAULT 'order_approved' AFTER Notification_ID");
                $pdo->exec("ALTER TABLE customer_notifications ADD INDEX idx_activity_type (Activity_Type)");
            }
        }
        
        // Prepare notification data
        $orderId = $data['order_id'] ?? null;
        $message = $data['message'] ?? generateCustomerMessage($activityType, $data);
        
        // Insert notification
        $notificationStmt = $pdo->prepare("
            INSERT INTO customer_notifications (User_ID, Activity_Type, Order_ID, Message, Is_Read)
            VALUES (:user_id, :activity_type, :order_id, :message, 0)
        ");
        
        $notificationStmt->execute([
            'user_id' => (int)$userId,
            'activity_type' => $activityType,
            'order_id' => $orderId,
            'message' => $message
        ]);
        
        return true;
    } catch (PDOException $e) {
        error_log("Create Customer Notification Error: " . $e->getMessage());
        return false;
    }
}

/**
 * Generate default message based on activity type
 */
function generateCustomerMessage($activityType, $data = []) {
    $messages = [
        'order_approved' => "Your order #{$data['order_id']} has been approved! You can now proceed with payment.",
        'order_rejected' => "Your order #{$data['order_id']} has been rejected." . (isset($data['rejection_reason']) ? " Reason: {$data['rejection_reason']}" : ''),
        'order_status_changed' => "Your order #{$data['order_id']} status has been updated to {$data['new_status']}",
        'payment_received' => "Payment received for your order #{$data['order_id']}",
        'payment_confirmed' => "Your payment for order #{$data['order_id']} has been confirmed",
        'delivery_assigned' => "A driver has been assigned to your order #{$data['order_id']}",
        'delivery_status_changed' => "Your delivery for order #{$data['order_id']} status has been updated to {$data['new_status']}",
        'delivery_completed' => "Your order #{$data['order_id']} has been delivered successfully!",
        'order_ready' => "Your order #{$data['order_id']} is ready for delivery",
        'order_ready_pickup' => "Your order #{$data['order_id']} is ready for pickup!",
        'order_processing' => "Your order #{$data['order_id']} is now being processed",
        'proof_reupload_requested' => "Please reupload your proof of payment for order #{$data['order_id']}. The current proof of payment needs to be replaced.",
        'proof_rejected' => "You need to update your proof of payment for order #{$data['order_id']}." . (isset($data['rejection_reason']) && !empty($data['rejection_reason']) ? " Reason: {$data['rejection_reason']}" : " Please reupload your proof of payment.")
    ];
    
    return $messages[$activityType] ?? "Update for your order #{$data['order_id']}";
}

?>