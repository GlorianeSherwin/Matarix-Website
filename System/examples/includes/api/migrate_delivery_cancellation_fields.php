<?php
/**
 * Database Migration: Add Cancellation and Reschedule Fields to Deliveries Table
 * Creates necessary fields for tracking delivery cancellations and reschedules
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    $pdo->beginTransaction();
    $results = [];

    // Check if columns already exist
    $checkColumns = $pdo->query("SHOW COLUMNS FROM deliveries LIKE 'cancellation_reason'");
    $hasCancellationReason = $checkColumns->rowCount() > 0;

    if (!$hasCancellationReason) {
        // Add cancellation tracking fields
        $pdo->exec("
            ALTER TABLE deliveries 
            ADD COLUMN cancellation_reason VARCHAR(255) DEFAULT NULL COMMENT 'Reason for cancellation',
            ADD COLUMN cancelled_by INT(11) DEFAULT NULL COMMENT 'User_ID of employee/admin who cancelled',
            ADD COLUMN cancelled_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when delivery was cancelled',
            ADD COLUMN internal_notes TEXT DEFAULT NULL COMMENT 'Internal notes for staff (not visible to customer)',
            ADD COLUMN reschedule_count INT(11) DEFAULT 0 COMMENT 'Number of times this delivery has been rescheduled',
            ADD COLUMN last_rescheduled_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp of last reschedule'
        ");
        $results[] = "Added cancellation and reschedule tracking fields to deliveries table.";
    } else {
        $results[] = "Cancellation fields already exist, skipping creation.";
    }

    // Check if foreign key exists
    $checkFK = $pdo->query("
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'deliveries' 
        AND CONSTRAINT_NAME = 'fk_deliveries_cancelled_by'
    ");
    $hasFK = $checkFK->rowCount() > 0;

    if (!$hasFK) {
        try {
            // Add foreign key for cancelled_by
            $pdo->exec("
                ALTER TABLE deliveries 
                ADD CONSTRAINT fk_deliveries_cancelled_by 
                FOREIGN KEY (cancelled_by) REFERENCES users(User_ID) ON DELETE SET NULL
            ");
            $results[] = "Added foreign key constraint for cancelled_by.";
        } catch (PDOException $e) {
            // Foreign key might fail if constraint name exists or data issues
            $results[] = "Foreign key constraint skipped: " . $e->getMessage();
        }
    } else {
        $results[] = "Foreign key constraint already exists, skipping.";
    }

    // Check if indexes exist
    $checkIndex1 = $pdo->query("SHOW INDEX FROM deliveries WHERE Key_name = 'idx_deliveries_cancelled'");
    $hasIndex1 = $checkIndex1->rowCount() > 0;

    if (!$hasIndex1) {
        $pdo->exec("CREATE INDEX idx_deliveries_cancelled ON deliveries(cancelled_at, Delivery_Status)");
        $results[] = "Created index idx_deliveries_cancelled.";
    } else {
        $results[] = "Index idx_deliveries_cancelled already exists, skipping.";
    }

    $checkIndex2 = $pdo->query("SHOW INDEX FROM deliveries WHERE Key_name = 'idx_deliveries_reschedule'");
    $hasIndex2 = $checkIndex2->rowCount() > 0;

    if (!$hasIndex2) {
        $pdo->exec("CREATE INDEX idx_deliveries_reschedule ON deliveries(reschedule_count, last_rescheduled_at)");
        $results[] = "Created index idx_deliveries_reschedule.";
    } else {
        $results[] = "Index idx_deliveries_reschedule already exists, skipping.";
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Migration completed successfully',
        'results' => $results
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Migration Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage()
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
