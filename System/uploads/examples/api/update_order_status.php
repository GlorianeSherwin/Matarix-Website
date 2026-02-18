<?php
/**
 * Update Order Status API
 * Updates the status of an order
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: order editing/status updates (Store Employee + Admin)
rbac_require_permission_api('orders.edit');

$data = json_decode(file_get_contents('php://input'), true);
$orderId = $data['order_id'] ?? null;
$status = $data['status'] ?? null;

if (!$orderId || !$status) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Order ID and status are required'
    ]);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Validate status value first (before starting transaction)
    $validStatuses = ['Waiting Payment', 'Processing', 'Ready'];
    if (!in_array($status, $validStatuses)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid status value. Must be one of: ' . implode(', ', $validStatuses)
        ]);
        exit;
    }
    
    // Start transaction
    $pdo->beginTransaction();
    
    // Get current order status and delivery method before updating
    $checkDeliveryMethodColumn = $pdo->query("SHOW COLUMNS FROM orders LIKE 'delivery_method'")->rowCount() > 0;
    
    if ($checkDeliveryMethodColumn) {
        $stmt = $pdo->prepare("SELECT status, delivery_method FROM orders WHERE Order_ID = :order_id");
    } else {
        $stmt = $pdo->prepare("SELECT status FROM orders WHERE Order_ID = :order_id");
    }
    $stmt->execute(['order_id' => (int)$orderId]);
    $currentOrder = $stmt->fetch();
    
    if (!$currentOrder) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Order not found'
        ]);
        exit;
    }
    
    $previousStatus = $currentOrder['status'];
    $deliveryMethod = $checkDeliveryMethodColumn ? ($currentOrder['delivery_method'] ?? 'Standard Delivery') : 'Standard Delivery';
    $isChangingToReady = ($status === 'Ready' && $previousStatus !== 'Ready');
    $isPickupOrder = ($deliveryMethod === 'Pick Up');
    
    // Update order status
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET status = :status,
            last_updated = NOW()
        WHERE Order_ID = :order_id
    ");
    $result = $stmt->execute([
        'status' => $status,
        'order_id' => (int)$orderId
    ]);
    
    if (!$result || $stmt->rowCount() === 0) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Order not found or no changes made'
        ]);
        exit;
    }
    
    // If changing to "Ready", reduce stock levels and ensure delivery record exists
    if ($isChangingToReady) {
        // Get all order items
        $stmt = $pdo->prepare("
            SELECT Product_ID, Quantity 
            FROM transaction_items 
            WHERE Order_ID = :order_id
        ");
        $stmt->execute(['order_id' => (int)$orderId]);
        $orderItems = $stmt->fetchAll();
        
        if (empty($orderItems)) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Order has no items'
            ]);
            exit;
        }
        
        // Reduce stock for each product
        foreach ($orderItems as $item) {
            $productId = $item['Product_ID'];
            $quantity = (int)$item['Quantity'];
            
            // Update stock level
            $stmt = $pdo->prepare("
                UPDATE products 
                SET stock_level = stock_level - :quantity
                WHERE Product_ID = :product_id
            ");
            $stmt->execute([
                'quantity' => $quantity,
                'product_id' => $productId
            ]);
            
            // Update stock status based on new stock level
            $stmt = $pdo->prepare("
                UPDATE products 
                SET stock_status = CASE
                    WHEN stock_level <= 0 THEN 'Out of Stock'
                    WHEN stock_level <= Minimum_Stock THEN 'Low Stock'
                    ELSE 'In Stock'
                END
                WHERE Product_ID = :product_id
            ");
            $stmt->execute(['product_id' => $productId]);
        }
        
        // Only create/update delivery record if order is NOT a pickup order
        // Pickup orders don't need delivery records
        if (!$isPickupOrder) {
            // Ensure delivery record exists for Ready orders and set status to 'Preparing'
            $stmt = $pdo->prepare("SELECT Delivery_ID, Delivery_Status FROM deliveries WHERE Order_ID = :order_id LIMIT 1");
            $stmt->execute(['order_id' => (int)$orderId]);
            $existingDelivery = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$existingDelivery) {
                // Create delivery record with 'Preparing' status (order is ready for delivery)
                $stmt = $pdo->prepare("
                    INSERT INTO deliveries (Order_ID, Delivery_Status, Created_At, Updated_At)
                    VALUES (:order_id, 'Preparing', NOW(), NOW())
                ");
                $stmt->execute(['order_id' => (int)$orderId]);
                error_log("Created delivery record with 'Preparing' status for Order_ID: {$orderId} when status changed to Ready");
            } else {
                // Update delivery status to 'Preparing' if it's 'Pending' or still 'Pending'
                // This ensures the delivery is ready to be assigned to a driver
                $currentDeliveryStatus = $existingDelivery['Delivery_Status'] ?? 'Pending';
                if ($currentDeliveryStatus === 'Pending') {
                    $stmt = $pdo->prepare("
                        UPDATE deliveries 
                        SET Delivery_Status = 'Preparing',
                            Updated_At = NOW()
                        WHERE Order_ID = :order_id
                    ");
                    $stmt->execute(['order_id' => (int)$orderId]);
                    error_log("Updated delivery status to 'Preparing' for Order_ID: {$orderId} when order became Ready");
                }
            }
        }
    }
    
    // Commit transaction
    $pdo->commit();
    
    // Get customer info for notifications
    $customerStmt = $pdo->prepare("SELECT u.User_ID, u.First_Name, u.Middle_Name, u.Last_Name FROM orders o JOIN users u ON o.User_ID = u.User_ID WHERE o.Order_ID = :order_id");
    $customerStmt->execute(['order_id' => (int)$orderId]);
    $customer = $customerStmt->fetch(PDO::FETCH_ASSOC);
    $customerName = trim(($customer['First_Name'] ?? '') . ' ' . ($customer['Middle_Name'] ?? '') . ' ' . ($customer['Last_Name'] ?? ''));
    $customerUserId = $customer['User_ID'] ?? null;
    
    // Create admin notification for order status change
    require_once __DIR__ . '/create_admin_activity_notification.php';
    createAdminActivityNotification($pdo, 'order_status_changed', [
        'order_id' => (int)$orderId,
        'customer_name' => $customerName,
        'new_status' => $status,
        'message' => "Order #{$orderId} status changed to {$status}" . ($customerName ? " (Customer: {$customerName})" : '')
    ]);
    
    // Create customer notification for order status change
    if ($customerUserId) {
        require_once __DIR__ . '/create_customer_notification.php';
        $customerActivityType = 'order_status_changed';
        $customerMessage = "Your order #{$orderId} status has been updated to {$status}";
        
        // Map status to more customer-friendly activity types
        if ($status === 'Ready') {
            if ($isPickupOrder) {
                $customerActivityType = 'order_ready_pickup';
                $customerMessage = "Your order #{$orderId} is ready for pickup!";
            } else {
                $customerActivityType = 'order_ready';
                $customerMessage = "Your order #{$orderId} is ready for delivery!";
            }
        } elseif ($status === 'Processing') {
            $customerActivityType = 'order_processing';
            $customerMessage = "Your order #{$orderId} is now being processed";
        }
        
        createCustomerNotification($pdo, $customerUserId, $customerActivityType, [
            'order_id' => (int)$orderId,
            'new_status' => $status,
            'message' => $customerMessage
        ]);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Order status updated successfully' . ($isChangingToReady ? '. Stock levels have been reduced.' : ''),
        'order_id' => $orderId,
        'new_status' => $status,
        'stock_reduced' => $isChangingToReady
    ]);
    
} catch (PDOException $e) {
    $pdo->rollBack();
    error_log("Update Order Status Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update order status: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    error_log("Update Order Status Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update order status: ' . $e->getMessage()
    ]);
}
?>

