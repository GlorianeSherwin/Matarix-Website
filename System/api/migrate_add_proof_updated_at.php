<?php
/**
 * Add proof_updated_at column to transactions table
 * Set when customer uploads/updates proof of payment; cleared when admin accepts payment
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    $check = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'proof_updated_at'");
    if ($check->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Column proof_updated_at already exists']);
        exit;
    }
    
    $pdo->exec("ALTER TABLE transactions ADD COLUMN proof_updated_at DATETIME NULL DEFAULT NULL AFTER proof_rejected");
    echo json_encode([
        'success' => true,
        'message' => 'proof_updated_at column added to transactions table'
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
