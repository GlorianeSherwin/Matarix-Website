<?php
/**
 * Database Migration: Add Order Settings Table
 * Creates order_settings table for minimum order configuration
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    $pdo->beginTransaction();
    $results = [];

    // Check if order_settings table exists
    $checkTable = $pdo->query("SHOW TABLES LIKE 'order_settings'");
    if ($checkTable->rowCount() == 0) {
        // Create order_settings table
        $pdo->exec("
            CREATE TABLE order_settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value VARCHAR(255) NOT NULL,
                description TEXT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        $results[] = "Created 'order_settings' table.";
    } else {
        $results[] = "'order_settings' table already exists, skipping creation.";
    }

    // Get smallest vehicle capacity to calculate default minimum
    $smallestCapacity = null;
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
    }

    // Calculate default minimum (25% of smallest vehicle capacity, or 200 kg if no vehicles)
    $defaultMinWeight = 200; // Default fallback
    if ($smallestCapacity) {
        $defaultMinWeight = max(50, round($smallestCapacity * 0.25, 2)); // At least 50 kg, or 25% of smallest vehicle
    }

    // Insert or update default settings
    $settings = [
        [
            'key' => 'min_order_weight_kg',
            'value' => (string)$defaultMinWeight,
            'description' => 'Minimum order weight in kilograms. Orders below this weight will be rejected.'
        ],
        [
            'key' => 'min_order_weight_percentage',
            'value' => '25',
            'description' => 'Percentage of smallest vehicle capacity to use as minimum (if auto-calculated).'
        ],
        [
            'key' => 'min_order_value',
            'value' => '0',
            'description' => 'Minimum order value in pesos. Set to 0 to disable. Can be combined with weight minimum (OR condition).'
        ],
        [
            'key' => 'allow_below_minimum_with_fee',
            'value' => '0',
            'description' => 'Allow orders below minimum with premium delivery fee (1 = yes, 0 = no).'
        ],
        [
            'key' => 'premium_delivery_fee',
            'value' => '500',
            'description' => 'Premium delivery fee in pesos for orders below minimum weight.'
        ],
        [
            'key' => 'allow_heavy_single_items',
            'value' => '1',
            'description' => 'Allow single items that exceed minimum weight (1 = yes, 0 = no).'
        ],
        [
            'key' => 'auto_calculate_from_fleet',
            'value' => '1',
            'description' => 'Auto-calculate minimum from smallest vehicle capacity (1 = yes, 0 = use fixed value).'
        ]
    ];

    foreach ($settings as $setting) {
        $checkStmt = $pdo->prepare("SELECT setting_key FROM order_settings WHERE setting_key = :key");
        $checkStmt->execute(['key' => $setting['key']]);
        
        if ($checkStmt->rowCount() == 0) {
            $insertStmt = $pdo->prepare("
                INSERT INTO order_settings (setting_key, setting_value, description)
                VALUES (:key, :value, :description)
            ");
            $insertStmt->execute([
                'key' => $setting['key'],
                'value' => $setting['value'],
                'description' => $setting['description']
            ]);
            $results[] = "Inserted default setting: {$setting['key']} = {$setting['value']}";
        } else {
            // Update description if it exists but is different
            $updateStmt = $pdo->prepare("
                UPDATE order_settings 
                SET description = :description 
                WHERE setting_key = :key
            ");
            $updateStmt->execute([
                'key' => $setting['key'],
                'description' => $setting['description']
            ]);
            $results[] = "Setting {$setting['key']} already exists, updated description.";
        }
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Order settings migration completed successfully',
        'results' => $results,
        'default_min_weight' => $defaultMinWeight,
        'smallest_vehicle_capacity' => $smallestCapacity
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Order settings migration error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred during order settings migration: ' . $e->getMessage()
    ]);
}
?>

