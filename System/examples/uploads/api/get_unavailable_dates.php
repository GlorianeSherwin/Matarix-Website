<?php
/**
 * Get Unavailable Dates API
 * Returns dates that are fully booked (max deliveries/orders per day reached) or unavailable for delivery
 */

header('Content-Type: application/json');
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 
          (isset($_SERVER['HTTP_REFERER']) ? parse_url($_SERVER['HTTP_REFERER'], PHP_URL_SCHEME) . '://' . parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST) : '*');
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/error_handler.php';

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    // Get max_deliveries_per_day from order_settings (0 = no limit)
    $maxPerDay = 0;
    $stmt = $pdo->query("SELECT setting_value FROM order_settings WHERE setting_key = 'max_deliveries_per_day'");
    if ($stmt && $row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $maxPerDay = (int) $row['setting_value'];
    }

    $unavailableDates = [];

    if ($maxPerDay > 0) {
        // Count orders per availability_date (exclude Rejected and Cancelled)
        $sql = "
            SELECT availability_date, COUNT(*) as cnt
            FROM orders
            WHERE availability_date IS NOT NULL
              AND TRIM(COALESCE(status, '')) NOT IN ('Rejected', 'Cancelled')
            GROUP BY availability_date
            HAVING cnt >= :max_per_day
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['max_per_day' => $maxPerDay]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as $row) {
            $date = $row['availability_date'];
            if ($date) {
                $unavailableDates[] = [
                    'date' => $date,
                    'reason' => 'Max deliveries/orders reached for this day'
                ];
            }
        }
    }

    echo json_encode([
        'success' => true,
        'unavailable_dates' => $unavailableDates
    ]);

} catch (PDOException $e) {
    error_log("Get Unavailable Dates Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred. Please try again later.',
        'unavailable_dates' => []
    ]);
} catch (Exception $e) {
    error_log("Get Unavailable Dates Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred. Please try again later.',
        'unavailable_dates' => []
    ]);
}

