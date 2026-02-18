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
    
    // Auto-migrate: ensure proof_updated_at column exists
    $hasProofUpdatedAt = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'proof_updated_at'")->rowCount() > 0;
    if (!$hasProofUpdatedAt) {
        try {
            // Add column (use proof_of_payment which always exists)
            $pdo->exec("ALTER TABLE transactions ADD COLUMN proof_updated_at DATETIME NULL DEFAULT NULL");
            // Do not backfill: proof_updated_at is set only on re-upload after rejection (process_payment.php)
        } catch (PDOException $e) {
            error_log("Get Orders - Auto-migrate proof_updated_at: " . $e->getMessage());
        }
    }
    
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
                    t.proof_updated_at,
                    t.Payment_Method as transaction_payment_method,
                    t.Subtotal,
                    t.Total as Transaction_Total,
                    COALESCE(d.Delivery_Status, 'Pending') as Delivery_Status
                FROM orders o
                LEFT JOIN users u ON o.User_ID = u.User_ID
                LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                LEFT JOIN deliveries d ON o.Order_ID = d.Order_ID
                WHERE o.Order_ID = :order_id
                ORDER BY d.Created_At DESC
                LIMIT 1
            ";
            // Add Discount if column exists (avoid SQL error on older schemas)
            $hasDiscount = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'Discount'")->rowCount() > 0;
            if ($hasDiscount) {
                $sql = str_replace('t.Subtotal,', 't.Subtotal, COALESCE(t.Discount, 0) as Discount,', $sql);
            }
            // Remove proof_updated_at if column doesn't exist
            $hasProofUpdatedAt = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'proof_updated_at'")->rowCount() > 0;
            if (!$hasProofUpdatedAt) {
                $sql = preg_replace("/t\.proof_updated_at,\s*/", '', $sql);
            }
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
                    t.proof_updated_at,
                    t.Payment_Method as transaction_payment_method,
                    t.Subtotal,
                    t.Total as Transaction_Total,
                    COALESCE(d.Delivery_Status, 'Pending') as Delivery_Status
                FROM orders o
                LEFT JOIN users u ON o.User_ID = u.User_ID
                LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                LEFT JOIN deliveries d ON o.Order_ID = d.Order_ID
                WHERE o.Order_ID = :order_id
                ORDER BY d.Created_At DESC
                LIMIT 1
            ";
            $hasProofUpdatedAt = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'proof_updated_at'")->rowCount() > 0;
            if (!$hasProofUpdatedAt) {
                $sql = preg_replace("/t\.proof_updated_at,\s*/", '', $sql);
            }
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
        
        // Ensure proof_updated_at is always present for admin order details (red "New proof uploaded" tag)
        if (!array_key_exists('proof_updated_at', $order)) {
            $order['proof_updated_at'] = null;
        }
        $hasCol = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'proof_updated_at'")->rowCount() > 0;
        if ($hasCol) {
            $proofRow = $pdo->prepare("SELECT proof_updated_at FROM transactions WHERE Order_ID = :order_id LIMIT 1");
            $proofRow->execute(['order_id' => $orderId]);
            $txRow = $proofRow->fetch(PDO::FETCH_ASSOC);
            if ($txRow) {
                $order['proof_updated_at'] = isset($txRow['proof_updated_at']) && $txRow['proof_updated_at'] !== null && trim((string)$txRow['proof_updated_at']) !== ''
                    ? $txRow['proof_updated_at']
                    : null;
            }
        }
        // Keep raw payment method for admin proof-of-payment display (Order Placed tab)
        $order['payment_method_raw'] = array_key_exists('payment_method', $order) ? $order['payment_method'] : null;
        $order['transaction_payment_method_raw'] = array_key_exists('transaction_payment_method', $order) ? $order['transaction_payment_method'] : null;
        
        // Handle payment_method for single-order view: keep actual values for Pending Approval so admin can see proof of payment
        if ($order['status'] === 'Rejected') {
            $order['payment_method'] = null;
            $order['transaction_payment_method'] = null;
        } else if ($order['status'] === 'Pending Approval') {
            // Leave payment_method and transaction_payment_method as-is so proof of payment section can show for GCash
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
        
        // Get order items with product details; prefer transaction_items.variation (selected at order time)
        $hasTiVariation = $pdo->query("SHOW COLUMNS FROM transaction_items LIKE 'variation'")->rowCount() > 0;
        $tiVarCol = $hasTiVariation ? 'ti.variation as item_variation,' : '';
        $stmt = $pdo->prepare("
            SELECT 
                ti.Item_ID,
                ti.Product_ID,
                ti.Quantity,
                ti.Price,
                {$tiVarCol}
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
        
        foreach ($order['items'] as &$item) {
            // Use stored variation text from order when available
            if (!empty($item['item_variation'])) {
                $item['variation'] = trim($item['item_variation']);
            } elseif ($item['Product_ID']) {
                $variationStmt = $pdo->prepare("
                    SELECT variation_name, variation_value 
                    FROM product_variations 
                    WHERE Product_ID = :product_id 
                    ORDER BY variation_name ASC, Variation_ID ASC
                ");
                $variationStmt->execute(['product_id' => $item['Product_ID']]);
                $variations = $variationStmt->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($variations)) {
                    $variationStrings = [];
                    foreach ($variations as $v) {
                        $variationStrings[] = $v['variation_name'] . ': ' . $v['variation_value'];
                    }
                    $item['variation'] = implode(', ', $variationStrings);
                } else {
                    $item['variation'] = null;
                }
            } else {
                $item['variation'] = null;
            }
            unset($item['item_variation']);
        }
        unset($item);
        
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
        
        // Delivery tracking: driver, vehicle, time window (for Standard Delivery with assigned driver)
        $order['delivery_tracking'] = null;
        $deliveryMethod = isset($order['delivery_method']) ? trim((string)$order['delivery_method']) : '';
        if (strtolower($deliveryMethod) === 'standard delivery') {
            $delStmt = $pdo->prepare("
                SELECT 
                    d.Delivery_ID,
                    d.Delivery_Status,
                    d.Driver_ID,
                    d.Vehicle_ID,
                    driver.First_Name as driver_first_name,
                    driver.Last_Name as driver_last_name,
                    driver.Phone_Number as driver_phone,
                    f.vehicle_model
                FROM deliveries d
                LEFT JOIN users driver ON d.Driver_ID = driver.User_ID
                LEFT JOIN fleet f ON d.Vehicle_ID = f.Vehicle_ID
                WHERE d.Order_ID = :order_id
                ORDER BY d.Created_At DESC
                LIMIT 1
            ");
            $delStmt->execute(['order_id' => $orderId]);
            $delRow = $delStmt->fetch(PDO::FETCH_ASSOC);
            if ($delRow && !empty($delRow['Driver_ID'])) {
                $driverName = trim(($delRow['driver_first_name'] ?? '') . ' ' . ($delRow['driver_last_name'] ?? ''));
                $avTime = $order['availability_time'] ?? '';
                $hour = null;
                if (preg_match('/^(\d+)/', $avTime, $m)) {
                    $hour = (int)$m[1];
                }
                $timeWindow = '';
                if ($hour !== null) {
                    if ($hour >= 8 && $hour < 12) {
                        $timeWindow = 'Morning (8 AM – 12 PM)';
                    } elseif ($hour >= 12 && $hour < 17) {
                        $timeWindow = 'Afternoon (12 PM – 5 PM)';
                    }
                }
                $order['delivery_tracking'] = [
                    'driver_name' => $driverName ?: '—',
                    'driver_phone' => $delRow['driver_phone'] ?? null,
                    'vehicle_model' => $delRow['vehicle_model'] ?? '—',
                    'delivery_time_window' => $timeWindow,
                    'delivery_status' => $delRow['Delivery_Status'] ?? 'Pending',
                    'availability_date' => $order['availability_date'] ?? null,
                    'availability_time' => $order['availability_time'] ?? null
                ];
            }
        }
        
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
        // Get all orders with user and transaction details (including delivered)
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
                    t.Payment_Method as transaction_payment_method,
                    t.proof_of_payment,
                    t.proof_updated_at,
                    COALESCE((SELECT Delivery_Status FROM deliveries WHERE Order_ID = o.Order_ID ORDER BY Created_At DESC LIMIT 1), 'Pending') as Delivery_Status
                FROM orders o
                LEFT JOIN users u ON o.User_ID = u.User_ID
                LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
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
                    t.Payment_Method as transaction_payment_method,
                    t.proof_of_payment,
                    t.proof_updated_at,
                    COALESCE((SELECT Delivery_Status FROM deliveries WHERE Order_ID = o.Order_ID ORDER BY Created_At DESC LIMIT 1), 'Pending') as Delivery_Status
                FROM orders o
                LEFT JOIN users u ON o.User_ID = u.User_ID
                LEFT JOIN transactions t ON t.Order_ID = o.Order_ID
                ORDER BY o.order_date DESC
            ";
        }
        $hasProofUpdatedAt = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'proof_updated_at'")->rowCount() > 0;
        if (!$hasProofUpdatedAt) {
            $sql = preg_replace("/t\.proof_updated_at,\s*/", '', $sql);
        }
        
        $stmt = $pdo->query($sql);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        error_log("Get Orders - Total orders returned: " . count($orders));
        
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
        
        // Delivery Drivers see all orders (same as admin)
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

