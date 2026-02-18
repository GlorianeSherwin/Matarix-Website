<?php
/**
 * Get Customer Delivery Proof API
 * Returns delivery proof information for a customer's own order
 * This is a customer-facing endpoint that doesn't require admin permissions
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

// Start customer session
if (session_status() === PHP_SESSION_NONE) {
    startSession('customer');
}

// Get order_id from query parameter
$orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;

if (!$orderId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Order ID is required'
    ]);
    exit;
}

// Get the customer's user ID from session
$customerId = $_SESSION['user_id'] ?? null;

if (!$customerId) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Not authenticated. Please log in.'
    ]);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    // First verify the order belongs to this customer
    $orderCheckStmt = $pdo->prepare("
        SELECT Order_ID, User_ID 
        FROM orders 
        WHERE Order_ID = :order_id
    ");
    $orderCheckStmt->execute(['order_id' => $orderId]);
    $order = $orderCheckStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$order) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Order not found'
        ]);
        exit;
    }
    
    // Verify order ownership
    if ((int)$order['User_ID'] !== (int)$customerId) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Access denied: This order does not belong to you'
        ]);
        exit;
    }
    
    // Get delivery information for the order
    $stmt = $pdo->prepare("
        SELECT 
            d.Delivery_ID,
            d.Order_ID,
            d.Delivery_Status,
            d.delivery_details,
            d.Created_At,
            d.Updated_At
        FROM deliveries d
        WHERE d.Order_ID = :order_id
        ORDER BY d.Created_At DESC
        LIMIT 1
    ");
    
    $stmt->execute(['order_id' => $orderId]);
    $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($delivery) {
        // Parse delivery details to get proof image
        $deliveryDetails = null;
        if (!empty($delivery['delivery_details'])) {
            if (is_string($delivery['delivery_details'])) {
                $deliveryDetails = json_decode($delivery['delivery_details'], true);
            } else {
                $deliveryDetails = $delivery['delivery_details'];
            }
        }
        
        $proofImage = null;
        if ($deliveryDetails && isset($deliveryDetails['proof_image'])) {
            $proofImage = $deliveryDetails['proof_image'];
        }
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'delivery' => [
                'Delivery_ID' => (int)$delivery['Delivery_ID'],
                'Order_ID' => (int)$delivery['Order_ID'],
                'Delivery_Status' => $delivery['Delivery_Status'] ?? 'Pending',
                'delivery_details' => $delivery['delivery_details'] ?? null,
                'proof_image' => $proofImage,
                'Created_At' => $delivery['Created_At'] ?? null,
                'Updated_At' => $delivery['Updated_At'] ?? null
            ]
        ]);
    } else {
        // No delivery record exists yet
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'delivery' => null,
            'message' => 'No delivery record found for this order'
        ]);
    }
    
} catch (Exception $e) {
    error_log("Get Customer Delivery Proof API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching delivery information'
    ]);
}
?>
