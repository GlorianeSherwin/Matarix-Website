<?php
/**
 * Get All Customer Feedback API Endpoint
 * Returns all customer feedback and reviews for admin view
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// Check if user is logged in and is Admin
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Not authenticated'
    ]);
    exit;
}

// Check if user has admin privileges
$userRole = $_SESSION['user_role'] ?? '';
if (!in_array($userRole, ['Admin', 'Store Employee'])) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Access denied. Admin privileges required.'
    ]);
    exit;
}

// Initialize database functions
$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Get filters
    $ratingFilter = isset($_GET['rating']) ? (int)$_GET['rating'] : null;
    $timeFilter = isset($_GET['time']) ? $_GET['time'] : '';
    
    // Build date filter
    $dateFilter = '';
    $dateParams = [];
    if ($timeFilter === 'week') {
        $dateFilter = 'AND DATE(cf.Created_At) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } elseif ($timeFilter === 'month') {
        $dateFilter = 'AND DATE(cf.Created_At) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    } elseif ($timeFilter === 'year') {
        $dateFilter = 'AND DATE(cf.Created_At) >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)';
    }
    
    // Build rating filter
    $ratingFilterSQL = '';
    if ($ratingFilter !== null && $ratingFilter >= 1 && $ratingFilter <= 5) {
        $ratingFilterSQL = 'AND cf.Rating = :rating';
    }
    
    // Check if customer_feedback table exists (this is for overall order feedback)
    $stmt = $pdo->query("SHOW TABLES LIKE 'customer_feedback'");
    $tableExists = $stmt->rowCount() > 0;
    
    if (!$tableExists) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'customer_feedback table does not exist'
        ]);
        exit;
    }
    
    // Get all customer feedback (overall order feedback) with customer and order details
    $sql = "
        SELECT 
            cf.Feedback_ID,
            cf.Delivery_ID,
            cf.Rating,
            cf.Message,
            cf.Created_At,
            cf.is_Anonymous,
            d.Order_ID,
            o.order_date,
            o.amount as order_total,
            CONCAT(u.First_Name, ' ', COALESCE(u.Middle_Name, ''), ' ', u.Last_Name) as customer_name,
            u.First_Name,
            u.Middle_Name,
            u.Last_Name,
            u.email,
            u.User_ID
        FROM customer_feedback cf
        INNER JOIN deliveries d ON cf.Delivery_ID = d.Delivery_ID
        INNER JOIN orders o ON d.Order_ID = o.Order_ID
        INNER JOIN users u ON o.User_ID = u.User_ID
        WHERE 1=1
        {$ratingFilterSQL}
        {$dateFilter}
        ORDER BY cf.Created_At DESC
    ";
    
    $stmt = $pdo->prepare($sql);
    $params = [];
    if ($ratingFilter !== null && $ratingFilter >= 1 && $ratingFilter <= 5) {
        $params['rating'] = $ratingFilter;
    }
    $stmt->execute($params);
    $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Calculate statistics
    $totalReviews = count($reviews);
    $totalRating = 0;
    $ratingCounts = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
    
    foreach ($reviews as $review) {
        $rating = (int)$review['Rating'];
        $totalRating += $rating;
        if (isset($ratingCounts[$rating])) {
            $ratingCounts[$rating]++;
        }
    }
    
    $averageRating = $totalReviews > 0 ? round($totalRating / $totalReviews, 1) : 0;
    $satisfactionRate = $totalReviews > 0 ? round((($ratingCounts[4] + $ratingCounts[5]) / $totalReviews) * 100, 1) : 0;
    
    // Format reviews (customer feedback - overall order feedback)
    $formattedReviews = [];
    foreach ($reviews as $review) {
        // Handle anonymous feedback
        $isAnonymous = (bool)($review['is_Anonymous'] ?? false);
        $customerName = 'Anonymous';
        
        if (!$isAnonymous) {
            $customerName = trim($review['customer_name']);
            if (empty($customerName)) {
                $customerName = trim(($review['First_Name'] ?? '') . ' ' . ($review['Middle_Name'] ?? '') . ' ' . ($review['Last_Name'] ?? ''));
            }
            if (empty($customerName)) {
                $customerName = 'Anonymous';
            }
        }
        
        $formattedReviews[] = [
            'feedback_id' => (int)$review['Feedback_ID'],
            'delivery_id' => (int)$review['Delivery_ID'],
            'order_id' => (int)$review['Order_ID'],
            'customer_name' => $customerName,
            'customer_id' => (int)$review['User_ID'],
            'rating' => (int)$review['Rating'],
            'review_text' => $review['Message'] ?? '',
            'order_date' => $review['order_date'],
            'order_total' => (float)($review['order_total'] ?? 0),
            'is_anonymous' => $isAnonymous,
            'created_at' => $review['Created_At']
        ];
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'statistics' => [
            'average_rating' => $averageRating,
            'total_reviews' => $totalReviews,
            'satisfaction_rate' => $satisfactionRate,
            'rating_distribution' => $ratingCounts
        ],
        'reviews' => $formattedReviews
    ]);
    
} catch (Exception $e) {
    error_log("Get All Feedback API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching feedback.'
    ]);
}
?>

