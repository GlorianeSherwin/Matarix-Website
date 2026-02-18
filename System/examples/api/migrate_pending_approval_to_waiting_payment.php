<?php
/**
 * One-time migration: Update all "Pending Approval" orders to "Waiting Payment"
 * Run this once after removing the approval workflow.
 * Access: Visit this URL once while logged in as admin (or run via browser/cron)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// Optional: require admin (comment out if running from CLI/cron)
if (!isset($_SESSION['user_id']) || ($_SESSION['user_role'] ?? '') !== 'Admin') {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Admin access required. Log in as Admin and visit this URL.'
    ]);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Update all Pending Approval orders to Waiting Payment
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET status = 'Waiting Payment', 
            last_updated = NOW()
        WHERE status = 'Pending Approval'
    ");
    $stmt->execute();
    $affected = $stmt->rowCount();
    
    echo json_encode([
        'success' => true,
        'message' => "Migration complete. Updated {$affected} order(s) from 'Pending Approval' to 'Waiting Payment'.",
        'rows_updated' => $affected
    ]);
} catch (Exception $e) {
    error_log("Migration error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage()
    ]);
}
