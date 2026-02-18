<?php
/**
 * Get Available Time Slots API
 * Returns available time slots for a given date (7:00 AM - 6:00 PM only)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';

$date = $_GET['date'] ?? null;

// Validate input
if (!$date) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Date parameter is required (format: YYYY-MM-DD)'
    ]);
    exit;
}

// Validate date format
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid date format. Expected YYYY-MM-DD'
    ]);
    exit;
}

// Validate date is not in the past
$selectedDate = new DateTime($date);
$today = new DateTime('today');
if ($selectedDate < $today) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Cannot select a date in the past'
    ]);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Get unavailable dates from order_settings
    $unavailableDates = [];
    $settingsStmt = $pdo->query("SELECT setting_value FROM order_settings WHERE setting_key = 'unavailable_dates'");
    $settings = $settingsStmt->fetch(PDO::FETCH_ASSOC);
    if ($settings && $settings['setting_value']) {
        $unavailableDates = json_decode($settings['setting_value'], true) ?? [];
    }
    
    // Check if selected date is unavailable
    if (in_array($date, $unavailableDates)) {
        echo json_encode([
            'success' => true,
            'date' => $date,
            'available' => false,
            'message' => 'This date is not available for delivery',
            'slots' => []
        ]);
        exit;
    }
    
    // Get existing deliveries for this date to check capacity
    $deliveriesStmt = $pdo->prepare("
        SELECT 
            o.availability_time,
            COUNT(*) as delivery_count
        FROM orders o
        INNER JOIN deliveries d ON o.Order_ID = d.Order_ID
        WHERE o.availability_date = :date
        AND d.Delivery_Status NOT IN ('Cancelled', 'Delivered')
        AND o.availability_time IS NOT NULL
        GROUP BY o.availability_time
    ");
    $deliveriesStmt->execute(['date' => $date]);
    $existingDeliveries = $deliveriesStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Create time slot map (7:00 AM - 6:00 PM)
    $slots = [];
    $startHour = 7; // 7:00 AM
    $endHour = 18;  // 6:00 PM (18:00)
    
    // Generate hourly slots from 7 AM to 6 PM
    for ($hour = $startHour; $hour <= $endHour; $hour++) {
        $timeStr = str_pad($hour, 2, '0', STR_PAD_LEFT) . ':00:00';
        $timeDisplay = date('g:i A', strtotime($timeStr));
        
        // Count existing deliveries for this time slot
        $existingCount = 0;
        foreach ($existingDeliveries as $delivery) {
            if ($delivery['availability_time'] === $timeStr) {
                $existingCount = (int)$delivery['delivery_count'];
                break;
            }
        }
        
        // Assume max 5 deliveries per time slot (can be configured)
        $maxPerSlot = 5;
        $isAvailable = $existingCount < $maxPerSlot;
        
        $slots[] = [
            'time' => $timeStr,
            'display' => $timeDisplay,
            'hour' => $hour,
            'available' => $isAvailable,
            'existing_count' => $existingCount,
            'max_capacity' => $maxPerSlot
        ];
    }
    
    // Also check for half-hour slots if needed (optional - can be enabled)
    // For now, we'll use hourly slots only
    
    echo json_encode([
        'success' => true,
        'date' => $date,
        'available' => true,
        'slots' => $slots,
        'business_hours' => [
            'start' => '07:00:00',
            'end' => '18:00:00',
            'start_display' => '7:00 AM',
            'end_display' => '6:00 PM'
        ]
    ]);
    
} catch (PDOException $e) {
    error_log("Get Available Slots Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch available slots: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Get Available Slots Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch available slots: ' . $e->getMessage()
    ]);
}
?>
