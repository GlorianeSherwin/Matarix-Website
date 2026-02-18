<?php
/**
 * Create SMS Configuration Table
 * Stores SMS API credentials and settings
 */

require_once __DIR__ . '/../connection.php';

try {
    // Create sms_config table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS sms_config (
            id INT PRIMARY KEY AUTO_INCREMENT,
            provider VARCHAR(50) NOT NULL DEFAULT 'semaphore',
            api_key VARCHAR(255) NOT NULL,
            sender_name VARCHAR(50) DEFAULT 'Matarix',
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    
    echo "✓ SMS config table created successfully\n";
    
    // Check if API key already exists
    $stmt = $pdo->query("SELECT COUNT(*) FROM sms_config WHERE provider = 'semaphore'");
    $count = $stmt->fetchColumn();
    
    if ($count == 0) {
        // Insert default Semaphore API configuration
        $apiKey = 'add888fb40ec6d6f131f6f8eb03f294c';
        $stmt = $pdo->prepare("
            INSERT INTO sms_config (provider, api_key, sender_name, is_active) 
            VALUES ('semaphore', :api_key, 'Matarix', 1)
        ");
        $stmt->execute(['api_key' => $apiKey]);
        echo "✓ Semaphore API key configured\n";
    } else {
        echo "✓ SMS config already exists\n";
    }
    
    // Create SMS logs table to track sent messages
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS sms_logs (
            id INT PRIMARY KEY AUTO_INCREMENT,
            phone_number VARCHAR(20) NOT NULL,
            message TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            order_id INT DEFAULT NULL,
            delivery_status VARCHAR(50) DEFAULT NULL,
            response TEXT DEFAULT NULL,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(Order_ID) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    
    echo "✓ SMS logs table created successfully\n";
    echo "\n✅ SMS configuration setup complete!\n";
    
} catch (PDOException $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
