<?php
/**
 * Get Order Reviews API
 * Retrieves reviews for a specific order
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('customer');
}

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'User not authenticated'
    ]);
    exit;
}

$userId = (int)$_SESSION['user_id'];
$orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;

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
    // Verify order belongs to user
    $stmt = $pdo->prepare("SELECT Order_ID, User_ID FROM orders WHERE Order_ID = :order_id");
    $stmt->execute(['order_id' => $orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$order) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Order not found'
        ]);
        exit;
    }
    
    if ((int)$order['User_ID'] !== $userId) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Access denied'
        ]);
        exit;
    }
    
    // Get overall order feedback
    $stmt = $pdo->prepare("
        SELECT cf.Feedback_ID, cf.Rating, cf.Message, cf.Created_At, cf.is_Anonymous
        FROM customer_feedback cf
        JOIN deliveries d ON cf.Delivery_ID = d.Delivery_ID
        WHERE d.Order_ID = :order_id
        LIMIT 1
    ");
    $stmt->execute(['order_id' => $orderId]);
    $overallFeedback = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Get product reviews
    $stmt = $pdo->prepare("
        SELECT pr.Review_ID, pr.Product_ID, pr.Rating, pr.Review_Text, pr.Created_At,
               p.Product_Name
        FROM product_reviews pr
        JOIN products p ON pr.Product_ID = p.Product_ID
        WHERE pr.Order_ID = :order_id AND pr.User_ID = :user_id
    ");
    $stmt->execute([
        'order_id' => $orderId,
        'user_id' => $userId
    ]);
    $productReviews = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'overall_feedback' => $overallFeedback ? [
            'rating' => (int)$overallFeedback['Rating'],
            'message' => $overallFeedback['Message'],
            'created_at' => $overallFeedback['Created_At'],
            'is_anonymous' => (bool)$overallFeedback['is_Anonymous']
        ] : null,
        'product_reviews' => array_map(function($review) {
            return [
                'review_id' => (int)$review['Review_ID'],
                'product_id' => (int)$review['Product_ID'],
                'product_name' => $review['Product_Name'],
                'rating' => (int)$review['Rating'],
                'review_text' => $review['Review_Text'],
                'created_at' => $review['Created_At']
            ];
        }, $productReviews)
    ]);
    
} catch (PDOException $e) {
    error_log("Get Order Reviews Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to retrieve reviews: ' . $e->getMessage()
    ]);
}
?>

