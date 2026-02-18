<?php
/**
 * Database Migration: Add Order Availability Slots
 * Creates order_availability_slots table for multiple delivery time preferences
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    $pdo->beginTransaction();
    $results = [];

    // Check if order_availability_slots table exists
    $checkTable = $pdo->query("SHOW TABLES LIKE 'order_availability_slots'");
    if ($checkTable->rowCount() == 0) {
        // Create order_availability_slots table
        $pdo->exec("
            CREATE TABLE order_availability_slots (
                slot_id INT PRIMARY KEY AUTO_INCREMENT,
                order_id INT NOT NULL,
                slot_number INT NOT NULL,
                availability_date DATE NOT NULL,
                availability_time TIME NOT NULL,
                is_preferred BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(Order_ID) ON DELETE CASCADE,
                UNIQUE KEY unique_order_slot (order_id, slot_number),
                INDEX idx_order_id (order_id),
                INDEX idx_availability_date (availability_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        $results[] = "Created 'order_availability_slots' table.";
    } else {
        $results[] = "'order_availability_slots' table already exists, skipping creation.";
    }

    // Add min_advance_notice_days to order_settings if it doesn't exist
    $checkSetting = $pdo->prepare("SELECT setting_key FROM order_settings WHERE setting_key = 'min_advance_notice_days'");
    $checkSetting->execute();
    
    if ($checkSetting->rowCount() == 0) {
        $insertSetting = $pdo->prepare("
            INSERT INTO order_settings (setting_key, setting_value, description)
            VALUES ('min_advance_notice_days', '3', 'Minimum number of days in advance customers must select delivery date (e.g., 3 = cannot select today, tomorrow, or day after tomorrow)')
        ");
        $insertSetting->execute();
        $results[] = "Added 'min_advance_notice_days' setting with default value of 3 days.";
    } else {
        $results[] = "'min_advance_notice_days' setting already exists, skipping.";
    }

    // Add max_advance_notice_days to order_settings if it doesn't exist
    $checkMaxSetting = $pdo->prepare("SELECT setting_key FROM order_settings WHERE setting_key = 'max_advance_notice_days'");
    $checkMaxSetting->execute();
    
    if ($checkMaxSetting->rowCount() == 0) {
        $insertMaxSetting = $pdo->prepare("
            INSERT INTO order_settings (setting_key, setting_value, description)
            VALUES ('max_advance_notice_days', '30', 'Maximum number of days in advance customers can select delivery date')
        ");
        $insertMaxSetting->execute();
        $results[] = "Added 'max_advance_notice_days' setting with default value of 30 days.";
    } else {
        $results[] = "'max_advance_notice_days' setting already exists, skipping.";
    }

    $pdo->commit();

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Migration completed successfully.',
        'results' => $results
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Migration Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage()
    ]);
}
?>

