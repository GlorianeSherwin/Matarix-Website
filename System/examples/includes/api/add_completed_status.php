<?php
/**
 * Migration: Add 'Completed' status to orders table for Pick Up orders
 * Run this once: php add_completed_status.php or visit via browser
 */

require_once __DIR__ . '/../includes/db_functions.php';

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    $pdo->exec("ALTER TABLE orders MODIFY COLUMN status ENUM('Pending Approval','Waiting Payment','Processing','Ready','Rejected','Completed') NOT NULL DEFAULT 'Pending Approval'");
    echo "Success: Added 'Completed' status to orders table.\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
