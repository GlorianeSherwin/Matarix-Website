<?php
/**
 * Add Last Login Column to Users Table
 * Adds a last_login column to track when users last logged in
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
    // Check if last_login column exists
    $stmt = $pdo->query("
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'last_login'
    ");
    $columnExists = $stmt->fetch();
    
    if (!$columnExists) {
        // Add last_login column
        $pdo->exec("
            ALTER TABLE users 
            ADD COLUMN last_login DATETIME DEFAULT NULL
        ");
        
        echo json_encode([
            'success' => true,
            'message' => 'Last login column added successfully'
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'message' => 'Last login column already exists'
        ]);
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error adding last_login column: ' . $e->getMessage()
    ]);
}
?>

