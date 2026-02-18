<?php
/**
 * Get Orders API
 * Returns all orders for admin view
 */

// Start output buffering to catch any errors/warnings
ob_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

// Set error handler to catch warnings/notices (before any code that might generate them)
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    // Only log, don't output - output buffering will catch it
    error_log("PHP Error [{$errno}] in {$errfile}:{$errline} - {$errstr}");
    return false; // Let PHP handle it normally, but we'll catch output
}, E_ALL);

// Register shutdown function to handle errors gracefully
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== NULL && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        // Get and clean any output
        $output = '';
        if (ob_get_level() > 0) {
            $output = ob_get_clean();
        }
        
        // Only send JSON if headers haven't been sent
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'message' => 'Internal server error',
                'error' => 'A server error occurred while processing your request.',
                'error_type' => $error['type'],
                'error_file' => basename($error['file'] ?? 'unknown'),
                'error_line' => $error['line'] ?? 0
            ]);
        } else {
            // Headers already sent, log the error
            error_log("Fatal error after headers sent: " . json_encode($error));
        }
        exit;
    }
});

try {
    if (session_status() === PHP_SESSION_NONE) {
        startSession('admin');
    }
} catch (Throwable $e) {
    error_log("Session start error in get_orders.php: " . $e->getMessage());
    ob_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Session initialization failed',
        'error' => 'Unable to initialize session'
    ]);
    exit;
}

$userRole = $_SESSION['user_role'] ?? '';
$userId = $_SESSION['user_id'] ?? null;

// Log for debugging (remove in production)
error_log("Get Orders API - User ID: " . ($userId ?? 'not set') . ", Role: " . ($userRole ?? 'not set'));

// RBAC: order management view (Store Employee + Admin)
// Delivery Drivers can view orders assigned to them
$normalizedRole = trim((string)$userRole);
$isDriver = ($normalizedRole === 'Delivery Driver');
try {
    if ($isDriver) {
        rbac_require_permission_api('deliveries.view_assigned');
    } else {
        rbac_require_permission_api('orders.view');
    }
} catch (Throwable $e) {
    error_log("RBAC check error in get_orders.php: " . $e->getMessage());
    // rbac_require_permission_api already sends JSON and exits on failure, so this shouldn't be reached
    // But just in case, handle it
    ob_clean();
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Permission check failed',
        'error' => 'Unable to verify permissions'
    ]);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Check if order_id is provided (for single order view)
    $orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;
    
    if ($orderId) {
        // For Delivery Drivers: verify the order is assigned to them
        if ($isDriver && $userId) {
            // Check if delivery exists and is assigned to this driver
            $hasDeliveryDriversJunction = false;
            try {
                $checkJunctionStmt = $pdo->query("SHOW TABLES LIKE 'delivery_drivers'");
                $hasDeliveryDriversJunction = $checkJunctionStmt->rowCount() > 0;
            } catch (Throwable $e) {
                $hasDeliveryDriversJunction = false;
            }
            
            $driverCheckSql = "
                SELECT COUNT(*) as count
                FROM deliveries d
                WHERE d.Order_ID = :order_id
                AND (
                    d.Driver_ID = :driver_id_main
                    " . ($hasDeliveryDriversJunction ? "
                    OR EXISTS (
                        SELECT 1 FROM delivery_drivers dd
                        WHERE dd.Delivery_ID = d.Delivery_ID AND dd.Driver_ID = :driver_id_junction
                    )" : "") . "
                )
            ";
            
            $driverCheckStmt = $pdo->prepare($driverCheckSql);
            if ($hasDeliveryDriversJunction) {
                $driverCheckStmt->execute([
                    'order_id' => $orderId,
                    'driver_id_main' => (int)$userId,
                    'driver_id_junction' => (int)$userId
                ]);
            } else {
                $driverCheckStmt->execute([
                    'order_id' => $orderId,
                    'driver_id_main' => (int)$userId
                ]);
            }
            
            $driverCheckResult = $driverCheckStmt->fetch(PDO::FETCH_ASSOC);
            if (!$driverCheckResult || (int)$driverCheckResult['count'] === 0) {
                ob_clean();
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'message' => 'Access Denied: This order is not assigned to you',
                    'details' => 'You can only view orders assigned to you for delivery.'
                ]);
                exit;
            }
        }
        
        // Check if delivery_method column exists
        $checkDeliveryMethodColumn = $pdo->query("SHOW COLUMNS FROM orders LIKE 'delivery_method'")->rowCount() > 0;
        
        // Get single order with user and transaction details
        // Handle new order statuses and payment method fields
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
                    o.approved_at,
                    o.rejected_at,
                    o.approved_by,
                    o.last_updated,
                    o.availability_date,
                    o.availability_time,
                    u.First_Name,
                    u.Last_Name,
                    u.email,
                    u.Phone_Number,
                    u.address,
                    t.Transaction_ID,
                    t.Payment_Status,
                    t.proof_of_payment,
                    t.Payment_Method as transaction_payment_method,
                    COALESCE(d.Delivery_Status, 'Pending') as Delivery_Status
                FROM orders o
                LEFT JOIN users u ON o.User_ID = u.User_ID
                LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                LEFT JOIN deliveries d ON o.Order_ID = d.Order_ID
                WHERE o.Order_ID = :order_id
                ORDER BY d.Created_At DESC
                LIMIT 1
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
                    o.approved_at,
                    o.rejected_at,
                    o.approved_by,
                    o.last_updated,
                    o.availability_date,
                    o.availability_time,
                    u.First_Name,
                    u.Last_Name,
                    u.email,
                    u.Phone_Number,
                    u.address,
                    t.Transaction_ID,
                    t.Payment_Status,
                    t.proof_of_payment,
                    t.Payment_Method as transaction_payment_method,
                    COALESCE(d.Delivery_Status, 'Pending') as Delivery_Status
                FROM orders o
                LEFT JOIN users u ON o.User_ID = u.User_ID
                LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                LEFT JOIN deliveries d ON o.Order_ID = d.Order_ID
                WHERE o.Order_ID = :order_id
                ORDER BY d.Created_At DESC
                LIMIT 1
            ";
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['order_id' => $orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$order) {
            ob_clean();
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Order not found'
            ]);
            exit;
        }
        
        // Handle payment_method: if order is pending approval or rejected, set to null
        // For "Waiting Payment" orders, only use payment_method from orders table (set by customer via process_payment.php)
        // Don't use transaction_payment_method as fallback for "Waiting Payment" as it may contain old data
        if ($order['status'] === 'Pending Approval' || $order['status'] === 'Rejected') {
            // For pending approval or rejected orders, explicitly set both to null
            $order['payment_method'] = null;
            $order['transaction_payment_method'] = null;
        } else if ($order['status'] === 'Waiting Payment') {
            // For "Waiting Payment" orders, ONLY use payment_method from orders table
            // Don't fall back to transaction_payment_method - customer must have selected it via process_payment.php
            if (empty($order['payment_method']) || $order['payment_method'] === 'null' || $order['payment_method'] === 'NULL') {
                $order['payment_method'] = null;
            }
            // Keep transaction_payment_method in response but don't use it as fallback
        } else {
            // For other statuses (Processing, Ready), use payment_method from orders table
            // Only fall back to transaction_payment_method if orders.payment_method is null
            if (empty($order['payment_method']) || $order['payment_method'] === 'null' || $order['payment_method'] === 'NULL') {
                $order['payment_method'] = $order['transaction_payment_method'] ?? null;
            }
        }
        
        // Get order items with product details including dimensions and weight
        // Use LEFT JOIN to show items even if product was deleted
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
                p.weight,
                p.weight_unit,
                p.image_path
            FROM transaction_items ti
            LEFT JOIN products p ON ti.Product_ID = p.Product_ID
            WHERE ti.Order_ID = :order_id
            ORDER BY ti.Item_ID
        ");
        $stmt->execute(['order_id' => $orderId]);
        $order['items'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Fetch product variations for each item
        foreach ($order['items'] as &$item) {
            if ($item['Product_ID']) {
                $variationStmt = $pdo->prepare("
                    SELECT variation_name, variation_value 
                    FROM product_variations 
                    WHERE Product_ID = :product_id 
                    ORDER BY variation_name ASC, Variation_ID ASC
                ");
                $variationStmt->execute(['product_id' => $item['Product_ID']]);
                $variations = $variationStmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Format variations as a string (e.g., "Color: Red, Material: Sample")
                if (!empty($variations)) {
                    $variationStrings = [];
                    foreach ($variations as $variation) {
                        $variationStrings[] = $variation['variation_name'] . ': ' . $variation['variation_value'];
                    }
                    $item['variation'] = implode(', ', $variationStrings);
                } else {
                    $item['variation'] = null;
                }
            } else {
                $item['variation'] = null;
            }
        }
        unset($item); // Break reference
        
        // Debug logging for order items
        error_log("Order ID {$orderId} - Items count: " . count($order['items']));
        foreach ($order['items'] as $item) {
            error_log("Order ID {$orderId} - Item: Product_ID={$item['Product_ID']}, Product_Name={$item['Product_Name']}, Quantity={$item['Quantity']}, Price={$item['Price']}");
        }
        
        // Format customer name
        $order['customer_name'] = trim(($order['First_Name'] ?? '') . ' ' . ($order['Last_Name'] ?? ''));
        
        // Ensure address is included
        $order['address'] = $order['address'] ?? 'No address provided';
        
        // Ensure all fields have proper defaults
        $order['payment_method'] = $order['payment_method'] ?? null;
        $order['rejection_reason'] = $order['rejection_reason'] ?? null;
        $order['address'] = $order['address'] ?? 'No address provided';
        $order['Phone_Number'] = $order['Phone_Number'] ?? 'No phone number';
        
        // Clean any output before sending JSON
        ob_clean();
        $response = json_encode([
            'success' => true,
            'order' => $order
        ]);
        if ($response === false) {
            error_log("JSON encode error in get_orders.php: " . json_last_error_msg());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to encode response',
                'error' => 'JSON encoding failed'
            ]);
        } else {
            echo $response;
        }
        // Ensure output is flushed and no further output occurs
        if (ob_get_level() > 0) {
            ob_end_flush();
        }
        exit;
    } else {
        // Get all orders with user and transaction details
        // Exclude orders that have delivery status "Delivered" AND order status "Ready"
        // Check if delivery_method column exists
        $checkDeliveryMethodColumn = $pdo->query("SHOW COLUMNS FROM orders LIKE 'delivery_method'")->rowCount() > 0;
        
        if ($checkDeliveryMethodColumn) {
            $sql = "
                SELECT 
                    o.Order_ID,
                    o.User_ID,
                    o.order_date,
                    o.status,
                    o.payment,
                    o.amount,
                    o.payment_method,
                    COALESCE(o.delivery_method, 'Standard Delivery') as delivery_method,
                    o.last_updated,
                    o.availability_date,
                    o.availability_time,
                    u.First_Name,
                    u.Last_Name,
                    u.email,
                    u.Phone_Number,
                    u.address,
                    t.Transaction_ID,
                    t.Payment_Status,
                    t.proof_of_payment,
                    COALESCE((SELECT Delivery_Status FROM deliveries WHERE Order_ID = o.Order_ID ORDER BY Created_At DESC LIMIT 1), 'Pending') as Delivery_Status
                FROM orders o
                LEFT JOIN users u ON o.User_ID = u.User_ID
                LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                WHERE NOT (
                    COALESCE((SELECT Delivery_Status FROM deliveries WHERE Order_ID = o.Order_ID ORDER BY Created_At DESC LIMIT 1), 'Pending') = 'Delivered' 
                    AND o.status = 'Ready'
                )
                ORDER BY o.order_date DESC
            ";
        } else {
            $sql = "
                SELECT 
                    o.Order_ID,
                    o.User_ID,
                    o.order_date,
                    o.status,
                    o.payment,
                    o.amount,
                    o.payment_method,
                    'Standard Delivery' as delivery_method,
                    o.last_updated,
                    o.availability_date,
                    o.availability_time,
                    u.First_Name,
                    u.Last_Name,
                    u.email,
                    u.Phone_Number,
                    u.address,
                    t.Transaction_ID,
                    t.Payment_Status,
                    t.proof_of_payment,
                    COALESCE((SELECT Delivery_Status FROM deliveries WHERE Order_ID = o.Order_ID ORDER BY Created_At DESC LIMIT 1), 'Pending') as Delivery_Status
                FROM orders o
                LEFT JOIN users u ON o.User_ID = u.User_ID
                LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                WHERE NOT (
                    COALESCE((SELECT Delivery_Status FROM deliveries WHERE Order_ID = o.Order_ID ORDER BY Created_At DESC LIMIT 1), 'Pending') = 'Delivered' 
                    AND o.status = 'Ready'
                )
                ORDER BY o.order_date DESC
            ";
        }
        
        $stmt = $pdo->query($sql);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Log filtering results for debugging
        $excludedCount = 0;
        $totalBeforeFilter = 0;
        
        // Count how many orders would have been excluded
        $checkSql = "
            SELECT COUNT(*) as total
            FROM orders o
            LEFT JOIN deliveries d ON o.Order_ID = d.Order_ID
            WHERE COALESCE(d.Delivery_Status, 'Pending') = 'Delivered' 
            AND o.status = 'Ready'
        ";
        $checkStmt = $pdo->query($checkSql);
        $excludedResult = $checkStmt->fetch(PDO::FETCH_ASSOC);
        $excludedCount = $excludedResult['total'] ?? 0;
        
        error_log("Get Orders - Total orders returned: " . count($orders));
        error_log("Get Orders - Excluded orders (Delivered + Ready): " . $excludedCount);
        
        // Get order items for each order
        foreach ($orders as &$order) {
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
                    p.weight,
                    p.weight_unit,
                    p.image_path
                FROM transaction_items ti
                LEFT JOIN products p ON ti.Product_ID = p.Product_ID
                WHERE ti.Order_ID = :order_id
                ORDER BY ti.Item_ID
            ");
            $stmt->execute(['order_id' => $order['Order_ID']]);
            $order['items'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Format customer name
            $order['customer_name'] = trim(($order['First_Name'] ?? '') . ' ' . ($order['Last_Name'] ?? ''));
        }
        
        // For Delivery Drivers: filter to only show orders assigned to them
        if ($isDriver && $userId) {
            // Filter orders to only those assigned to this driver
            $hasDeliveryDriversJunction = false;
            try {
                $checkJunctionStmt = $pdo->query("SHOW TABLES LIKE 'delivery_drivers'");
                $hasDeliveryDriversJunction = $checkJunctionStmt->rowCount() > 0;
            } catch (Throwable $e) {
                $hasDeliveryDriversJunction = false;
            }
            
            $filteredOrders = [];
            foreach ($orders as $order) {
                $orderId = $order['Order_ID'];
                $driverCheckSql = "
                    SELECT COUNT(*) as count
                    FROM deliveries d
                    WHERE d.Order_ID = :order_id
                    AND (
                        d.Driver_ID = :driver_id_main
                        " . ($hasDeliveryDriversJunction ? "
                        OR EXISTS (
                            SELECT 1 FROM delivery_drivers dd
                            WHERE dd.Delivery_ID = d.Delivery_ID AND dd.Driver_ID = :driver_id_junction
                        )" : "") . "
                    )
                ";
                
                $driverCheckStmt = $pdo->prepare($driverCheckSql);
                if ($hasDeliveryDriversJunction) {
                    $driverCheckStmt->execute([
                        'order_id' => $orderId,
                        'driver_id_main' => (int)$userId,
                        'driver_id_junction' => (int)$userId
                    ]);
                } else {
                    $driverCheckStmt->execute([
                        'order_id' => $orderId,
                        'driver_id_main' => (int)$userId
                    ]);
                }
                
                $driverCheckResult = $driverCheckStmt->fetch(PDO::FETCH_ASSOC);
                if ($driverCheckResult && (int)$driverCheckResult['count'] > 0) {
                    $filteredOrders[] = $order;
                }
            }
            $orders = $filteredOrders;
        }
        
        // Clean any output before sending JSON
        ob_clean();
        $response = json_encode([
            'success' => true,
            'orders' => $orders
        ]);
        if ($response === false) {
            error_log("JSON encode error in get_orders.php: " . json_last_error_msg());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to encode response',
                'error' => 'JSON encoding failed'
            ]);
        } else {
            echo $response;
        }
        // Ensure output is flushed and no further output occurs
        if (ob_get_level() > 0) {
            ob_end_flush();
        }
        exit;
    }
    
} catch (PDOException $e) {
    error_log("Get Orders Error: " . $e->getMessage());
    ob_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch orders',
        'error' => 'Database error occurred'
    ]);
    exit;
} catch (Throwable $e) {
    error_log("Get Orders Exception: " . $e->getMessage());
    ob_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while processing your request',
        'error' => $e->getMessage()
    ]);
    exit;
}
?>

