<?php
/**
 * Create Missing Delivery Records
 * Creates delivery records for orders that don't have one yet
 * Run this once to fix existing orders
 * 
 * Access via: http://localhost/MatarixWEBs/api/create_missing_deliveries.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // First, ensure Delivery_ID has AUTO_INCREMENT
    try {
        $pdo->exec("
            ALTER TABLE deliveries 
            MODIFY COLUMN Delivery_ID int(11) NOT NULL AUTO_INCREMENT
        ");
        echo json_encode(['info' => 'Delivery_ID AUTO_INCREMENT enabled']) . "\n";
    } catch (PDOException $e) {
        // Might already be set, that's okay
        error_log("AUTO_INCREMENT check: " . $e->getMessage());
    }
    
    // Find all orders that don't have a delivery record
    $stmt = $pdo->query("
        SELECT o.Order_ID 
        FROM orders o
        LEFT JOIN deliveries d ON o.Order_ID = d.Order_ID
        WHERE d.Delivery_ID IS NULL
        ORDER BY o.Order_ID
    ");
    $ordersWithoutDelivery = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($ordersWithoutDelivery)) {
        echo json_encode([
            'success' => true,
            'message' => 'All orders already have delivery records',
            'created' => 0,
            'total_orders' => 0
        ], JSON_PRETTY_PRINT);
        exit;
    }
    
    $created = 0;
    $errors = [];
    
    $pdo->beginTransaction();
    
    foreach ($ordersWithoutDelivery as $order) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO deliveries (Order_ID, Delivery_Status, Created_At, Updated_At)
                VALUES (:order_id, 'Pending', NOW(), NOW())
            ");
            $stmt->execute(['order_id' => $order['Order_ID']]);
            $created++;
        } catch (PDOException $e) {
            $errors[] = "Order {$order['Order_ID']}: " . $e->getMessage();
            error_log("Error creating delivery for order {$order['Order_ID']}: " . $e->getMessage());
        }
    }
    
    $pdo->commit();
    
    // Get total count
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM deliveries");
    $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    echo json_encode([
        'success' => true,
        'message' => "Created {$created} delivery records for existing orders",
        'created' => $created,
        'total_deliveries' => $total,
        'errors' => $errors,
        'orders_processed' => count($ordersWithoutDelivery)
    ], JSON_PRETTY_PRINT);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Create Missing Deliveries Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to create delivery records: ' . $e->getMessage(),
        'error_details' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
?>

