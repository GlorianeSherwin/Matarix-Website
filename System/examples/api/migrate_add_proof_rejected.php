<?php
/**
 * Add proof_rejected column to transactions table
 * Tracks when proof of payment was rejected so customer sees "Update proof of payment" tag
 */

require_once __DIR__ . '/../includes/db_functions.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$db = new DatabaseFunctions();

try {
    $pdo = $db->getConnection();
    
    $check = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'proof_rejected'");
    if ($check->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Column proof_rejected already exists']);
        exit;
    }
    
    $pdo->exec("ALTER TABLE transactions ADD COLUMN proof_rejected TINYINT(1) DEFAULT 0 AFTER proof_of_payment");
    
    echo json_encode([
        'success' => true,
        'message' => 'proof_rejected column added to transactions table'
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
}
