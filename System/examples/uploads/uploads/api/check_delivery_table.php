<?php
/**
 * Check Delivery Table Structure
 * This script checks the current state of the deliveries table
 * 
 * Access via: http://localhost/MatarixWEBs/api/check_delivery_table.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Check for Delivery_ID = 0
    $stmt = $pdo->query("SELECT * FROM deliveries WHERE Delivery_ID = 0");
    $zeroRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get table structure
    $stmt = $pdo->query("SHOW CREATE TABLE deliveries");
    $tableInfo = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Get AUTO_INCREMENT value
    $stmt = $pdo->query("SHOW TABLE STATUS LIKE 'deliveries'");
    $tableStatus = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Get max Delivery_ID
    $stmt = $pdo->query("SELECT MAX(Delivery_ID) as max_id FROM deliveries");
    $maxResult = $stmt->fetch(PDO::FETCH_ASSOC);
    $maxId = $maxResult['max_id'] ?? 0;
    
    // Get all Delivery_IDs
    $stmt = $pdo->query("SELECT Delivery_ID FROM deliveries ORDER BY Delivery_ID");
    $allIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo json_encode([
        'success' => true,
        'issues_found' => [
            'has_zero_id' => count($zeroRecords) > 0,
            'zero_records' => $zeroRecords,
            'auto_increment_enabled' => strpos($tableInfo['Create Table'] ?? '', 'AUTO_INCREMENT') !== false,
            'current_auto_increment' => $tableStatus['Auto_increment'] ?? 'N/A',
            'max_delivery_id' => (int)$maxId,
            'total_records' => count($allIds),
            'all_delivery_ids' => $allIds
        ],
        'table_structure' => $tableInfo['Create Table'] ?? 'N/A',
        'recommendation' => count($zeroRecords) > 0 
            ? 'Run fix_delivery_id_issue.php to fix this problem'
            : 'Table structure looks okay'
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    error_log("Check Delivery Table Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to check table: ' . $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
?>

