<?php
/**
 * Add image columns to database tables
 * - proof_of_payment to transactions table
 * - profile_picture to users table
 */

require_once __DIR__ . '/../includes/db_functions.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$db = new DatabaseFunctions();

try {
    $pdo = $db->getConnection();
    
    // Add proof_of_payment column to transactions table
    $sql1 = "ALTER TABLE transactions ADD COLUMN proof_of_payment VARCHAR(255) DEFAULT NULL";
    $pdo->exec($sql1);
    
    // Add profile_picture column to users table
    $sql2 = "ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL";
    $pdo->exec($sql2);
    
    // Add payment_method column to orders table if it doesn't exist
    try {
        $sql3 = "ALTER TABLE orders ADD COLUMN payment_method ENUM('GCash', 'On-Site') DEFAULT 'On-Site'";
        $pdo->exec($sql3);
    } catch (PDOException $e) {
        // Column might already exist, ignore
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Image columns added successfully'
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error adding columns: ' . $e->getMessage()
    ]);
}
?>

