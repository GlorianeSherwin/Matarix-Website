<?php
/**
 * Check Current Delivery Status Enum
 * Diagnostic script to see what enum values are currently in the database
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Get the current enum values
    $stmt = $pdo->query("
        SELECT COLUMN_TYPE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'deliveries' 
        AND COLUMN_NAME = 'Delivery_Status'
    ");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Extract enum values
    $enumString = $result['COLUMN_TYPE'] ?? '';
    preg_match_all("/'([^']+)'/", $enumString, $matches);
    $enumValues = $matches[1] ?? [];
    
    // Get a sample of current delivery statuses
    $stmt = $pdo->query("SELECT Delivery_ID, Delivery_Status FROM deliveries ORDER BY Delivery_ID DESC LIMIT 10");
    $sampleDeliveries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Expected values
    $expectedValues = ['Pending', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];
    $missingValues = array_diff($expectedValues, $enumValues);
    
    echo json_encode([
        'success' => true,
        'current_enum' => $enumString,
        'current_enum_values' => $enumValues,
        'default_value' => $result['COLUMN_DEFAULT'] ?? 'Pending',
        'expected_values' => $expectedValues,
        'missing_values' => array_values($missingValues),
        'needs_update' => !empty($missingValues),
        'sample_deliveries' => $sampleDeliveries,
        'fix_url' => 'http://localhost/MatarixWEBs/api/fix_delivery_status_enum.php'
    ], JSON_PRETTY_PRINT);
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
?>

