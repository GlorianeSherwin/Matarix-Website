<?php
/**
 * Migration: Add Volume Discount Settings to order_settings table
 * Adds default discount tier settings for volume-based discounts
 */

require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Check if order_settings table exists
    $tableExists = $pdo->query("SHOW TABLES LIKE 'order_settings'")->rowCount() > 0;
    
    if (!$tableExists) {
        echo "Error: order_settings table does not exist. Please run the main migration first.\n";
        exit(1);
    }
    
    // Default discount tier settings
    $defaultSettings = [
        'volume_discount_tier1_min' => ['value' => '20', 'description' => 'Minimum quantity for Tier 1 discount (5%)'],
        'volume_discount_tier1_percent' => ['value' => '5', 'description' => 'Tier 1 discount percentage (20+ items)'],
        'volume_discount_tier2_min' => ['value' => '50', 'description' => 'Minimum quantity for Tier 2 discount (10%)'],
        'volume_discount_tier2_percent' => ['value' => '10', 'description' => 'Tier 2 discount percentage (50+ items)'],
        'volume_discount_tier3_min' => ['value' => '100', 'description' => 'Minimum quantity for Tier 3 discount (15%)'],
        'volume_discount_tier3_percent' => ['value' => '15', 'description' => 'Tier 3 discount percentage (100+ items)'],
        'volume_discount_tier4_min' => ['value' => '200', 'description' => 'Minimum quantity for Tier 4 discount (20%)'],
        'volume_discount_tier4_percent' => ['value' => '20', 'description' => 'Tier 4 discount percentage (200+ items)']
    ];
    
    $pdo->beginTransaction();
    
    $added = 0;
    $updated = 0;
    
    foreach ($defaultSettings as $key => $data) {
        // Check if setting already exists
        $checkStmt = $pdo->prepare("SELECT setting_key FROM order_settings WHERE setting_key = :key");
        $checkStmt->execute(['key' => $key]);
        $exists = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($exists) {
            // Update existing setting
            $updateStmt = $pdo->prepare("
                UPDATE order_settings 
                SET setting_value = :value, 
                    description = :description,
                    updated_at = NOW()
                WHERE setting_key = :key
            ");
            $updateStmt->execute([
                'key' => $key,
                'value' => $data['value'],
                'description' => $data['description']
            ]);
            $updated++;
        } else {
            // Insert new setting
            $insertStmt = $pdo->prepare("
                INSERT INTO order_settings (setting_key, setting_value, description, updated_at)
                VALUES (:key, :value, :description, NOW())
            ");
            $insertStmt->execute([
                'key' => $key,
                'value' => $data['value'],
                'description' => $data['description']
            ]);
            $added++;
        }
    }
    
    $pdo->commit();
    
    echo "Migration completed successfully!\n";
    echo "Added: {$added} new settings\n";
    echo "Updated: {$updated} existing settings\n";
    echo "\nDefault discount tiers:\n";
    echo "- Tier 1: 20+ items = 5% discount\n";
    echo "- Tier 2: 50+ items = 10% discount\n";
    echo "- Tier 3: 100+ items = 15% discount\n";
    echo "- Tier 4: 200+ items = 20% discount\n";
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>
