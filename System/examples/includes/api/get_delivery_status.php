<?php
/**
 * Get Delivery Status API
 * Returns delivery status for a specific order
 */

// Start output buffering to prevent any output before headers
ob_start();

// Suppress error display for production
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit;
}

// Try to find active session by checking both admin and customer sessions
$sessionFound = false;
$userId = null;

// First, try admin session
if (session_status() !== PHP_SESSION_NONE) {
    @session_write_close();
}

// Set cookie path to root of application for admin session
require_once __DIR__ . '/../includes/path_helper.php';
$basePath = getBasePath();
$isSecure = isSecure();

session_set_cookie_params([
    'lifetime' => 0,
    'path' => $basePath,
    'domain' => '',
    'secure' => $isSecure,
    'httponly' => true,
    'samesite' => 'Lax'
]);
session_name('MATARIX_ADMIN_SESSION');
@session_start();

if (isset($_SESSION['user_id'])) {
    $sessionFound = true;
    $userId = $_SESSION['user_id'];
} else {
    // Close admin session and try customer session
    @session_write_close();
    
    // Set cookie path to root of application for customer session
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $basePath,
        'domain' => '',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_name('MATARIX_CUSTOMER_SESSION');
    @session_start();
    
    if (isset($_SESSION['user_id'])) {
        $sessionFound = true;
        $userId = $_SESSION['user_id'];
    }
}

if (!$sessionFound || !$userId) {
    ob_end_clean();
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

$orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;

if (!$orderId) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Order ID is required']);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // First verify that the order belongs to the logged-in user
    $verifyStmt = $pdo->prepare("SELECT Order_ID FROM orders WHERE Order_ID = :order_id AND User_ID = :user_id");
    $verifyStmt->execute(['order_id' => $orderId, 'user_id' => $userId]);
    $orderExists = $verifyStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$orderExists) {
        ob_end_clean();
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied: Order does not belong to you']);
        exit;
    }
    
    // Get delivery status for the order (only if order belongs to user)
    // Include driver information for better tracking
    $stmt = $pdo->prepare("
        SELECT 
            d.Delivery_ID,
            d.Order_ID,
            d.Delivery_Status,
            d.delivery_details,
            d.Driver_ID,
            d.Created_At,
            d.Updated_At,
            u.First_Name as Driver_First_Name,
            u.Last_Name as Driver_Last_Name,
            u.Middle_Name as Driver_Middle_Name,
            u.Phone_Number as Driver_Phone_Number,
            u.email as Driver_Email
        FROM deliveries d
        LEFT JOIN users u ON d.Driver_ID = u.User_ID
        WHERE d.Order_ID = :order_id
        ORDER BY d.Created_At DESC
        LIMIT 1
    ");
    $stmt->execute(['order_id' => $orderId]);
    $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($delivery) {
        // Get multiple drivers from junction table if it exists
        $delivery['drivers'] = [];
        if ($delivery['Delivery_ID'] && $delivery['Delivery_ID'] > 0) {
            try {
                $checkStmt = $pdo->query("SHOW TABLES LIKE 'delivery_drivers'");
                if ($checkStmt->rowCount() > 0) {
                    // Get all drivers for this delivery
                    $driverStmt = $pdo->prepare("
                        SELECT 
                            dd.Driver_ID,
                            u.First_Name as Driver_First_Name,
                            u.Middle_Name as Driver_Middle_Name,
                            u.Last_Name as Driver_Last_Name,
                            u.Phone_Number as Driver_Phone_Number,
                            u.email as Driver_Email
                        FROM delivery_drivers dd
                        LEFT JOIN users u ON dd.Driver_ID = u.User_ID
                        WHERE dd.Delivery_ID = :delivery_id
                    ");
                    $driverStmt->execute(['delivery_id' => $delivery['Delivery_ID']]);
                    $delivery['drivers'] = $driverStmt->fetchAll(PDO::FETCH_ASSOC);
                }
            } catch (PDOException $e) {
                // Junction table doesn't exist or error, continue with single driver
                error_log("Error fetching multiple drivers: " . $e->getMessage());
            }
        }
        
        // Add timestamp for real-time polling optimization
        ob_end_clean();
        echo json_encode([
            'success' => true,
            'delivery' => $delivery,
            'timestamp' => time(), // Unix timestamp for polling optimization
            'has_record' => true
        ]);
        exit;
    } else {
        // No delivery record found - create one automatically
        try {
            $createStmt = $pdo->prepare("
                INSERT INTO deliveries (Order_ID, Delivery_Status, Created_At, Updated_At)
                VALUES (:order_id, 'Pending', NOW(), NOW())
            ");
            $createStmt->execute(['order_id' => $orderId]);
            $deliveryId = $pdo->lastInsertId();
            
            // Fetch the newly created delivery record
            $stmt->execute(['order_id' => $orderId]);
            $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
            
            ob_end_clean();
            echo json_encode([
                'success' => true,
                'delivery' => $delivery,
                'timestamp' => time(),
                'has_record' => true,
                'auto_created' => true
            ]);
            exit;
        } catch (PDOException $e) {
            // If creation fails, return default status
            error_log("Auto-create delivery failed for order {$orderId}: " . $e->getMessage());
            ob_end_clean();
            echo json_encode([
                'success' => true,
                'delivery' => [
                    'Order_ID' => $orderId,
                    'Delivery_Status' => 'Pending',
                    'Created_At' => null,
                    'Updated_At' => null
                ],
                'timestamp' => time(),
                'has_record' => false,
                'error' => 'Failed to create delivery record'
            ]);
            exit;
        }
    }
    
} catch (PDOException $e) {
    ob_end_clean();
    error_log("Get Delivery Status Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch delivery status'
    ]);
    exit;
} catch (Exception $e) {
    ob_end_clean();
    error_log("Get Delivery Status Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch delivery status'
    ]);
    exit;
}
?>

