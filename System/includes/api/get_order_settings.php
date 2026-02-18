<?php
/**
 * Get Order Settings API
 * Returns minimum order configuration settings
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Cache-Control: no-cache, no-store, must-revalidate'); // Prevent browser caching
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Get all order settings (description is optional - some older tables don't have it)
    $stmt = $pdo->query("SELECT setting_key, setting_value FROM order_settings");
    $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Convert to key-value array
    $settingsArray = [];
    foreach ($settings as $setting) {
        $settingsArray[$setting['setting_key']] = $setting['setting_value'];
    }
    
    // Auto-migration: ensure disable_minimum_weight and disable_minimum_order_value exist (no separate migration URL needed)
    $disableSettingsToEnsure = [
        'disable_minimum_weight' => ['value' => '0', 'desc' => 'When 1, minimum order weight is not enforced.'],
        'disable_minimum_order_value' => ['value' => '0', 'desc' => 'When 1, minimum order value is not enforced.']
    ];
    foreach ($disableSettingsToEnsure as $key => $def) {
        if (!isset($settingsArray[$key])) {
            try {
                $ins = $pdo->prepare("INSERT INTO order_settings (setting_key, setting_value) VALUES (:k, :v) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
                $ins->execute(['k' => $key, 'v' => $def['value']]);
                $settingsArray[$key] = $def['value'];
            } catch (Exception $e) {
                error_log("Could not auto-insert {$key}: " . $e->getMessage());
            }
        }
    }
    
    // Get smallest vehicle capacity if auto-calculate is enabled
    $minWeightKg = (float)($settingsArray['min_order_weight_kg'] ?? 200);
    
    if (isset($settingsArray['auto_calculate_from_fleet']) && $settingsArray['auto_calculate_from_fleet'] == '1') {
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
            $percentage = (float)($settingsArray['min_order_weight_percentage'] ?? 25);
            
            // Calculate minimum: smallestCapacity * percentage / 100
            // Round to 2 decimal places
            $calculatedMin = round($smallestCapacity * ($percentage / 100), 2);
            
            // Apply safety floor: max(50, calculated) only if calculated is less than 50
            // This ensures minimum is never below 50kg for safety, but allows higher values
            // However, if user wants lower minimums, we should respect their percentage choice
            // So we'll use the calculated value directly, but ensure it's at least 1kg (reasonable minimum)
            $calculatedMin = max(1, $calculatedMin); // Minimum 1kg to prevent zero or negative
            $minWeightKg = $calculatedMin;
            
            // Log for debugging
            error_log("Order Settings Calculation: smallestCapacity={$smallestCapacity}kg, percentage={$percentage}%, calculatedMin={$calculatedMin}kg");
        } else {
            error_log("Order Settings: No fleet capacity found, using default min_weight_kg");
        }
    }
    
    // Apply disable flags to effective minimums - when disabled, effective minimum is 0
    $disableMinWeight = isset($settingsArray['disable_minimum_weight']) && $settingsArray['disable_minimum_weight'] == '1';
    $disableMinValue = isset($settingsArray['disable_minimum_order_value']) && $settingsArray['disable_minimum_order_value'] == '1';
    $effectiveMinWeightKg = $disableMinWeight ? 0 : $minWeightKg;
    $effectiveMinValue = $disableMinValue ? 0 : (float)($settingsArray['min_order_value'] ?? 0);
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'settings' => [
            'min_order_weight_kg' => $effectiveMinWeightKg,
            'min_order_weight_percentage' => (float)($settingsArray['min_order_weight_percentage'] ?? 25),
            'min_order_value' => $effectiveMinValue,
            'disable_minimum_weight' => (bool)($disableMinWeight),
            'disable_minimum_order_value' => (bool)($disableMinValue),
            'allow_below_minimum_with_fee' => (bool)($settingsArray['allow_below_minimum_with_fee'] ?? '0'),
            'premium_delivery_fee' => (float)($settingsArray['premium_delivery_fee'] ?? 500),
            'volume_discount_tier1_min' => (int)($settingsArray['volume_discount_tier1_min'] ?? 20),
            'volume_discount_tier1_percent' => (float)($settingsArray['volume_discount_tier1_percent'] ?? 5),
            'volume_discount_tier2_min' => (int)($settingsArray['volume_discount_tier2_min'] ?? 50),
            'volume_discount_tier2_percent' => (float)($settingsArray['volume_discount_tier2_percent'] ?? 10),
            'volume_discount_tier3_min' => (int)($settingsArray['volume_discount_tier3_min'] ?? 100),
            'volume_discount_tier3_percent' => (float)($settingsArray['volume_discount_tier3_percent'] ?? 15),
            'volume_discount_tier4_min' => (int)($settingsArray['volume_discount_tier4_min'] ?? 200),
            'volume_discount_tier4_percent' => (float)($settingsArray['volume_discount_tier4_percent'] ?? 20),
            'allow_heavy_single_items' => (bool)($settingsArray['allow_heavy_single_items'] ?? '1'),
            'auto_calculate_from_fleet' => (bool)($settingsArray['auto_calculate_from_fleet'] ?? '1'),
            'min_advance_notice_days' => (int)($settingsArray['min_advance_notice_days'] ?? 3),
            'max_advance_notice_days' => (int)($settingsArray['max_advance_notice_days'] ?? 30),
            'max_deliveries_per_day' => (int)($settingsArray['max_deliveries_per_day'] ?? 0)
        ],
        'raw_settings' => $settingsArray
    ]);
    
} catch (Exception $e) {
    error_log("Get Order Settings Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to get order settings: ' . $e->getMessage(),
        'settings' => [
            'min_order_weight_kg' => 200, // Fallback default
            'min_order_value' => 0,
            'allow_below_minimum_with_fee' => false,
            'premium_delivery_fee' => 500,
            'allow_heavy_single_items' => true,
            'auto_calculate_from_fleet' => true
        ]
    ]);
}
?>

