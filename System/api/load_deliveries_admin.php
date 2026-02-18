<?php
/**
 * Load Deliveries for Admin Interface
 * Returns all deliveries with order and customer information
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

// Always start admin session (startSession handles switching if wrong session is active)
startSession('admin');

$userRole = $_SESSION['user_role'] ?? '';
$userId = $_SESSION['user_id'] ?? null;

// Debug logging (remove in production)
error_log("Load Deliveries Admin - User ID: " . ($userId ?? 'not set'));
error_log("Load Deliveries Admin - User Role: " . ($userRole ?? 'not set'));
error_log("Load Deliveries Admin - Session data: " . json_encode($_SESSION));

// RBAC: drivers can view assigned deliveries only, staff can view deliveries admin view
$normalizedRole = trim((string)$userRole);
$isDriver = ($normalizedRole === 'Delivery Driver');
if ($isDriver) {
    rbac_require_permission_api('deliveries.view_assigned');
} else {
    rbac_require_permission_api('deliveries.view');
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Get all deliveries with order and customer information
    // Admin: sees all deliveries. Delivery Driver: sees only deliveries assigned to them (filtered below).
    // Only Standard Delivery orders (exclude Pick Up)
    $checkDeliveryMethodColumn = $pdo->query("SHOW COLUMNS FROM orders LIKE 'delivery_method'")->rowCount() > 0;
    $deliveryMethodFilter = $checkDeliveryMethodColumn
        ? " AND (o.delivery_method IS NULL OR TRIM(COALESCE(o.delivery_method,'')) = '' OR o.delivery_method = 'Standard Delivery') "
        : " ";

    $sql = "
        SELECT 
            COALESCE(d.Delivery_ID, 0) as Delivery_ID,
            o.Order_ID,
            COALESCE(d.Delivery_Status, 'Pending') as Delivery_Status,
            d.delivery_details,
            d.Driver_ID,
            d.Vehicle_ID,
            COALESCE(d.Created_At, o.order_date) as Created_At,
            COALESCE(d.Updated_At, o.order_date) as Updated_At,
            o.User_ID as Customer_ID,
            o.amount,
            o.status as Order_Status,
            o.payment as Payment_Status,
            o.order_date,
            o.delivery_method,
            o.availability_date,
            o.availability_time,
            u.First_Name as Customer_First_Name,
            u.Last_Name as Customer_Last_Name,
            u.address as Customer_Address,
            u.Phone_Number as Customer_Phone,
            u.email as Customer_Email,
            driver.First_Name as Driver_First_Name,
            driver.Last_Name as Driver_Last_Name,
            driver.email as Driver_Email,
            f.vehicle_model,
            f.status as Vehicle_Status
        FROM orders o
        LEFT JOIN deliveries d ON o.Order_ID = d.Order_ID
        LEFT JOIN users u ON o.User_ID = u.User_ID
        LEFT JOIN users driver ON d.Driver_ID = driver.User_ID
        LEFT JOIN fleet f ON d.Vehicle_ID = f.Vehicle_ID
        WHERE LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'deleted', 'pending approval', 'rejected')
        AND o.Order_ID IS NOT NULL
        " . $deliveryMethodFilter . "
        ORDER BY o.order_date DESC, o.Order_ID DESC
    ";

    $stmt = $pdo->query($sql);
    $deliveries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Log for debugging
    error_log("Load Deliveries Admin - Found " . count($deliveries) . " deliveries/orders");
    
    // Get order items for each delivery and create delivery records if missing
    foreach ($deliveries as &$delivery) {
        // If delivery record doesn't exist (Delivery_ID = 0 or null), create it
        if (empty($delivery['Delivery_ID']) && $delivery['Order_ID']) {
            try {
                // Determine delivery status based on order status
                $orderStatus = $delivery['Order_Status'] ?? 'Pending Approval';
                $deliveryStatus = 'Pending'; // Default
                
                // If order is "Ready", set delivery status to "Preparing" (ready for assignment)
                if ($orderStatus === 'Ready') {
                    $deliveryStatus = 'Preparing';
                } elseif ($orderStatus === 'Processing') {
                    $deliveryStatus = 'Preparing';
                } elseif ($orderStatus === 'Waiting Payment') {
                    $deliveryStatus = 'Pending';
                }
                
                $stmt = $pdo->prepare("
                    INSERT INTO deliveries (Order_ID, Delivery_Status, Created_At, Updated_At)
                    VALUES (:order_id, :delivery_status, NOW(), NOW())
                ");
                $stmt->execute([
                    'order_id' => $delivery['Order_ID'],
                    'delivery_status' => $deliveryStatus
                ]);
                $delivery['Delivery_ID'] = $pdo->lastInsertId();
                $delivery['Delivery_Status'] = $deliveryStatus;
                $delivery['Created_At'] = date('Y-m-d H:i:s');
                $delivery['Updated_At'] = date('Y-m-d H:i:s');
                error_log("Auto-created delivery record for Order_ID: {$delivery['Order_ID']} with status: {$deliveryStatus} (order status: {$orderStatus})");
            } catch (PDOException $e) {
                error_log("Failed to auto-create delivery for Order_ID {$delivery['Order_ID']}: " . $e->getMessage());
            }
        } else if (!empty($delivery['Delivery_ID']) && $delivery['Order_ID']) {
            // REMOVED: Auto-updating delivery status based on order status
            // This was overwriting user-selected statuses. Delivery status should only be changed
            // by explicit admin/driver actions, not automatically based on order status.
            // The delivery status is independent of order status and should persist user selections.
            
            // Only update if delivery status is NULL or empty (not if it's already set)
            $currentDeliveryStatus = $delivery['Delivery_Status'] ?? null;
            if (empty($currentDeliveryStatus) || trim($currentDeliveryStatus) === '') {
                $orderStatus = $delivery['Order_Status'] ?? 'Pending Approval';
                $deliveryStatus = 'Pending'; // Default
                
                // Only set initial status if delivery status is truly empty
                if ($orderStatus === 'Ready') {
                    $deliveryStatus = 'Preparing';
                } elseif ($orderStatus === 'Processing') {
                    $deliveryStatus = 'Preparing';
                } elseif ($orderStatus === 'Waiting Payment') {
                    $deliveryStatus = 'Pending';
                }
                
                try {
                    $stmt = $pdo->prepare("
                        UPDATE deliveries 
                        SET Delivery_Status = :delivery_status,
                            Updated_At = NOW()
                        WHERE Order_ID = :order_id AND (Delivery_Status IS NULL OR TRIM(Delivery_Status) = '')
                    ");
                    $stmt->execute([
                        'order_id' => $delivery['Order_ID'],
                        'delivery_status' => $deliveryStatus
                    ]);
                    $delivery['Delivery_Status'] = $deliveryStatus;
                    $delivery['Updated_At'] = date('Y-m-d H:i:s');
                    error_log("Set initial delivery status to '{$deliveryStatus}' for Order_ID: {$delivery['Order_ID']} (delivery status was empty)");
                } catch (PDOException $e) {
                    error_log("Failed to set initial delivery status for Order_ID {$delivery['Order_ID']}: " . $e->getMessage());
                }
            }
            // If delivery status is already set, DO NOT overwrite it - preserve user selections
        }
        
        if ($delivery['Order_ID']) {
            // Get order items
            $stmt = $pdo->prepare("
                SELECT 
                    ti.Item_ID,
                    ti.Product_ID,
                    ti.Quantity,
                    ti.Price,
                    p.Product_Name,
                    p.category
                FROM transaction_items ti
                JOIN products p ON ti.Product_ID = p.Product_ID
                WHERE ti.Order_ID = :order_id
            ");
            $stmt->execute(['order_id' => $delivery['Order_ID']]);
            $delivery['items'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Get availability slots
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
            $slotStmt->execute(['order_id' => $delivery['Order_ID']]);
            $delivery['availability_slots'] = $slotStmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Set preferred slot as primary availability (for backward compatibility)
            $preferredSlot = null;
            foreach ($delivery['availability_slots'] as $slot) {
                if ($slot['is_preferred']) {
                    $preferredSlot = $slot;
                    break;
                }
            }
            if (!$preferredSlot && !empty($delivery['availability_slots'])) {
                $preferredSlot = $delivery['availability_slots'][0];
            }
            if ($preferredSlot) {
                $delivery['availability_date'] = $preferredSlot['availability_date'];
                $delivery['availability_time'] = $preferredSlot['availability_time'];
            }
        } else {
            $delivery['items'] = [];
        }
        
        // Format customer name
        $delivery['customer_name'] = trim(($delivery['Customer_First_Name'] ?? '') . ' ' . ($delivery['Customer_Last_Name'] ?? ''));
        $delivery['driver_name'] = trim(($delivery['Driver_First_Name'] ?? '') . ' ' . ($delivery['Driver_Last_Name'] ?? ''));
        
        // Get multiple drivers from junction table if it exists
        $delivery['drivers'] = [];
        $delivery['vehicles'] = [];
        
        if ($delivery['Delivery_ID'] && $delivery['Delivery_ID'] > 0) {
            // Check if junction tables exist
            try {
                $checkStmt = $pdo->query("SHOW TABLES LIKE 'delivery_drivers'");
                if ($checkStmt->rowCount() > 0) {
                    // Get all drivers for this delivery
                    $driverStmt = $pdo->prepare("
                        SELECT 
                            dd.Driver_ID,
                            CONCAT(u.First_Name, ' ', COALESCE(u.Middle_Name, ''), ' ', u.Last_Name) as driver_name,
                            u.email as driver_email
                        FROM delivery_drivers dd
                        LEFT JOIN users u ON dd.Driver_ID = u.User_ID
                        WHERE dd.Delivery_ID = :delivery_id
                    ");
                    $driverStmt->execute(['delivery_id' => $delivery['Delivery_ID']]);
                    $delivery['drivers'] = $driverStmt->fetchAll(PDO::FETCH_ASSOC);
                    
                    // Get all vehicles for this delivery
                    $vehicleStmt = $pdo->prepare("
                        SELECT 
                            dv.Vehicle_ID,
                            f.vehicle_model,
                            f.status as vehicle_status
                        FROM delivery_vehicles dv
                        LEFT JOIN fleet f ON dv.Vehicle_ID = f.Vehicle_ID
                        WHERE dv.Delivery_ID = :delivery_id
                    ");
                    $vehicleStmt->execute(['delivery_id' => $delivery['Delivery_ID']]);
                    $delivery['vehicles'] = $vehicleStmt->fetchAll(PDO::FETCH_ASSOC);
                }
            } catch (Exception $e) {
                // Junction tables don't exist, use single driver/vehicle from main table
                error_log("Junction tables not found, using single driver/vehicle: " . $e->getMessage());
            }
        }
        
        // For backward compatibility, if no drivers/vehicles from junction table, use single ones
        if (empty($delivery['drivers']) && $delivery['Driver_ID']) {
            $delivery['drivers'] = [[
                'Driver_ID' => $delivery['Driver_ID'],
                'driver_name' => $delivery['driver_name']
            ]];
        }
        if (empty($delivery['vehicles']) && $delivery['Vehicle_ID']) {
            $delivery['vehicles'] = [[
                'Vehicle_ID' => $delivery['Vehicle_ID'],
                'vehicle_model' => $delivery['vehicle_model']
            ]];
        }
    }
    
    // Delivery Driver: show only deliveries assigned to this driver (admin sees all)
    if ($isDriver && $userId) {
        $deliveries = array_values(array_filter($deliveries, function ($d) use ($userId) {
            if (!empty($d['drivers']) && is_array($d['drivers'])) {
                foreach ($d['drivers'] as $dr) {
                    if (isset($dr['Driver_ID']) && (int) $dr['Driver_ID'] === (int) $userId) {
                        return true;
                    }
                }
            }
            return isset($d['Driver_ID']) && (int) $d['Driver_ID'] === (int) $userId;
        }));
    }
    
    // Calculate statistics
    $totalDeliveries = count($deliveries);
    $activeDeliveries = count(array_filter($deliveries, function($d) {
        $status = $d['Delivery_Status'] ?? 'Pending';
        return in_array($status, ['Pending', 'Preparing', 'Out for Delivery']);
    }));
    
    // Get unique active drivers
    $activeDrivers = array_unique(array_filter(array_column($deliveries, 'Driver_ID')));
    $activeDriversCount = count($activeDrivers);
    
    echo json_encode([
        'success' => true,
        'deliveries' => $deliveries,
        'statistics' => [
            'total_deliveries' => $totalDeliveries,
            'active_deliveries' => $activeDeliveries,
            'active_drivers' => $activeDriversCount
        ]
    ]);
    
} catch (PDOException $e) {
    error_log("Load Deliveries Admin Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch deliveries: ' . $e->getMessage()
    ]);
}
?>

