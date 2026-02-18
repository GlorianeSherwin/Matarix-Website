<?php
/**
 * Get Customer Orders API
 * Returns orders for the logged-in customer
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

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

// Try to find active session by checking both admin and customer sessions
$sessionFound = false;
$userId = null;
$activeSession = null;

// First, try customer session (most likely for this API)
if (session_status() !== PHP_SESSION_NONE) {
    @session_write_close();
}

// Set cookie path to root of application for customer session
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
session_name('MATARIX_CUSTOMER_SESSION');
@session_start();

if (isset($_SESSION['user_id'])) {
    $sessionFound = true;
    $userId = (int)$_SESSION['user_id'];
    $activeSession = $_SESSION;
} else {
    // Close customer session and try admin session (in case admin is viewing customer orders)
    @session_write_close();
    
    // Set cookie path to root of application for admin session
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
        $userId = (int)$_SESSION['user_id'];
        $activeSession = $_SESSION;
    }
}

if (!$sessionFound || !$userId) {
    // Try one more time with session helper's auto-detection as fallback
    @session_write_close();
    startSession(null); // Auto-detect session context
    
    if (isset($_SESSION['user_id'])) {
        $userId = (int)$_SESSION['user_id'];
        $sessionFound = true;
        error_log("Get Customer Orders - Session found using auto-detection. User ID: $userId");
    } else {
        // Log for debugging
        error_log("Get Customer Orders - No session found after all attempts. Session status: " . session_status());
        error_log("Get Customer Orders - Session name: " . session_name());
        error_log("Get Customer Orders - Cookies: " . json_encode($_COOKIE));
        error_log("Get Customer Orders - Session data: " . json_encode($_SESSION ?? []));
        
        http_response_code(401);
        echo json_encode([
            'success' => false, 
            'message' => 'Not authenticated. Please log in again.',
            'debug' => [
                'session_found' => $sessionFound,
                'user_id' => $userId,
                'session_name' => session_name(),
                'session_status' => session_status(),
                'cookies_present' => !empty($_COOKIE)
            ]
        ]);
        exit;
    }
}
$orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;

// Debug logging - log full session info
error_log("Get Customer Orders - Session User ID: $userId, Requested Order ID: " . ($orderId ?? 'null'));
error_log("Full session data: " . json_encode(['user_id' => $userId, 'user_email' => $_SESSION['user_email'] ?? 'N/A', 'user_role' => $_SESSION['user_role'] ?? 'N/A']));

$db = new DatabaseFunctions();

try {
    $pdo = $db->getConnection();
    
    if ($orderId) {
        // Check if Discount column exists in transactions table
        $checkDiscountColumn = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'Discount'")->rowCount() > 0;
        // Check if delivery_method column exists in orders table
        $checkDeliveryMethodColumn = $pdo->query("SHOW COLUMNS FROM orders LIKE 'delivery_method'")->rowCount() > 0;
        
        // Get specific order - include User_ID for frontend verification
        if ($checkDiscountColumn) {
            if ($checkDeliveryMethodColumn) {
                $sql = "
                    SELECT 
                        o.Order_ID,
                        o.User_ID,
                        o.order_date,
                        COALESCE(NULLIF(TRIM(o.status), ''), 'Pending Approval') as status,
                        o.payment,
                        o.amount,
                        o.payment_method,
                        o.delivery_method,
                        o.rejection_reason,
                        o.rejected_at,
                        o.rejected_at,
                        o.last_updated,
                        o.availability_date,
                        o.availability_time,
                        t.Transaction_ID,
                        t.Payment_Status,
                        t.proof_of_payment,
                        t.Payment_Method as transaction_payment_method,
                        t.Subtotal,
                        COALESCE(t.Discount, 0) as Discount,
                        t.Total as Transaction_Total
                    FROM orders o
                    LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                    WHERE o.Order_ID = :order_id AND o.User_ID = :user_id
                ";
            } else {
                $sql = "
                    SELECT 
                        o.Order_ID,
                        o.User_ID,
                        o.order_date,
                        COALESCE(NULLIF(TRIM(o.status), ''), 'Pending Approval') as status,
                        o.payment,
                        o.amount,
                        o.payment_method,
                        'Standard Delivery' as delivery_method,
                        o.rejection_reason,
                        o.rejected_at,
                        o.rejected_at,
                        o.last_updated,
                        o.availability_date,
                        o.availability_time,
                        t.Transaction_ID,
                        t.Payment_Status,
                        t.proof_of_payment,
                        t.Payment_Method as transaction_payment_method,
                        t.Subtotal,
                        COALESCE(t.Discount, 0) as Discount,
                        t.Total as Transaction_Total
                    FROM orders o
                    LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                    WHERE o.Order_ID = :order_id AND o.User_ID = :user_id
                ";
            }
        } else {
            // Calculate discount from Subtotal and Total if Discount column doesn't exist
            if ($checkDeliveryMethodColumn) {
                $sql = "
                    SELECT 
                        o.Order_ID,
                        o.User_ID,
                        o.order_date,
                        COALESCE(NULLIF(TRIM(o.status), ''), 'Pending Approval') as status,
                        o.payment,
                        o.amount,
                        o.payment_method,
                        o.delivery_method,
                        o.rejection_reason,
                        o.rejected_at,
                        o.rejected_at,
                        o.last_updated,
                        o.availability_date,
                        o.availability_time,
                        t.Transaction_ID,
                        t.Payment_Status,
                        t.proof_of_payment,
                        t.Payment_Method as transaction_payment_method,
                        t.Subtotal,
                        GREATEST(0, COALESCE(t.Subtotal, 0) - COALESCE(t.Total, 0)) as Discount,
                        t.Total as Transaction_Total
                    FROM orders o
                    LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                    WHERE o.Order_ID = :order_id AND o.User_ID = :user_id
                ";
            } else {
                $sql = "
                    SELECT 
                        o.Order_ID,
                        o.User_ID,
                        o.order_date,
                        COALESCE(NULLIF(TRIM(o.status), ''), 'Pending Approval') as status,
                        o.payment,
                        o.amount,
                        o.payment_method,
                        'Standard Delivery' as delivery_method,
                        o.rejection_reason,
                        o.rejected_at,
                        o.rejected_at,
                        o.last_updated,
                        o.availability_date,
                        o.availability_time,
                        t.Transaction_ID,
                        t.Payment_Status,
                        t.proof_of_payment,
                        t.Payment_Method as transaction_payment_method,
                        t.Subtotal,
                        GREATEST(0, COALESCE(t.Subtotal, 0) - COALESCE(t.Total, 0)) as Discount,
                        t.Total as Transaction_Total
                    FROM orders o
                    LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                    WHERE o.Order_ID = :order_id AND o.User_ID = :user_id
                ";
            }
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['order_id' => $orderId, 'user_id' => $userId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Debug: Log what we found
        if ($order) {
            error_log("Order found - Order ID: {$order['Order_ID']}, User ID in order: " . ($order['User_ID'] ?? 'N/A'));
        } else {
            // Log for debugging - check if order exists but belongs to different user
            $checkStmt = $pdo->prepare("SELECT User_ID FROM orders WHERE Order_ID = :order_id");
            $checkStmt->execute(['order_id' => $orderId]);
            $orderCheck = $checkStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($orderCheck) {
                // Order exists but belongs to different user
                error_log("Access denied: Order $orderId belongs to user {$orderCheck['User_ID']}, but session user is $userId");
                http_response_code(403);
                echo json_encode([
                    'success' => false, 
                    'message' => 'Access denied: This order does not belong to you',
                    'debug' => [
                        'requested_order_id' => $orderId,
                        'session_user_id' => $userId,
                        'order_owner_id' => $orderCheck['User_ID']
                    ]
                ]);
            } else {
                // Order doesn't exist
                error_log("Order $orderId not found in database");
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Order not found']);
            }
            exit;
        }
        
        // Get availability slots for this order
        $slotStmt = $pdo->prepare("
            SELECT 
                slot_number,
                availability_date,
                availability_time,
                is_preferred
            FROM order_availability_slots
            WHERE order_id = :order_id
            ORDER BY slot_number
        ");
        $slotStmt->execute(['order_id' => $orderId]);
        $order['availability_slots'] = $slotStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Set preferred slot as primary availability (for backward compatibility)
        $preferredSlot = null;
        foreach ($order['availability_slots'] as $slot) {
            if ($slot['is_preferred']) {
                $preferredSlot = $slot;
                break;
            }
        }
        if (!$preferredSlot && !empty($order['availability_slots'])) {
            $preferredSlot = $order['availability_slots'][0];
        }
        if ($preferredSlot) {
            $order['availability_date'] = $preferredSlot['availability_date'];
            $order['availability_time'] = $preferredSlot['availability_time'];
        }
        
        // Double-check: Verify the order actually belongs to this user (extra safety)
        $verifyStmt = $pdo->prepare("SELECT User_ID FROM orders WHERE Order_ID = :order_id");
        $verifyStmt->execute(['order_id' => $orderId]);
        $verifyOrder = $verifyStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$verifyOrder || (int)$verifyOrder['User_ID'] !== (int)$userId) {
            error_log("SECURITY CHECK FAILED: Order $orderId verification failed. Order User_ID: " . ($verifyOrder['User_ID'] ?? 'null') . ", Session User_ID: $userId");
            http_response_code(403);
            echo json_encode([
                'success' => false, 
                'message' => 'Access denied: Order ownership verification failed',
                'debug' => [
                    'requested_order_id' => $orderId,
                    'session_user_id' => $userId,
                    'order_owner_id' => $verifyOrder['User_ID'] ?? null
                ]
            ]);
            exit;
        }
        
        // Map old status values to new ones (COALESCE in SQL handles empty strings)
        $oldStatusMap = [
            'Order Confirmed' => 'Waiting Payment',
            'Being Processed' => 'Processing',
            'On the Way' => 'Ready',
            'Completed' => 'Ready'
        ];
        
        $rawStatus = trim($order['status'] ?? '');
        if (!empty($rawStatus) && isset($oldStatusMap[$rawStatus])) {
            $order['status'] = $oldStatusMap[$rawStatus];
        } elseif (empty($rawStatus)) {
            $order['status'] = 'Pending Approval';
        } else {
            $order['status'] = $rawStatus;
        }
        
        // If order is pending approval or rejected, payment_method should be null
        if ($order['status'] === 'Pending Approval' || $order['status'] === 'Rejected') {
            $order['payment_method'] = null;
        }
        
        // Get order items with product details including variations
        $stmt = $pdo->prepare("
            SELECT 
                ti.Item_ID,
                ti.Product_ID,
                ti.Quantity,
                ti.Price,
                COALESCE(p.Product_Name, CONCAT('Deleted Product (ID: ', ti.Product_ID, ')')) as Product_Name,
                p.category,
                p.length,
                p.Width,
                p.Unit,
                GROUP_CONCAT(DISTINCT CONCAT(pv.variation_name, ': ', pv.variation_value) ORDER BY pv.variation_name, pv.variation_value SEPARATOR ', ') as variations
            FROM transaction_items ti
            LEFT JOIN products p ON ti.Product_ID = p.Product_ID
            LEFT JOIN product_variations pv ON p.Product_ID = pv.Product_ID
            WHERE ti.Order_ID = :order_id
            GROUP BY ti.Item_ID
            ORDER BY ti.Item_ID
        ");
        $stmt->execute(['order_id' => $orderId]);
        $order['items'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Include session user_id in response for frontend verification
        echo json_encode([
            'success' => true, 
            'order' => $order,
            'session_user_id' => $userId // Include for verification
        ]);
    } else {
        // Check if Discount column exists in transactions table
        $checkDiscountColumn = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'Discount'")->rowCount() > 0;
        // Check if delivery_method column exists in orders table
        $checkDeliveryMethodColumn = $pdo->query("SHOW COLUMNS FROM orders LIKE 'delivery_method'")->rowCount() > 0;
        
        // Get all orders for user
        if ($checkDiscountColumn) {
            if ($checkDeliveryMethodColumn) {
                $sql = "
                    SELECT 
                        o.Order_ID,
                        o.order_date,
                        COALESCE(NULLIF(TRIM(o.status), ''), 'Pending Approval') as status,
                        o.payment,
                        o.amount,
                        o.payment_method,
                        o.delivery_method,
                        o.rejection_reason,
                        o.rejected_at,
                        o.last_updated,
                        o.availability_date,
                        o.availability_time,
                        t.Transaction_ID,
                        t.Payment_Status,
                        t.proof_of_payment,
                        t.Subtotal,
                        COALESCE(t.Discount, 0) as Discount,
                        t.Total as Transaction_Total
                    FROM orders o
                    LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                    WHERE o.User_ID = :user_id
                    ORDER BY o.order_date DESC
                ";
            } else {
                $sql = "
                    SELECT 
                        o.Order_ID,
                        o.order_date,
                        COALESCE(NULLIF(TRIM(o.status), ''), 'Pending Approval') as status,
                        o.payment,
                        o.amount,
                        o.payment_method,
                        'Standard Delivery' as delivery_method,
                        o.rejection_reason,
                        o.rejected_at,
                        o.last_updated,
                        o.availability_date,
                        o.availability_time,
                        t.Transaction_ID,
                        t.Payment_Status,
                        t.proof_of_payment,
                        t.Subtotal,
                        COALESCE(t.Discount, 0) as Discount,
                        t.Total as Transaction_Total
                    FROM orders o
                    LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                    WHERE o.User_ID = :user_id
                    ORDER BY o.order_date DESC
                ";
            }
        } else {
            // Calculate discount from Subtotal and Total if Discount column doesn't exist
            if ($checkDeliveryMethodColumn) {
                $sql = "
                    SELECT 
                        o.Order_ID,
                        o.order_date,
                        COALESCE(NULLIF(TRIM(o.status), ''), 'Pending Approval') as status,
                        o.payment,
                        o.amount,
                        o.payment_method,
                        o.delivery_method,
                        o.rejection_reason,
                        o.rejected_at,
                        o.last_updated,
                        o.availability_date,
                        o.availability_time,
                        t.Transaction_ID,
                        t.Payment_Status,
                        t.proof_of_payment,
                        t.Subtotal,
                        GREATEST(0, COALESCE(t.Subtotal, 0) - COALESCE(t.Total, 0)) as Discount,
                        t.Total as Transaction_Total
                    FROM orders o
                    LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                    WHERE o.User_ID = :user_id
                    ORDER BY o.order_date DESC
                ";
            } else {
                $sql = "
                    SELECT 
                        o.Order_ID,
                        o.order_date,
                        COALESCE(NULLIF(TRIM(o.status), ''), 'Pending Approval') as status,
                        o.payment,
                        o.amount,
                        o.payment_method,
                        'Standard Delivery' as delivery_method,
                        o.rejection_reason,
                        o.rejected_at,
                        o.last_updated,
                        o.availability_date,
                        o.availability_time,
                        t.Transaction_ID,
                        t.Payment_Status,
                        t.proof_of_payment,
                        t.Subtotal,
                        GREATEST(0, COALESCE(t.Subtotal, 0) - COALESCE(t.Total, 0)) as Discount,
                        t.Total as Transaction_Total
                    FROM orders o
                    LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                    WHERE o.User_ID = :user_id
                    ORDER BY o.order_date DESC
                ";
            }
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Map old status values to new ones for all orders
        $oldStatusMap = [
            'Order Confirmed' => 'Waiting Payment',
            'Being Processed' => 'Processing',
            'On the Way' => 'Ready',
            'Completed' => 'Ready'
        ];
        
        foreach ($orders as &$order) {
            // Get availability slots for each order
            $slotStmt = $pdo->prepare("
                SELECT 
                    slot_number,
                    availability_date,
                    availability_time,
                    is_preferred
                FROM order_availability_slots
                WHERE order_id = :order_id
                ORDER BY slot_number
            ");
            $slotStmt->execute(['order_id' => $order['Order_ID']]);
            $order['availability_slots'] = $slotStmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Set preferred slot as primary availability (for backward compatibility)
            $preferredSlot = null;
            foreach ($order['availability_slots'] as $slot) {
                if ($slot['is_preferred']) {
                    $preferredSlot = $slot;
                    break;
                }
            }
            if (!$preferredSlot && !empty($order['availability_slots'])) {
                $preferredSlot = $order['availability_slots'][0];
            }
            if ($preferredSlot) {
                $order['availability_date'] = $preferredSlot['availability_date'];
                $order['availability_time'] = $preferredSlot['availability_time'];
            }
            
            if (empty($order['status']) || trim($order['status']) === '') {
                $order['status'] = 'Pending Approval';
            } else {
                $rawStatus = trim($order['status']);
                if (isset($oldStatusMap[$rawStatus])) {
                    $order['status'] = $oldStatusMap[$rawStatus];
                } else {
                    $order['status'] = $rawStatus;
                }
            }
            
            // If order is pending approval or rejected, payment_method should be null
            if ($order['status'] === 'Pending Approval' || $order['status'] === 'Rejected') {
                $order['payment_method'] = null;
            }
            
            // Get order items for each order with product details including variations
            $itemsStmt = $pdo->prepare("
                SELECT 
                    ti.Item_ID,
                    ti.Product_ID,
                    ti.Quantity,
                    ti.Price,
                    COALESCE(p.Product_Name, CONCAT('Deleted Product (ID: ', ti.Product_ID, ')')) as Product_Name,
                    p.category,
                    p.length,
                    p.Width,
                    p.Unit,
                    GROUP_CONCAT(DISTINCT CONCAT(pv.variation_name, ': ', pv.variation_value) ORDER BY pv.variation_name, pv.variation_value SEPARATOR ', ') as variations
                FROM transaction_items ti
                LEFT JOIN products p ON ti.Product_ID = p.Product_ID
                LEFT JOIN product_variations pv ON p.Product_ID = pv.Product_ID
                WHERE ti.Order_ID = :order_id
                GROUP BY ti.Item_ID
                ORDER BY ti.Item_ID
            ");
            $itemsStmt->execute(['order_id' => $order['Order_ID']]);
            $order['items'] = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
        }
        unset($order); // Break reference
        
        // Include session user_id in response for frontend verification
        ob_end_clean();
        echo json_encode([
            'success' => true, 
            'orders' => $orders,
            'session_user_id' => $userId // Include for verification
        ]);
        exit;
    }
    
} catch (PDOException $e) {
    ob_end_clean();
    error_log("Get Customer Orders Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch orders']);
    exit;
} catch (Exception $e) {
    ob_end_clean();
    error_log("Get Customer Orders Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch orders']);
    exit;
}
?>

