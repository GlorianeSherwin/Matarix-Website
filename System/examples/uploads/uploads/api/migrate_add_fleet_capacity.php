<?php
/**
 * Database Migration: Add Capacity Columns to Fleet Table
 * Adds capacity and capacity_unit columns to the fleet table
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    $pdo->beginTransaction();
    $results = [];

    // Check and add 'capacity' column
    $checkCapacityColumn = $pdo->query("SHOW COLUMNS FROM fleet LIKE 'capacity'");
    if ($checkCapacityColumn->rowCount() == 0) {
        $pdo->exec("ALTER TABLE fleet ADD COLUMN capacity DECIMAL(10,2) NULL AFTER status");
        $results[] = "Added 'capacity' column to fleet table.";
    } else {
        $results[] = "'capacity' column already exists, skipping.";
    }

    // Check and add 'capacity_unit' column
    $checkCapacityUnitColumn = $pdo->query("SHOW COLUMNS FROM fleet LIKE 'capacity_unit'");
    if ($checkCapacityUnitColumn->rowCount() == 0) {
        $pdo->exec("ALTER TABLE fleet ADD COLUMN capacity_unit ENUM('kg','g','lb','oz','ton') NULL DEFAULT 'kg' AFTER capacity");
        $results[] = "Added 'capacity_unit' column to fleet table with default 'kg'.";
    } else {
        $results[] = "'capacity_unit' column already exists, skipping.";
    }

    // Update existing records to have default capacity_unit = 'kg' if NULL
    $pdo->exec("UPDATE fleet SET capacity_unit = 'kg' WHERE capacity_unit IS NULL");
    
    // Update status enum to include 'Unavailable'
    try {
        $checkStatusColumn = $pdo->query("SHOW COLUMNS FROM fleet LIKE 'status'");
        if ($checkStatusColumn->rowCount() > 0) {
            $statusColumn = $checkStatusColumn->fetch(PDO::FETCH_ASSOC);
            $currentType = $statusColumn['Type'];
            
            // Check if 'Unavailable' is already in the enum
            if (stripos($currentType, 'Unavailable') === false) {
                $pdo->exec("ALTER TABLE fleet MODIFY COLUMN status ENUM('In Use','Available','Unavailable') NOT NULL");
                $results[] = "Updated status enum to include 'Unavailable'.";
            } else {
                $results[] = "Status enum already includes 'Unavailable', skipping.";
            }
        }
    } catch (Exception $e) {
        $results[] = "Note: Could not update status enum: " . $e->getMessage();
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Fleet capacity columns migration completed successfully',
        'results' => $results
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Fleet capacity migration error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred during fleet capacity migration: ' . $e->getMessage()
    ]);
}
?>

