<?php
/**
 * Test Database Connection to "u634157906_matarik" Database
 * This script verifies that the system can connect to the u634157906_matarik database in XAMPP
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

$result = [
    'success' => false,
    'message' => '',
    'details' => []
];

try {
    // Initialize database connection
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    $result['success'] = true;
    $result['message'] = 'Successfully connected to database!';
    
    // Get database name
    $stmt = $pdo->query("SELECT DATABASE() as db_name");
    $dbInfo = $stmt->fetch();
    $result['details']['database_name'] = $dbInfo['db_name'];
    
    // Get MySQL version
    $stmt = $pdo->query("SELECT VERSION() as version");
    $versionInfo = $stmt->fetch();
    $result['details']['mysql_version'] = $versionInfo['version'];
    
    // Check if orders table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'orders'");
    $result['details']['orders_table_exists'] = $stmt->rowCount() > 0;
    
    // Check if users table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    $result['details']['users_table_exists'] = $stmt->rowCount() > 0;
    
    // Check orders table structure (check for new statuses)
    if ($result['details']['orders_table_exists']) {
        $stmt = $pdo->query("SHOW COLUMNS FROM orders WHERE Field = 'status'");
        $statusColumn = $stmt->fetch();
        if ($statusColumn) {
            $result['details']['orders_status_column'] = $statusColumn['Type'];
            
            // Check if 'Pending Approval' and 'Rejected' are in the enum
            $hasPendingApproval = strpos($statusColumn['Type'], 'Pending Approval') !== false;
            $hasRejected = strpos($statusColumn['Type'], 'Rejected') !== false;
            
            $result['details']['has_pending_approval_status'] = $hasPendingApproval;
            $result['details']['has_rejected_status'] = $hasRejected;
            
            if (!$hasPendingApproval || !$hasRejected) {
                $result['message'] = 'Connected successfully, but migration may be needed!';
                $result['details']['migration_needed'] = true;
                $result['details']['migration_file'] = 'api/migrate_order_approval_status.sql';
            }
        }
    }
    
    // Get connection info
    $result['details']['connection_host'] = 'localhost';
    $result['details']['connection_port'] = '3306';
    $result['details']['connection_username'] = 'u634157906_matarik';
    
    // Count tables
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $result['details']['total_tables'] = count($tables);
    $result['details']['table_list'] = $tables;
    
} catch (Exception $e) {
    $result['success'] = false;
    $result['message'] = 'Database connection failed!';
    $result['error'] = $e->getMessage();
    $result['details']['suggestion'] = 'Local: Ensure XAMPP MySQL is running and database exists. Hostinger: Copy config/database.local.php.example to config/database.local.php and set your MySQL host, database name, username, and password from hPanel → Databases.';
}

echo json_encode($result, JSON_PRETTY_PRINT);
?>

