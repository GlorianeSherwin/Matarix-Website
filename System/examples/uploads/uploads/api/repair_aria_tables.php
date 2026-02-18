<?php
/**
 * Repair Aria Storage Engine Tables
 * Fixes corruption in MariaDB system tables using Aria storage engine
 * 
 * Access via: http://localhost/MatarixWEBs/api/repair_aria_tables.php
 * 
 * WARNING: This script requires database administrator privileges
 */

header('Content-Type: text/html; charset=utf-8');

require_once __DIR__ . '/../includes/db_functions.php';

// Check if user is admin (optional security check)
session_start();
if (!isset($_SESSION['user_id']) || !in_array($_SESSION['user_role'] ?? '', ['Admin', 'Store Employee'])) {
    die('Access denied. Admin privileges required.');
}

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    echo "<h2>Aria Storage Engine Repair Tool</h2>";
    echo "<p>This tool will attempt to repair corrupted Aria tables in the MariaDB system database.</p>";
    echo "<hr>";
    
    // List of Aria tables that commonly need repair
    $ariaTables = [
        'mysql.user',
        'mysql.db',
        'mysql.tables_priv',
        'mysql.columns_priv',
        'mysql.procs_priv',
        'mysql.proxies_priv',
        'mysql.func'
    ];
    
    echo "<h3>Step 1: Checking Aria Tables</h3>";
    echo "<table border='1' cellpadding='5' cellspacing='0'>";
    echo "<tr><th>Table</th><th>Status</th><th>Action</th></tr>";
    
    $tablesToRepair = [];
    
    foreach ($ariaTables as $table) {
        try {
            // Try to query the table
            $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM {$table} LIMIT 1");
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            echo "<tr><td>{$table}</td><td style='color: green;'>OK</td><td>No action needed</td></tr>";
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'wrong checksum') !== false || 
                strpos($e->getMessage(), 'error 176') !== false) {
                echo "<tr><td>{$table}</td><td style='color: red;'>CORRUPTED</td><td>Needs repair</td></tr>";
                $tablesToRepair[] = $table;
            } else {
                echo "<tr><td>{$table}</td><td style='color: orange;'>Error: " . htmlspecialchars($e->getMessage()) . "</td><td>Check manually</td></tr>";
            }
        }
    }
    
    echo "</table>";
    
    if (empty($tablesToRepair)) {
        echo "<p style='color: green;'><strong>All Aria tables appear to be healthy!</strong></p>";
        echo "<p>If you're still experiencing issues, try the manual repair commands below.</p>";
    } else {
        echo "<h3>Step 2: Repairing Corrupted Tables</h3>";
        echo "<p>The following tables need repair:</p>";
        echo "<ul>";
        foreach ($tablesToRepair as $table) {
            echo "<li>{$table}</li>";
        }
        echo "</ul>";
        
        echo "<p><strong>Note:</strong> Due to security restrictions, you may need to run these commands manually in phpMyAdmin or MySQL command line.</p>";
    }
    
    echo "<hr>";
    echo "<h3>Manual Repair Commands</h3>";
    echo "<p>If automatic repair doesn't work, run these commands in phpMyAdmin SQL tab or MySQL command line:</p>";
    echo "<pre style='background: #f0f0f0; padding: 15px; border: 1px solid #ccc;'>";
    
    foreach ($ariaTables as $table) {
        echo "-- Repair {$table}\n";
        echo "REPAIR TABLE {$table};\n\n";
    }
    
    echo "-- Alternative: Check all Aria tables\n";
    echo "CHECK TABLE mysql.user, mysql.db, mysql.tables_priv, mysql.columns_priv;\n\n";
    
    echo "-- If repair doesn't work, try:\n";
    echo "FLUSH TABLES;\n";
    echo "REPAIR TABLE mysql.user EXTENDED;\n\n";
    
    echo "-- For severe corruption, you may need to:\n";
    echo "-- 1. Stop MariaDB service\n";
    echo "-- 2. Run: aria_chk -r /path/to/mysql/data/mysql/user.MAI\n";
    echo "-- 3. Start MariaDB service\n";
    echo "</pre>";
    
    echo "<hr>";
    echo "<h3>Step 3: Attempting Automatic Repair</h3>";
    
    if (!empty($tablesToRepair)) {
        foreach ($tablesToRepair as $table) {
            try {
                echo "<p>Repairing {$table}...</p>";
                $stmt = $pdo->query("REPAIR TABLE {$table}");
                $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                echo "<table border='1' cellpadding='5' cellspacing='0' style='margin-bottom: 10px;'>";
                echo "<tr><th>Table</th><th>Op</th><th>Msg_type</th><th>Msg_text</th></tr>";
                foreach ($result as $row) {
                    echo "<tr>";
                    echo "<td>" . htmlspecialchars($row['Table'] ?? '') . "</td>";
                    echo "<td>" . htmlspecialchars($row['Op'] ?? '') . "</td>";
                    echo "<td>" . htmlspecialchars($row['Msg_type'] ?? '') . "</td>";
                    echo "<td>" . htmlspecialchars($row['Msg_text'] ?? '') . "</td>";
                    echo "</tr>";
                }
                echo "</table>";
                
                // Try to verify repair
                $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM {$table} LIMIT 1");
                $verify = $stmt->fetch(PDO::FETCH_ASSOC);
                echo "<p style='color: green;'>✓ {$table} repaired successfully! (Verified: " . $verify['cnt'] . " rows accessible)</p>";
                
            } catch (PDOException $e) {
                echo "<p style='color: red;'>✗ Failed to repair {$table}: " . htmlspecialchars($e->getMessage()) . "</p>";
                echo "<p>You may need to run the repair command manually with higher privileges.</p>";
            }
        }
    }
    
    echo "<hr>";
    echo "<h3>Additional Recommendations</h3>";
    echo "<ul>";
    echo "<li><strong>Backup your database</strong> before attempting any repairs</li>";
    echo "<li>If repair fails, you may need to restore from a backup</li>";
    echo "<li>Check MariaDB error logs for more details: <code>/var/log/mysql/error.log</code> or <code>C:\\xampp\\mysql\\data\\*.err</code></li>";
    echo "<li>Ensure you have sufficient disk space</li>";
    echo "<li>Consider upgrading MariaDB if this is a recurring issue</li>";
    echo "</ul>";
    
    echo "<hr>";
    echo "<p><a href='javascript:history.back()'>← Go Back</a></p>";
    
} catch (Exception $e) {
    echo "<h3 style='color: red;'>Error</h3>";
    echo "<p>" . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<p>Stack trace:</p>";
    echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
}
?>

