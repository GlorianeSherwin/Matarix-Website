<?php
/**
 * Create Order API
 * Creates a new order from cart items
 */

// Start output buffering to prevent any output before headers
ob_start();

// Suppress error display for production
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Credentials: true');
    http_response_code(200);
    exit;
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

// Close any existing session first
if (session_status() !== PHP_SESSION_NONE) {
    session_write_close();
}

// Set cookie parameters BEFORE session name (critical for cookie path)
// Use dynamic path detection for Hostinger compatibility
require_once __DIR__ . '/../includes/path_helper.php';
session_set_cookie_params([
    'lifetime' => 0,
    'path' => getBasePath(),
    'domain' => '',
    'secure' => isSecure(),
    'httponly' => true,
    'samesite' => 'Lax'
]);

// Start customer session with correct name
session_name('MATARIX_CUSTOMER_SESSION');
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    // Debug logging
    error_log("Create Order - Authentication failed.");
    error_log("Create Order - Session Name: " . session_name());
    error_log("Create Order - Session ID: " . session_id());
    error_log("Create Order - Session keys: " . implode(', ', array_keys($_SESSION)));
    error_log("Create Order - Cookies received: " . print_r($_COOKIE, true));
    
    ob_end_clean();
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'User not authenticated. Please log in again.'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$cartItems = $data['cart_items'] ?? [];
// Payment method is selected AFTER admin approval, not during order creation
$availabilitySlots = $data['availability_slots'] ?? [];
$deliveryMethod = $data['delivery_method'] ?? 'Standard Delivery'; // Default to Standard Delivery for backward compatibility

// Validate cart items structure
if (!is_array($cartItems)) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid cart items format. Expected an array.'
    ]);
    exit;
}

// Get database connection for validation (will be reused later)
$db = new DatabaseFunctions();
$pdo = $db->getConnection();

    // Validate each cart item before processing
foreach ($cartItems as $index => $item) {
    if (!isset($item['product_id']) || !isset($item['quantity']) || !isset($item['price'])) {
        ob_end_clean();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => "Invalid cart item at index $index. Missing required fields (product_id, quantity, price)."
        ]);
        exit;
    }
    
    $productId = (int)$item['product_id'];
    $quantity = (int)$item['quantity'];
    $price = (float)$item['price'];
    
    if ($productId <= 0 || $quantity <= 0 || $price < 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => "Invalid cart item at index $index. Product ID, quantity, and price must be positive values."
        ]);
        exit;
    }
    
    // Verify product exists and is available
    $productStmt = $pdo->prepare("SELECT Product_ID, stock_level, stock_status, price FROM products WHERE Product_ID = :product_id");
    $productStmt->execute(['product_id' => $productId]);
    $product = $productStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$product) {
        ob_end_clean();
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => "Product with ID $productId not found."
        ]);
        exit;
    }
    
    // Check stock availability
    if ($product['stock_status'] === 'Out of Stock' || $product['stock_level'] < $quantity) {
        ob_end_clean();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => "Insufficient stock for product ID $productId. Available: {$product['stock_level']}, Requested: $quantity"
        ]);
        exit;
    }
}

// For backward compatibility, also check old format
$availabilityDate = $data['availability_date'] ?? null;
$availabilityTime = $data['availability_time'] ?? null;

// If new format (slots) is provided, use the preferred slot
if (!empty($availabilitySlots)) {
    $preferredSlot = null;
    foreach ($availabilitySlots as $slot) {
        if (isset($slot['is_preferred']) && $slot['is_preferred']) {
            $preferredSlot = $slot;
            break;
        }
    }
    // If no preferred slot found, use first slot
    if (!$preferredSlot && !empty($availabilitySlots)) {
        $preferredSlot = $availabilitySlots[0];
    }
    
    if ($preferredSlot) {
        $availabilityDate = $preferredSlot['date'] ?? null;
        $availabilityTime = $preferredSlot['time'] ?? null;
        // If time is not provided, set default to 9:00 AM
        if (empty($availabilityTime)) {
            $availabilityTime = '09:00:00';
        }
    }
}

// If time is still null, set default to 9:00 AM
if (empty($availabilityTime) && !empty($availabilityDate)) {
    $availabilityTime = '09:00:00';
}

// Empty cart check is already done in validation above
// Database connection is already initialized above

// Helper function to convert weight to kg
function convertWeightToKg($weight, $unit) {
    if (!$weight || $weight == 0) return 0;
    $weightValue = (float)$weight;
    switch (strtolower($unit ?? 'kg')) {
        case 'kg': return $weightValue;
        case 'g': return $weightValue / 1000;
        case 'lb': return $weightValue * 0.453592;
        case 'oz': return $weightValue * 0.0283495;
        case 'ton': return $weightValue * 1000;
        default: return $weightValue;
    }
}

try {
    $pdo->beginTransaction();
    
    // Calculate total amount, total weight, and total quantity
    $totalAmount = 0;
    $totalWeightKg = 0;
    $totalQuantity = 0;
    $productDetailsMap = [];
    
    foreach ($cartItems as $item) {
        $totalAmount += $item['price'] * $item['quantity'];
        $totalQuantity += $item['quantity'];
        
        // Fetch product details for weight calculation
        $productStmt = $pdo->prepare("SELECT weight, weight_unit FROM products WHERE Product_ID = :product_id");
        $productStmt->execute(['product_id' => $item['product_id']]);
        $product = $productStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($product && $product['weight']) {
            $weightKg = convertWeightToKg($product['weight'], $product['weight_unit']);
            $totalWeightKg += $weightKg * $item['quantity'];
            $productDetailsMap[$item['product_id']] = $product;
        }
    }
    
    // Get minimum order settings and discount settings
    $settingsStmt = $pdo->query("SELECT setting_key, setting_value FROM order_settings");
    $settings = [];
    while ($row = $settingsStmt->fetch(PDO::FETCH_ASSOC)) {
        $settings[$row['setting_key']] = $row['setting_value'];
    }
    
    // Calculate volume discount based on total quantity
    $discountPercentage = 0;
    $discountAmount = 0;
    
    // Get discount tier settings (default values if not set)
    $discountTier1Min = (int)($settings['volume_discount_tier1_min'] ?? 20);
    $discountTier1Percent = (float)($settings['volume_discount_tier1_percent'] ?? 5);
    $discountTier2Min = (int)($settings['volume_discount_tier2_min'] ?? 50);
    $discountTier2Percent = (float)($settings['volume_discount_tier2_percent'] ?? 10);
    $discountTier3Min = (int)($settings['volume_discount_tier3_min'] ?? 100);
    $discountTier3Percent = (float)($settings['volume_discount_tier3_percent'] ?? 15);
    $discountTier4Min = (int)($settings['volume_discount_tier4_min'] ?? 200);
    $discountTier4Percent = (float)($settings['volume_discount_tier4_percent'] ?? 20);
    
    // Determine which discount tier applies (highest tier that customer qualifies for)
    if ($totalQuantity >= $discountTier4Min) {
        $discountPercentage = $discountTier4Percent;
    } elseif ($totalQuantity >= $discountTier3Min) {
        $discountPercentage = $discountTier3Percent;
    } elseif ($totalQuantity >= $discountTier2Min) {
        $discountPercentage = $discountTier2Percent;
    } elseif ($totalQuantity >= $discountTier1Min) {
        $discountPercentage = $discountTier1Percent;
    }
    
    // Calculate discount amount
    if ($discountPercentage > 0) {
        $discountAmount = $totalAmount * ($discountPercentage / 100);
    }
    
    // Calculate final amount after discount
    $finalAmount = $totalAmount - $discountAmount;
    
    // Validate delivery method early (needed for min-order skip)
    $validDeliveryMethods = ['Standard Delivery', 'Pick Up'];
    if (!in_array($deliveryMethod, $validDeliveryMethods)) {
        $deliveryMethod = 'Standard Delivery';
    }
    
    // Minimum order requirement: only for Standard Delivery (Pick Up has no minimum)
    if ($deliveryMethod !== 'Pick Up') {
        $disableMinWeight = isset($settings['disable_minimum_weight']) && $settings['disable_minimum_weight'] == '1';
        $disableMinValue = isset($settings['disable_minimum_order_value']) && $settings['disable_minimum_order_value'] == '1';
        
        // If both minimums are disabled, skip validation
        if ($disableMinWeight && $disableMinValue) {
            // No minimum requirements - proceed
        } else {
        // Check if auto-calculate is enabled
        $autoCalculate = isset($settings['auto_calculate_from_fleet']) && $settings['auto_calculate_from_fleet'] == '1';
        $minWeightKg = $disableMinWeight ? 0 : (float)($settings['min_order_weight_kg'] ?? 200);
        
        if ($autoCalculate && !$disableMinWeight) {
            // Get smallest vehicle capacity
            $capacityStmt = $pdo->query("
                SELECT MIN(
                    CASE capacity_unit
                        WHEN 'kg' THEN capacity
                        WHEN 'g' THEN capacity / 1000
                        WHEN 'lb' THEN capacity * 0.453592
                        WHEN 'oz' THEN capacity * 0.0283495
                        WHEN 'ton' THEN capacity * 1000
                    ELSE capacity
                END
            ) as min_capacity_kg
            FROM fleet
            WHERE capacity IS NOT NULL AND capacity > 0
            ");
            $capacityResult = $capacityStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($capacityResult && $capacityResult['min_capacity_kg']) {
                $smallestCapacity = (float)$capacityResult['min_capacity_kg'];
                $percentage = (float)($settings['min_order_weight_percentage'] ?? 25);
                $minWeightKg = max(1, round($smallestCapacity * ($percentage / 100), 2));
            }
        }
        
        $minValue = $disableMinValue ? 0 : (float)($settings['min_order_value'] ?? 0);
        $allowHeavySingleItems = !isset($settings['allow_heavy_single_items']) || $settings['allow_heavy_single_items'] == '1';
        $meetsMinimum = false;
        
        if (!$disableMinWeight && $allowHeavySingleItems && count($cartItems) === 1) {
            $item = $cartItems[0];
            $product = $productDetailsMap[$item['product_id']] ?? null;
            if ($product && $product['weight']) {
                $itemWeightKg = convertWeightToKg($product['weight'], $product['weight_unit']) * $item['quantity'];
                if ($itemWeightKg >= $minWeightKg) {
                    $meetsMinimum = true;
                }
            }
        }
        
        if (!$meetsMinimum) {
            $weightActive = $minWeightKg > 0;
            $valueActive = $minValue > 0;
            $meetsWeight = $totalWeightKg >= $minWeightKg;
            $meetsValue = $totalAmount >= $minValue;
            $meetsMinimum = ($weightActive && $meetsWeight) || ($valueActive && $meetsValue);
        }
        
        if (!$meetsMinimum) {
            $pdo->rollBack();
            $errorMsg = "Minimum order requirement not met. ";
            if ($totalWeightKg < $minWeightKg && $minWeightKg > 0 && !$disableMinWeight) {
                $neededWeight = $minWeightKg - $totalWeightKg;
                $errorMsg .= sprintf(
                    "Minimum weight is %.2f kg. Your order is %.2f kg. Add %.2f kg more to proceed.",
                    $minWeightKg, $totalWeightKg, $neededWeight
                );
            }
            if ($totalAmount < $minValue && $minValue > 0 && !$disableMinValue) {
                $neededValue = $minValue - $totalAmount;
                $errorMsg .= sprintf(
                    " Or minimum order value is ₱%.2f. Add ₱%.2f more to proceed.",
                    $minValue, $neededValue
                );
            }
            ob_end_clean();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => $errorMsg,
                'current_weight' => $totalWeightKg,
                'minimum_weight' => $minWeightKg,
                'needed_weight' => max(0, $minWeightKg - $totalWeightKg),
                'current_value' => $totalAmount,
                'minimum_value' => $minValue,
                'needed_value' => max(0, $minValue - $totalAmount)
            ]);
            exit;
        }
        }
    }
    
    // New order flow: Orders go directly to 'Waiting Payment' - no approval step
    // Customer is directed to payment immediately after checkout
    $orderStatus = 'Waiting Payment';
    $paymentStatus = 'To Pay';
    
    // Create order without payment method (payment method will be selected after admin approval)
    // Use final amount (after discount) for the order amount
    // Check if delivery_method column exists
    $checkDeliveryMethodColumn = $pdo->query("SHOW COLUMNS FROM orders LIKE 'delivery_method'")->rowCount() > 0;
    
    if ($checkDeliveryMethodColumn) {
        $stmt = $pdo->prepare("
            INSERT INTO orders (User_ID, status, payment, amount, payment_method, delivery_method, order_date, availability_date, availability_time)
            VALUES (:user_id, :status, :payment, :amount, NULL, :delivery_method, NOW(), :availability_date, :availability_time)
        ");
        $stmt->execute([
            'user_id' => $_SESSION['user_id'],
            'status' => $orderStatus,
            'payment' => $paymentStatus,
            'amount' => $finalAmount, // Use final amount after discount
            'delivery_method' => $deliveryMethod,
            'availability_date' => $availabilityDate ?: null,
            'availability_time' => $availabilityTime ?: '09:00:00' // Default to 9:00 AM if not provided
        ]);
    } else {
        // Fallback if column doesn't exist yet
        $stmt = $pdo->prepare("
            INSERT INTO orders (User_ID, status, payment, amount, payment_method, order_date, availability_date, availability_time)
            VALUES (:user_id, :status, :payment, :amount, NULL, NOW(), :availability_date, :availability_time)
        ");
        $stmt->execute([
            'user_id' => $_SESSION['user_id'],
            'status' => $orderStatus,
            'payment' => $paymentStatus,
            'amount' => $finalAmount, // Use final amount after discount
            'availability_date' => $availabilityDate ?: null,
            'availability_time' => $availabilityTime ?: '09:00:00' // Default to 9:00 AM if not provided
        ]);
    }
    
    $orderId = $pdo->lastInsertId();
    
    // Save all availability slots
    if (!empty($availabilitySlots)) {
        $slotStmt = $pdo->prepare("
            INSERT INTO order_availability_slots (order_id, slot_number, availability_date, availability_time, is_preferred)
            VALUES (:order_id, :slot_number, :availability_date, :availability_time, :is_preferred)
        ");
        
        foreach ($availabilitySlots as $slot) {
            // If time is not provided, set default to 9:00 AM
            $slotTime = $slot['time'] ?? null;
            if (empty($slotTime)) {
                $slotTime = '09:00:00';
            }
            
            $slotStmt->execute([
                'order_id' => $orderId,
                'slot_number' => $slot['slot_number'],
                'availability_date' => $slot['date'],
                'availability_time' => $slotTime,
                'is_preferred' => isset($slot['is_preferred']) && $slot['is_preferred'] ? 1 : 0
            ]);
        }
    }
    
    // Auto-generate delivery record when order is created ONLY if delivery method is "Standard Delivery"
    // For "Pick Up" orders, no delivery record should be created
    $deliveryId = null;
    
    if ($deliveryMethod === 'Standard Delivery') {
        // Start with 'Pending' status (standardized)
        // Drivers can update to 'Preparing', 'Out for Delivery', etc.
        // Check if delivery already exists for this order (prevent duplicates)
        $checkStmt = $pdo->prepare("SELECT Delivery_ID FROM deliveries WHERE Order_ID = :order_id LIMIT 1");
        $checkStmt->execute(['order_id' => $orderId]);
        $existingDelivery = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existingDelivery) {
            // Delivery record already exists, use it
            $deliveryId = $existingDelivery['Delivery_ID'];
        } else {
            // Create new delivery record
            $stmt = $pdo->prepare("
                INSERT INTO deliveries (Order_ID, Delivery_Status, Created_At, Updated_At)
                VALUES (:order_id, 'Pending', NOW(), NOW())
            ");
            $stmt->execute([
                'order_id' => $orderId
            ]);
            
            $deliveryId = $pdo->lastInsertId();
            
            // Verify delivery ID was created successfully
            if (!$deliveryId || $deliveryId == 0) {
                // Try to get the delivery ID that was just created by querying
                $checkStmt = $pdo->prepare("SELECT Delivery_ID FROM deliveries WHERE Order_ID = :order_id ORDER BY Delivery_ID DESC LIMIT 1");
                $checkStmt->execute(['order_id' => $orderId]);
                $newDelivery = $checkStmt->fetch(PDO::FETCH_ASSOC);
                
                if ($newDelivery && $newDelivery['Delivery_ID'] > 0) {
                    $deliveryId = $newDelivery['Delivery_ID'];
                } else {
                    throw new Exception("Failed to create delivery record. Delivery_ID AUTO_INCREMENT may not be enabled. Please run fix_delivery_id_issue.php");
                }
            }
        }
    }
    
    // Create transaction (payment method will be set after admin approval)
    // Check if Discount column exists, if not, we'll use a workaround
    $checkDiscountColumn = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'Discount'")->rowCount() > 0;
    
    if ($checkDiscountColumn) {
        // If Discount column exists, use it
        $stmt = $pdo->prepare("
            INSERT INTO transactions (Order_ID, Subtotal, Discount, Total, Payment_Status)
            VALUES (:order_id, :subtotal, :discount, :total, :payment_status)
        ");
        $stmt->execute([
            'order_id' => $orderId,
            'subtotal' => $totalAmount,
            'discount' => $discountAmount,
            'total' => $finalAmount, // Final amount after discount
            'payment_status' => 'Pending' // Will be updated after payment
        ]);
    } else {
        // If Discount column doesn't exist, calculate total with discount
        $stmt = $pdo->prepare("
            INSERT INTO transactions (Order_ID, Subtotal, Total, Payment_Status)
            VALUES (:order_id, :subtotal, :total, :payment_status)
        ");
        $stmt->execute([
            'order_id' => $orderId,
            'subtotal' => $totalAmount,
            'total' => $finalAmount, // Final amount after discount (discount is already applied)
            'payment_status' => 'Pending' // Will be updated after payment
        ]);
    }
    
    $transactionId = $pdo->lastInsertId();
    
    // Create transaction items
    foreach ($cartItems as $item) {
        $stmt = $pdo->prepare("
            INSERT INTO transaction_items (Order_ID, Product_ID, Quantity, Price)
            VALUES (:order_id, :product_id, :quantity, :price)
        ");
        $stmt->execute([
            'order_id' => $orderId,
            'product_id' => $item['product_id'],
            'quantity' => $item['quantity'],
            'price' => $item['price']
        ]);
    }
    
    // Stock will NOT be reduced at order creation
    // Stock will only be reduced after order is approved and payment is confirmed
    
    // Get customer name for notification
    $customerStmt = $pdo->prepare("
        SELECT CONCAT(COALESCE(First_Name, ''), ' ', COALESCE(Middle_Name, ''), ' ', COALESCE(Last_Name, '')) as customer_name
        FROM users
        WHERE User_ID = :user_id
    ");
    $customerStmt->execute(['user_id' => $_SESSION['user_id']]);
    $customer = $customerStmt->fetch(PDO::FETCH_ASSOC);
    $customerName = trim($customer['customer_name'] ?? 'Unknown Customer');
    
    // Create admin notification for new order
    try {
        // Check if notifications table exists, create if it doesn't
        $checkTableStmt = $pdo->query("SHOW TABLES LIKE 'admin_notifications'");
        $tableExists = $checkTableStmt->rowCount() > 0;
        
        if (!$tableExists) {
            // Create the notifications table
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `admin_notifications` (
                  `Notification_ID` int(11) NOT NULL AUTO_INCREMENT,
                  `Order_ID` int(11) NOT NULL,
                  `User_ID` int(11) NOT NULL,
                  `Customer_Name` varchar(255) NOT NULL,
                  `Order_Date` datetime NOT NULL,
                  `Message` text DEFAULT NULL,
                  `Is_Read` tinyint(1) DEFAULT 0,
                  `Created_At` timestamp NOT NULL DEFAULT current_timestamp(),
                  PRIMARY KEY (`Notification_ID`),
                  KEY `fk_notifications_order` (`Order_ID`),
                  KEY `fk_notifications_user` (`User_ID`),
                  KEY `idx_is_read` (`Is_Read`),
                  KEY `idx_created_at` (`Created_At`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
        }
        
        // Insert notification using the helper function
        require_once __DIR__ . '/create_admin_activity_notification.php';
        createAdminActivityNotification($pdo, 'order_created', [
            'order_id' => $orderId,
            'user_id' => $_SESSION['user_id'],
            'customer_name' => $customerName,
            'message' => "New order #{$orderId} from {$customerName}"
        ]);
    } catch (PDOException $e) {
        // Log error but don't fail the order creation if notification fails
        error_log("Failed to create admin notification: " . $e->getMessage());
    }
    
    $pdo->commit();
    
    ob_end_clean();
    echo json_encode([
        'success' => true,
        'message' => 'Order created successfully',
        'order_id' => $orderId,
        'transaction_id' => $transactionId,
        'delivery_id' => $deliveryId,
        'total_amount' => $totalAmount,
        'discount_percentage' => $discountPercentage,
        'discount_amount' => $discountAmount,
        'final_amount' => $finalAmount,
        'total_quantity' => $totalQuantity,
        'total_weight_kg' => $totalWeightKg
    ]);
    exit;
    
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ob_end_clean();
    error_log("Create Order Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to create order. Please try again.'
    ]);
    exit;
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ob_end_clean();
    error_log("Create Order Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to create order. Please try again.'
    ]);
    exit;
}
?>

