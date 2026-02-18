<?php
/**
 * Add Status Column to Users Table
 * Adds a status column to the users table if it doesn't exist
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: schema changes should be Admin-only
rbac_require_permission_api('system.configure');

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Check if status column exists
    $stmt = $pdo->query("
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'status'
    ");
    $columnExists = $stmt->fetch();
    
    if (!$columnExists) {
        // Add status column
        $pdo->exec("
            ALTER TABLE users 
            ADD COLUMN status ENUM('active', 'inactive', 'pending', 'archived') 
            DEFAULT 'active'
        ");
        
        // Update existing users to have 'active' status
        $pdo->exec("UPDATE users SET status = 'active' WHERE status IS NULL");
        
        echo json_encode([
            'success' => true,
            'message' => 'Status column added successfully'
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'message' => 'Status column already exists'
        ]);
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error adding status column: ' . $e->getMessage()
    ]);
}
?>

