<?php
/**
 * Calculate Delivery Fee API
 * Calculates delivery fee based on distance from warehouse to delivery address
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';

// Get JSON input or query parameters
$input = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
} else {
    $input = $_GET;
}

if (!isset($input['address']) || empty($input['address'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Delivery address is required'
    ]);
    exit;
}

$deliveryAddress = trim($input['address']);

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Warehouse coordinates (your business location)
    // Update these coordinates to match your actual warehouse location
    $warehouseLat = 14.5995; // Example: Manila coordinates
    $warehouseLng = 120.9842;
    
    // Get delivery fee settings from order_settings
    $settingsStmt = $pdo->query("SELECT setting_key, setting_value FROM order_settings WHERE setting_key IN ('base_delivery_fee', 'fee_per_km', 'max_delivery_fee')");
    $settings = [];
    while ($row = $settingsStmt->fetch(PDO::FETCH_ASSOC)) {
        $settings[$row['setting_key']] = $row['setting_value'];
    }
    
    // Default values if not set
    $baseFee = (float)($settings['base_delivery_fee'] ?? 100); // Base delivery fee in PHP
    $feePerKm = (float)($settings['fee_per_km'] ?? 50); // Fee per kilometer
    $maxFee = (float)($settings['max_delivery_fee'] ?? 2000); // Maximum delivery fee
    
    // For now, we'll use a simple distance estimation based on address
    // In production, you would use Google Maps Geocoding API to get coordinates
    // and then calculate the actual distance
    
    // Simple distance estimation (placeholder - replace with actual geocoding)
    // This is a rough estimation. For accurate results, use Google Maps API
    $estimatedDistance = estimateDistanceFromAddress($deliveryAddress);
    
    // Calculate delivery fee
    $deliveryFee = $baseFee + ($estimatedDistance * $feePerKm);
    $deliveryFee = min($deliveryFee, $maxFee); // Cap at maximum fee
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'distance' => round($estimatedDistance, 2),
        'delivery_fee' => round($deliveryFee, 2),
        'base_fee' => $baseFee,
        'fee_per_km' => $feePerKm,
        'calculation' => [
            'base' => $baseFee,
            'distance_km' => round($estimatedDistance, 2),
            'distance_fee' => round($estimatedDistance * $feePerKm, 2),
            'total' => round($deliveryFee, 2)
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Calculate Delivery Fee Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error calculating delivery fee: ' . $e->getMessage()
    ]);
}

/**
 * Estimate distance from address (placeholder function)
 * In production, replace this with Google Maps Geocoding + Distance Matrix API
 */
function estimateDistanceFromAddress($address) {
    // This is a simplified estimation
    // For accurate results, use Google Maps API:
    // 1. Geocode the address to get coordinates
    // 2. Use Distance Matrix API to calculate actual distance
    
    // Simple heuristic: estimate based on address keywords
    $addressLower = strtolower($address);
    
    // Rough distance estimation based on region/city
    if (stripos($addressLower, 'metro manila') !== false || 
        stripos($addressLower, 'ncr') !== false ||
        stripos($addressLower, 'manila') !== false ||
        stripos($addressLower, 'quezon') !== false ||
        stripos($addressLower, 'makati') !== false ||
        stripos($addressLower, 'pasig') !== false) {
        return 15; // ~15 km average for Metro Manila
    } elseif (stripos($addressLower, 'caloocan') !== false ||
              stripos($addressLower, 'valenzuela') !== false ||
              stripos($addressLower, 'malabon') !== false) {
        return 20; // ~20 km for northern Metro Manila
    } elseif (stripos($addressLower, 'bulacan') !== false ||
              stripos($addressLower, 'pampanga') !== false) {
        return 50; // ~50 km for nearby provinces
    } else {
        return 30; // Default estimate
    }
    
    // TODO: Replace with actual Google Maps API integration
    // Example:
    // $geocodeUrl = "https://maps.googleapis.com/maps/api/geocode/json?address=" . urlencode($address) . "&key=YOUR_API_KEY";
    // $geocodeData = json_decode(file_get_contents($geocodeUrl), true);
    // $lat = $geocodeData['results'][0]['geometry']['location']['lat'];
    // $lng = $geocodeData['results'][0]['geometry']['location']['lng'];
    // Then use Haversine formula or Distance Matrix API
}

?>
