<?php
/**
 * Cancel Booking API Endpoint
 * Allows customers to cancel their delivery bookings
 */

// Start output buffering to prevent any output before headers
ob_start();

// Suppress error display for production
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 
          (isset($_SERVER['HTTP_REFERER']) ? parse_url($_SERVER['HTTP_REFERER'], PHP_URL_SCHEME) . '://' . parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST) : '*');
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/error_handler.php';

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Start session
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Please login.']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Fallback to POST data if JSON is not available
if (!$input) {
    $input = $_POST;
}

// Validate input
if (!isset($input['order_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Order ID is required']);
    exit;
}

$orderId = intval($input['order_id']);
$userId = $_SESSION['user_id'];

try {
    $pdo = new PDO(
        "mysql:host=localhost;port=3306;dbname=u634157906_matarik;charset=utf8mb4",
        'u634157906_matarik',
        'Matarik1234',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    
    // Verify order belongs to user and can be cancelled
    $stmt = $pdo->prepare("
        SELECT Order_ID, status, User_ID 
        FROM orders 
        WHERE Order_ID = :order_id AND User_ID = :user_id
    ");
    $stmt->execute([
        'order_id' => $orderId,
        'user_id' => $userId
    ]);
    $order = $stmt->fetch();
    
    if (!$order) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Order not found or you do not have permission to cancel it']);
        exit;
    }
    
    // Check if order can be cancelled
    $cancellableStatuses = ['Pending Approval', 'Approved', 'Processing'];
    if (!in_array($order['status'], $cancellableStatuses)) {
        http_response_code(400);
        echo json_encode([
            'success' => false, 
            'message' => 'This order cannot be cancelled. Only pending, approved, or processing orders can be cancelled.'
        ]);
        exit;
    }
    
    // Update order status to Cancelled
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET status = 'Cancelled' 
        WHERE Order_ID = :order_id AND User_ID = :user_id
    ");
    $stmt->execute([
        'order_id' => $orderId,
        'user_id' => $userId
    ]);
    
    ob_end_clean();
    echo json_encode([
        'success' => true,
        'message' => 'Booking cancelled successfully'
    ]);
    exit;
    
} catch (PDOException $e) {
    ob_end_clean();
    error_log("Cancel Booking Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred. Please try again later.'
    ]);
    exit;
} catch (Exception $e) {
    ob_end_clean();
    error_log("Cancel Booking Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred. Please try again later.'
    ]);
    exit;
}

