<?php
/**
 * Comprehensive Database Diagnostic Tool
 * Checks all potential issues with the deliveries table and related tables
 * 
 * Access via: http://localhost/MatarixWEBs/api/diagnose_database.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    $diagnostics = [
        'timestamp' => date('Y-m-d H:i:s'),
        'deliveries_table' => [],
        'issues' => [],
        'recommendations' => []
    ];
    
    // ==========================================
    // 1. Check deliveries table structure
    // ==========================================
    $stmt = $pdo->query("SHOW CREATE TABLE deliveries");
    $tableInfo = $stmt->fetch(PDO::FETCH_ASSOC);
    $createTable = $tableInfo['Create Table'] ?? '';
    
    $diagnostics['deliveries_table']['create_statement'] = $createTable;
    $diagnostics['deliveries_table']['has_auto_increment'] = strpos($createTable, 'AUTO_INCREMENT') !== false;
    
    // Check column definition
    $stmt = $pdo->query("DESCRIBE deliveries");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $diagnostics['deliveries_table']['columns'] = $columns;
    
    // Find Delivery_ID column
    $deliveryIdColumn = null;
    foreach ($columns as $col) {
        if ($col['Field'] === 'Delivery_ID') {
            $deliveryIdColumn = $col;
            break;
        }
    }
    
    $diagnostics['deliveries_table']['delivery_id_column'] = $deliveryIdColumn;
    
    // ==========================================
    // 2. Check for problematic records
    // ==========================================
    $stmt = $pdo->query("SELECT * FROM deliveries WHERE Delivery_ID = 0");
    $zeroRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $diagnostics['deliveries_table']['has_zero_id'] = count($zeroRecords) > 0;
    $diagnostics['deliveries_table']['zero_records'] = $zeroRecords;
    
    // ==========================================
    // 3. Check AUTO_INCREMENT status
    // ==========================================
    $stmt = $pdo->query("SHOW TABLE STATUS LIKE 'deliveries'");
    $tableStatus = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $diagnostics['deliveries_table']['auto_increment_value'] = $tableStatus['Auto_increment'] ?? 'NULL';
    $diagnostics['deliveries_table']['table_rows'] = $tableStatus['Rows'] ?? 0;
    
    // ==========================================
    // 4. Check current data
    // ==========================================
    $stmt = $pdo->query("SELECT Delivery_ID, Order_ID FROM deliveries ORDER BY Delivery_ID");
    $allDeliveries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $diagnostics['deliveries_table']['total_records'] = count($allDeliveries);
    $diagnostics['deliveries_table']['all_delivery_ids'] = array_column($allDeliveries, 'Delivery_ID');
    
    $maxId = max(array_merge([0], array_filter(array_column($allDeliveries, 'Delivery_ID'), function($id) {
        return $id > 0;
    })));
    $diagnostics['deliveries_table']['max_delivery_id'] = $maxId;
    
    // ==========================================
    // 5. Check for duplicate Order_IDs
    // ==========================================
    $stmt = $pdo->query("
        SELECT Order_ID, COUNT(*) as count 
        FROM deliveries 
        WHERE Order_ID IS NOT NULL 
        GROUP BY Order_ID 
        HAVING count > 1
    ");
    $duplicateOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $diagnostics['deliveries_table']['duplicate_order_ids'] = $duplicateOrders;
    
    // ==========================================
    // 6. Check SQL_MODE
    // ==========================================
    $stmt = $pdo->query("SELECT @@sql_mode as sql_mode");
    $sqlMode = $stmt->fetch(PDO::FETCH_ASSOC);
    $diagnostics['sql_mode'] = $sqlMode['sql_mode'] ?? 'Not set';
    $diagnostics['has_no_auto_value_on_zero'] = strpos($sqlMode['sql_mode'] ?? '', 'NO_AUTO_VALUE_ON_ZERO') !== false;
    
    // ==========================================
    // 7. Identify Issues
    // ==========================================
    if (!$diagnostics['deliveries_table']['has_auto_increment']) {
        $diagnostics['issues'][] = 'CRITICAL: Delivery_ID column does NOT have AUTO_INCREMENT enabled';
        $diagnostics['recommendations'][] = 'Run: ALTER TABLE deliveries MODIFY COLUMN Delivery_ID int(11) NOT NULL AUTO_INCREMENT';
    }
    
    if ($diagnostics['deliveries_table']['has_zero_id']) {
        $diagnostics['issues'][] = 'CRITICAL: Found ' . count($zeroRecords) . ' record(s) with Delivery_ID = 0';
        $diagnostics['recommendations'][] = 'Run: DELETE FROM deliveries WHERE Delivery_ID = 0';
    }
    
    if ($diagnostics['has_no_auto_value_on_zero']) {
        $diagnostics['issues'][] = 'WARNING: SQL_MODE includes NO_AUTO_VALUE_ON_ZERO (this can cause issues)';
        $diagnostics['recommendations'][] = 'Consider removing NO_AUTO_VALUE_ON_ZERO from SQL_MODE';
    }
    
    if ($deliveryIdColumn && $deliveryIdColumn['Key'] !== 'PRI') {
        $diagnostics['issues'][] = 'CRITICAL: Delivery_ID is not set as PRIMARY KEY';
        $diagnostics['recommendations'][] = 'Run: ALTER TABLE deliveries ADD PRIMARY KEY (Delivery_ID)';
    }
    
    if (count($duplicateOrders) > 0) {
        $diagnostics['issues'][] = 'WARNING: Found duplicate Order_IDs in deliveries table';
        $diagnostics['recommendations'][] = 'Review and clean up duplicate delivery records';
    }
    
    if ($diagnostics['deliveries_table']['auto_increment_value'] === 'NULL' || 
        $diagnostics['deliveries_table']['auto_increment_value'] < $maxId) {
        $nextId = max(1, $maxId + 1);
        $diagnostics['issues'][] = 'WARNING: AUTO_INCREMENT value may be incorrect';
        $diagnostics['recommendations'][] = "Run: ALTER TABLE deliveries AUTO_INCREMENT = {$nextId}";
    }
    
    // ==========================================
    // 8. Check related tables
    // ==========================================
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM orders");
    $orderCount = $stmt->fetch(PDO::FETCH_ASSOC);
    $diagnostics['orders_table']['total_orders'] = (int)$orderCount['count'];
    
    $stmt = $pdo->query("
        SELECT COUNT(DISTINCT o.Order_ID) as orders_without_delivery
        FROM orders o
        LEFT JOIN deliveries d ON o.Order_ID = d.Order_ID
        WHERE d.Delivery_ID IS NULL
    ");
    $missingDeliveries = $stmt->fetch(PDO::FETCH_ASSOC);
    $diagnostics['orders_table']['orders_without_delivery'] = (int)$missingDeliveries['orders_without_delivery'];
    
    if ($diagnostics['orders_table']['orders_without_delivery'] > 0) {
        $diagnostics['issues'][] = 'INFO: ' . $diagnostics['orders_table']['orders_without_delivery'] . ' order(s) without delivery records';
    }
    
    // ==========================================
    // 9. Generate Fix SQL
    // ==========================================
    $fixSql = [];
    
    if ($diagnostics['deliveries_table']['has_zero_id']) {
        $fixSql[] = "-- Step 1: Delete problematic record with Delivery_ID = 0";
        $fixSql[] = "DELETE FROM deliveries WHERE Delivery_ID = 0;";
        $fixSql[] = "";
    }
    
    if (!$diagnostics['deliveries_table']['has_auto_increment']) {
        $fixSql[] = "-- Step 2: Enable AUTO_INCREMENT on Delivery_ID";
        $nextId = max(1, $maxId + 1);
        $fixSql[] = "ALTER TABLE deliveries AUTO_INCREMENT = {$nextId};";
        $fixSql[] = "ALTER TABLE deliveries MODIFY COLUMN Delivery_ID int(11) NOT NULL AUTO_INCREMENT;";
        $fixSql[] = "";
    } else {
        $nextId = max(1, $maxId + 1);
        $currentAi = $diagnostics['deliveries_table']['auto_increment_value'];
        if ($currentAi === 'NULL' || (int)$currentAi < $nextId) {
            $fixSql[] = "-- Step 2: Update AUTO_INCREMENT value";
            $fixSql[] = "ALTER TABLE deliveries AUTO_INCREMENT = {$nextId};";
            $fixSql[] = "";
        }
    }
    
    $diagnostics['fix_sql'] = implode("\n", $fixSql);
    
    // Summary
    $diagnostics['summary'] = [
        'total_issues' => count($diagnostics['issues']),
        'critical_issues' => count(array_filter($diagnostics['issues'], function($issue) {
            return strpos($issue, 'CRITICAL') !== false;
        })),
        'status' => count(array_filter($diagnostics['issues'], function($issue) {
            return strpos($issue, 'CRITICAL') !== false;
        })) > 0 ? 'NEEDS_FIX' : 'OK'
    ];
    
    echo json_encode($diagnostics, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    error_log("Database Diagnostic Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
}
?>

