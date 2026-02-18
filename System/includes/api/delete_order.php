<?php
/**
 * Delete Order API
 * Deletes an order and all related records (deliveries, transactions, transaction_items)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// Check if user is logged in and has permission (Admin or Store Employee)
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'User not authenticated'
    ]);
    exit;
}

$userRole = $_SESSION['user_role'] ?? '';
if (!in_array($userRole, ['Admin', 'Store Employee'])) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Access denied. Only admins and store employees can delete orders.'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$orderId = $data['order_id'] ?? null;

if (!$orderId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Order ID is required'
    ]);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    $pdo->beginTransaction();
    
    // Verify order exists
    $stmt = $pdo->prepare("SELECT Order_ID, payment FROM orders WHERE Order_ID = :order_id");
    $stmt->execute(['order_id' => $orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$order) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Order not found'
        ]);
        $pdo->rollBack();
        exit;
    }
    
    // If order was paid, restore stock before deleting (hybrid: variation or product)
    if ($order['payment'] === 'Paid') {
        $hasVariationId = $pdo->query("SHOW COLUMNS FROM transaction_items LIKE 'Variation_ID'")->rowCount() > 0;
        $cols = 'Product_ID, Quantity';
        if ($hasVariationId) $cols .= ', Variation_ID';
        $stmt = $pdo->prepare("SELECT {$cols} FROM transaction_items WHERE Order_ID = :order_id");
        $stmt->execute(['order_id' => $orderId]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($items as $item) {
            $productId = $item['Product_ID'];
            $quantity = (int)$item['Quantity'];
            $variationId = ($hasVariationId && !empty($item['Variation_ID'])) ? (int)$item['Variation_ID'] : null;
            $restoreToVariation = false;
            if ($variationId) {
                $vStmt = $pdo->prepare("SELECT stock_level FROM product_variations WHERE Variation_ID = :vid");
                $vStmt->execute(['vid' => $variationId]);
                $var = $vStmt->fetch(PDO::FETCH_ASSOC);
                if ($var && $var['stock_level'] !== null && $var['stock_level'] !== '') {
                    $restoreToVariation = true;
                    $pdo->prepare("UPDATE product_variations SET stock_level = stock_level + :qty WHERE Variation_ID = :vid")
                        ->execute(['qty' => $quantity, 'vid' => $variationId]);
                }
            }
            if (!$restoreToVariation) {
                $stmt = $pdo->prepare("UPDATE products SET stock_level = stock_level + :quantity WHERE Product_ID = :product_id");
                $stmt->execute(['quantity' => $quantity, 'product_id' => $productId]);
                $stmt = $pdo->prepare("UPDATE products SET stock_status = CASE WHEN stock_level <= 0 THEN 'Out of Stock' WHEN stock_level <= Minimum_Stock THEN 'Low Stock' ELSE 'In Stock' END WHERE Product_ID = :product_id");
                $stmt->execute(['product_id' => $productId]);
            }
        }
    }
    
    // Delete related records in correct order (to respect foreign key constraints)
    // 1. Delete transaction items
    $stmt = $pdo->prepare("DELETE FROM transaction_items WHERE Order_ID = :order_id");
    $stmt->execute(['order_id' => $orderId]);
    
    // 2. Delete deliveries
    $stmt = $pdo->prepare("DELETE FROM deliveries WHERE Order_ID = :order_id");
    $stmt->execute(['order_id' => $orderId]);
    
    // 3. Delete transactions
    $stmt = $pdo->prepare("DELETE FROM transactions WHERE Order_ID = :order_id");
    $stmt->execute(['order_id' => $orderId]);
    
    // 4. Delete the order itself
    $stmt = $pdo->prepare("DELETE FROM orders WHERE Order_ID = :order_id");
    $stmt->execute(['order_id' => $orderId]);
    
    if ($stmt->rowCount() === 0) {
        throw new Exception('Failed to delete order');
    }
    
    $pdo->commit();
    
    error_log("Order deleted successfully: Order_ID {$orderId} by user {$_SESSION['user_id']}");
    
    echo json_encode([
        'success' => true,
        'message' => 'Order deleted successfully',
        'order_id' => $orderId
    ]);
    
} catch (PDOException $e) {
    $pdo->rollBack();
    error_log("Delete Order Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to delete order: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    error_log("Delete Order Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to delete order: ' . $e->getMessage()
    ]);
}
?>

