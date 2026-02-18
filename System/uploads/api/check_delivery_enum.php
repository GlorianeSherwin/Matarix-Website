<?php
/**
 * Check Delivery Status Enum
 * Verifies the current enum values in the database
 */

header('Content-Type: application/json');

require_once __DIR__ . '/../includes/db_functions.php';

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Get the current enum values
    $stmt = $pdo->query("
        SELECT COLUMN_TYPE 
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
    
    // Get a sample delivery to see current status
    $stmt = $pdo->query("SELECT Delivery_ID, Delivery_Status FROM deliveries LIMIT 5");
    $sampleDeliveries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'enum_type' => $enumString,
        'enum_values' => $enumValues,
        'sample_deliveries' => $sampleDeliveries,
        'expected_values' => ['Pending', 'preparing', 'out for delivery', 'On the Way', 'Delivered', 'Cancelled']
    ], JSON_PRETTY_PRINT);
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
?>

