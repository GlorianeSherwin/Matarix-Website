<?php
/**
 * Submit Review API
 * Handles submission of order and product reviews
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

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
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid request data'
    ]);
    exit;
}

$orderId = isset($data['order_id']) ? (int)$data['order_id'] : null;
$overallRating = isset($data['overall_rating']) ? (int)$data['overall_rating'] : null;
$overallFeedback = isset($data['overall_feedback']) ? trim($data['overall_feedback']) : null;
$productRatings = isset($data['product_ratings']) ? $data['product_ratings'] : [];
$isAnonymous = isset($data['is_anonymous']) ? (bool)$data['is_anonymous'] : false;

if (!$orderId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Order ID is required'
    ]);
    exit;
}

// Validate overall rating
if ($overallRating && ($overallRating < 1 || $overallRating > 5)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Overall rating must be between 1 and 5'
    ]);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

// Ensure product_reviews table exists
try {
    $stmt = $pdo->query("SHOW TABLES LIKE 'product_reviews'");
    $tableExists = $stmt->rowCount() > 0;
    
    if (!$tableExists) {
        error_log("[Submit Review] product_reviews table doesn't exist, creating it...");
        // Create table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `product_reviews` (
              `Review_ID` int(11) NOT NULL AUTO_INCREMENT,
              `Order_ID` int(11) NOT NULL,
              `Product_ID` int(11) NOT NULL,
              `User_ID` int(11) NOT NULL,
              `Rating` tinyint(4) NOT NULL CHECK (`Rating` between 1 and 5),
              `Review_Text` text DEFAULT NULL,
              `Created_At` timestamp NOT NULL DEFAULT current_timestamp(),
              `Updated_At` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
              PRIMARY KEY (`Review_ID`),
              KEY `fk_product_reviews_order` (`Order_ID`),
              KEY `fk_product_reviews_product` (`Product_ID`),
              KEY `fk_product_reviews_user` (`User_ID`),
              UNIQUE KEY `unique_order_product_user` (`Order_ID`, `Product_ID`, `User_ID`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        
        // Try to add foreign key constraints
        try {
            $pdo->exec("
                ALTER TABLE `product_reviews`
                ADD CONSTRAINT `fk_product_reviews_order` FOREIGN KEY (`Order_ID`) REFERENCES `orders` (`Order_ID`) ON DELETE CASCADE,
                ADD CONSTRAINT `fk_product_reviews_product` FOREIGN KEY (`Product_ID`) REFERENCES `products` (`Product_ID`) ON DELETE CASCADE,
                ADD CONSTRAINT `fk_product_reviews_user` FOREIGN KEY (`User_ID`) REFERENCES `users` (`User_ID`) ON DELETE CASCADE
            ");
        } catch (PDOException $e) {
            error_log("[Submit Review] Foreign key constraint warning: " . $e->getMessage());
        }
        
        error_log("[Submit Review] product_reviews table created successfully");
    }
} catch (PDOException $e) {
    error_log("[Submit Review] Error checking/creating product_reviews table: " . $e->getMessage());
    // Continue anyway - the insert will fail if table doesn't exist
}

try {
    $pdo->beginTransaction();
    
    // Verify order belongs to user
    $stmt = $pdo->prepare("SELECT Order_ID, User_ID FROM orders WHERE Order_ID = :order_id");
    $stmt->execute(['order_id' => $orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$order) {
        throw new Exception('Order not found');
    }
    
    if ((int)$order['User_ID'] !== $userId) {
        throw new Exception('Order does not belong to user');
    }
    
    // Get delivery ID for this order
    $stmt = $pdo->prepare("SELECT Delivery_ID FROM deliveries WHERE Order_ID = :order_id LIMIT 1");
    $stmt->execute(['order_id' => $orderId]);
    $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $deliveryId = $delivery ? (int)$delivery['Delivery_ID'] : null;
    
    // If no delivery record exists, create one
    if (!$deliveryId || $deliveryId === 0) {
        error_log("[Submit Review] No delivery record found for Order_ID: $orderId, creating one...");
        $stmt = $pdo->prepare("
            INSERT INTO deliveries (Order_ID, Delivery_Status, Created_At, Updated_At)
            VALUES (:order_id, 'Delivered', NOW(), NOW())
        ");
        $stmt->execute(['order_id' => $orderId]);
        $deliveryId = (int)$pdo->lastInsertId();
        error_log("[Submit Review] Created delivery record with Delivery_ID: $deliveryId");
    }
    
    // Submit overall order feedback (using customer_feedback table)
    if ($overallRating && $overallRating > 0) {
        if (!$deliveryId || $deliveryId === 0) {
            error_log("[Submit Review] ERROR: Still no valid Delivery_ID after creation attempt. Order_ID: $orderId");
            throw new Exception('Failed to create or retrieve delivery record');
        }
        
        // Check if feedback already exists
        $stmt = $pdo->prepare("SELECT Feedback_ID FROM customer_feedback WHERE Delivery_ID = :delivery_id");
        $stmt->execute(['delivery_id' => $deliveryId]);
        $existingFeedback = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existingFeedback) {
            // Update existing feedback
            $stmt = $pdo->prepare("
                UPDATE customer_feedback 
                SET Rating = :rating, 
                    Message = :message, 
                    is_Anonymous = :is_anonymous
                WHERE Delivery_ID = :delivery_id
            ");
            $result = $stmt->execute([
                'rating' => $overallRating,
                'message' => $overallFeedback,
                'is_anonymous' => $isAnonymous ? 1 : 0,
                'delivery_id' => $deliveryId
            ]);
            
            if ($result && $stmt->rowCount() > 0) {
                error_log("[Submit Review] Updated customer_feedback for Delivery_ID: $deliveryId, Order_ID: $orderId");
            } else {
                error_log("[Submit Review] WARNING: Update customer_feedback returned 0 rows. Delivery_ID: $deliveryId");
            }
        } else {
            // Insert new feedback
            $stmt = $pdo->prepare("
                INSERT INTO customer_feedback (Delivery_ID, Rating, Message, is_Anonymous)
                VALUES (:delivery_id, :rating, :message, :is_anonymous)
            ");
            $result = $stmt->execute([
                'delivery_id' => $deliveryId,
                'rating' => $overallRating,
                'message' => $overallFeedback,
                'is_anonymous' => $isAnonymous ? 1 : 0
            ]);
            
            if ($result) {
                $feedbackId = $pdo->lastInsertId();
                error_log("[Submit Review] Inserted customer_feedback with Feedback_ID: $feedbackId, Delivery_ID: $deliveryId, Order_ID: $orderId");
            } else {
                error_log("[Submit Review] ERROR: Failed to insert customer_feedback. Delivery_ID: $deliveryId");
                throw new Exception('Failed to insert customer feedback');
            }
        }
    } else {
        error_log("[Submit Review] WARNING: No overall rating provided or rating is 0. Order_ID: $orderId");
    }
    
    // Submit individual product ratings
    if (!empty($productRatings) && is_array($productRatings)) {
        // Get order items to verify products belong to order
        $stmt = $pdo->prepare("
            SELECT Product_ID FROM transaction_items WHERE Order_ID = :order_id
        ");
        $stmt->execute(['order_id' => $orderId]);
        $orderProducts = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        foreach ($productRatings as $productRating) {
            $productId = isset($productRating['product_id']) ? (int)$productRating['product_id'] : null;
            $rating = isset($productRating['rating']) ? (int)$productRating['rating'] : null;
            $reviewText = isset($productRating['review_text']) ? trim($productRating['review_text']) : null;
            
            if (!$productId || !$rating || $rating < 1 || $rating > 5) {
                continue; // Skip invalid ratings
            }
            
            // Verify product is in the order
            if (!in_array($productId, $orderProducts)) {
                continue; // Skip if product not in order
            }
            
            // Check if review already exists
            $stmt = $pdo->prepare("
                SELECT Review_ID FROM product_reviews 
                WHERE Order_ID = :order_id AND Product_ID = :product_id AND User_ID = :user_id
            ");
            $stmt->execute([
                'order_id' => $orderId,
                'product_id' => $productId,
                'user_id' => $userId
            ]);
            $existingReview = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($existingReview) {
                // Update existing review
                $stmt = $pdo->prepare("
                    UPDATE product_reviews 
                    SET Rating = :rating, 
                        Review_Text = :review_text,
                        Updated_At = NOW()
                    WHERE Review_ID = :review_id
                ");
                $stmt->execute([
                    'rating' => $rating,
                    'review_text' => $reviewText,
                    'review_id' => $existingReview['Review_ID']
                ]);
            } else {
                // Insert new review
                $stmt = $pdo->prepare("
                    INSERT INTO product_reviews (Order_ID, Product_ID, User_ID, Rating, Review_Text)
                    VALUES (:order_id, :product_id, :user_id, :rating, :review_text)
                ");
                $stmt->execute([
                    'order_id' => $orderId,
                    'product_id' => $productId,
                    'user_id' => $userId,
                    'rating' => $rating,
                    'review_text' => $reviewText
                ]);
            }
        }
    }
    
    $pdo->commit();
    
    error_log("[Submit Review] Successfully submitted review for Order_ID: $orderId, User_ID: $userId");
    
    echo json_encode([
        'success' => true,
        'message' => 'Review submitted successfully',
        'delivery_id' => $deliveryId,
        'overall_rating' => $overallRating
    ]);
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Submit Review Error: " . $e->getMessage());
    error_log("Submit Review Error - Order_ID: " . ($orderId ?? 'null') . ", User_ID: " . ($userId ?? 'null'));
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to submit review: ' . $e->getMessage()
    ]);
}
?>

