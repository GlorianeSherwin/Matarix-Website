<?php
/**
 * Test SMS Notification System
 * Use this to test if SMS is working correctly
 */

require_once __DIR__ . '/../connection.php';
require_once __DIR__ . '/../includes/SemaphoreSMS.php';

header('Content-Type: application/json');

// Get test parameters
$testPhone = $_GET['phone'] ?? null;
$orderId = $_GET['order_id'] ?? null;

if (!$testPhone || !$orderId) {
    echo json_encode([
        'success' => false,
        'message' => 'Usage: test_sms.php?phone=09XXXXXXXXX&order_id=123',
        'example' => 'test_sms.php?phone=09123456789&order_id=1'
    ]);
    exit;
}

try {
    // Initialize SMS sender
    $sms = new SemaphoreSMS($pdo);
    
    // Test all three notification types
    $results = [];
    
    // Test 1: Preparing Order
    echo "Testing 'Preparing Order' notification...\n";
    $result1 = $sms->sendSMS(
        $testPhone,
        "Hi Customer! Your Matarix order #{$orderId} is now being prepared. We'll notify you when it's on the way!",
        $orderId,
        'Preparing'
    );
    $results['preparing'] = $result1;
    
    // Wait 2 seconds between messages
    sleep(2);
    
    // Test 2: Out for Delivery
    echo "Testing 'Out for Delivery' notification...\n";
    $result2 = $sms->sendSMS(
        $testPhone,
        "Hi Customer! Your Matarix order #{$orderId} is now out for delivery! Your order should arrive soon.",
        $orderId,
        'Out for Delivery'
    );
    $results['out_for_delivery'] = $result2;
    
    // Wait 2 seconds between messages
    sleep(2);
    
    // Test 3: Delivered
    echo "Testing 'Delivered' notification...\n";
    $result3 = $sms->sendSMS(
        $testPhone,
        "Hi Customer! Your Matarix order #{$orderId} has been successfully delivered. Thank you for choosing Matarix!",
        $orderId,
        'Delivered'
    );
    $results['delivered'] = $result3;
    
    // Check logs
    $stmt = $pdo->prepare("
        SELECT * FROM sms_logs 
        WHERE order_id = :order_id 
        ORDER BY sent_at DESC 
        LIMIT 3
    ");
    $stmt->execute(['order_id' => $orderId]);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'message' => 'SMS test completed',
        'phone_number' => $testPhone,
        'order_id' => $orderId,
        'results' => $results,
        'logs' => $logs
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Test failed: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
}
