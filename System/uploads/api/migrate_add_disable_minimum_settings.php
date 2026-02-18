<?php
/**
 * Migration: Add disable minimum weight and disable minimum order value settings
 * Ensures these settings exist in order_settings for existing installations
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    $newSettings = [
        [
            'key' => 'disable_minimum_weight',
            'value' => '0',
            'description' => 'When 1, minimum order weight is not enforced. Orders of any weight accepted.'
        ],
        [
            'key' => 'disable_minimum_order_value',
            'value' => '0',
            'description' => 'When 1, minimum order value is not enforced. Orders of any value accepted.'
        ]
    ];
    
    $results = [];
    foreach ($newSettings as $setting) {
        $stmt = $pdo->prepare("SELECT setting_key FROM order_settings WHERE setting_key = :key");
        $stmt->execute(['key' => $setting['key']]);
        
        if ($stmt->rowCount() == 0) {
            $insert = $pdo->prepare("
                INSERT INTO order_settings (setting_key, setting_value, description)
                VALUES (:key, :value, :description)
            ");
            $insert->execute([
                'key' => $setting['key'],
                'value' => $setting['value'],
                'description' => $setting['description']
            ]);
            $results[] = "Inserted: {$setting['key']} = {$setting['value']}";
        } else {
            $results[] = "Already exists: {$setting['key']}";
        }
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Disable minimum settings migration completed',
        'results' => $results
    ]);
    
} catch (Exception $e) {
    error_log("Disable minimum settings migration error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
