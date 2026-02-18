<?php
/**
 * Update Order Status Enum
 * Changes order status enum from old values to new values:
 * Old: 'Order Confirmed','Being Processed','On the Way','Completed'
 * New: 'Waiting Payment','Processing','Ready'
 */

require_once __DIR__ . '/../includes/db_functions.php';

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // First, update existing orders to map old statuses to new ones
    $statusMapping = [
        'Order Confirmed' => 'Waiting Payment',
        'Being Processed' => 'Processing',
        'On the Way' => 'Ready',
        'Completed' => 'Ready'
    ];
    
    foreach ($statusMapping as $oldStatus => $newStatus) {
        $stmt = $pdo->prepare("UPDATE orders SET status = :new_status WHERE status = :old_status");
        $stmt->execute(['new_status' => $newStatus, 'old_status' => $oldStatus]);
        echo "Updated orders from '{$oldStatus}' to '{$newStatus}': " . $stmt->rowCount() . " rows<br>";
    }
    
    // Now alter the enum type
    // Note: MySQL doesn't support direct enum modification, so we need to recreate the column
    $pdo->exec("ALTER TABLE orders MODIFY COLUMN status ENUM('Waiting Payment','Processing','Ready') NOT NULL");
    
    echo "<br>Successfully updated order status enum to: 'Waiting Payment', 'Processing', 'Ready'<br>";
    echo "All existing orders have been mapped to the new status values.<br>";
    
} catch (PDOException $e) {
    echo "Error updating order status enum: " . $e->getMessage() . "<br>";
    echo "Please run this script manually or check database permissions.<br>";
}
?>

