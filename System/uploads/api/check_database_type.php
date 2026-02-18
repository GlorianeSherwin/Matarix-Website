<?php
/**
 * Check Database Type and Version
 * Determines if you're using MySQL or MariaDB and provides appropriate repair commands
 */

header('Content-Type: text/html; charset=utf-8');

require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Get database version
    $stmt = $pdo->query("SELECT VERSION() as version");
    $version = $stmt->fetch(PDO::FETCH_ASSOC);
    $dbVersion = $version['version'] ?? 'Unknown';
    
    // Determine if it's MariaDB or MySQL
    $isMariaDB = stripos($dbVersion, 'MariaDB') !== false;
    $isMySQL = stripos($dbVersion, 'MySQL') !== false || (!$isMariaDB && stripos($dbVersion, 'mariadb') === false);
    
    echo "<h2>Database Information</h2>";
    echo "<table border='1' cellpadding='10' cellspacing='0' style='border-collapse: collapse;'>";
    echo "<tr><th>Property</th><th>Value</th></tr>";
    echo "<tr><td><strong>Database Version</strong></td><td>" . htmlspecialchars($dbVersion) . "</td></tr>";
    echo "<tr><td><strong>Database Type</strong></td><td>" . ($isMariaDB ? 'MariaDB' : ($isMySQL ? 'MySQL' : 'Unknown')) . "</td></tr>";
    
    // Get storage engines
    $stmt = $pdo->query("SHOW ENGINES");
    $engines = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $hasAria = false;
    $hasInnoDB = false;
    $hasMyISAM = false;
    
    foreach ($engines as $engine) {
        if (stripos($engine['Engine'], 'Aria') !== false) {
            $hasAria = true;
        }
        if (stripos($engine['Engine'], 'InnoDB') !== false) {
            $hasInnoDB = true;
        }
        if (stripos($engine['Engine'], 'MyISAM') !== false) {
            $hasMyISAM = true;
        }
    }
    
    echo "<tr><td><strong>Has Aria Engine</strong></td><td>" . ($hasAria ? 'Yes' : 'No') . "</td></tr>";
    echo "<tr><td><strong>Has InnoDB Engine</strong></td><td>" . ($hasInnoDB ? 'Yes' : 'No') . "</td></tr>";
    echo "<tr><td><strong>Has MyISAM Engine</strong></td><td>" . ($hasMyISAM ? 'Yes' : 'No') . "</td></tr>";
    echo "</table>";
    
    echo "<hr>";
    
    if ($isMariaDB && $hasAria) {
        echo "<h3 style='color: orange;'>You ARE using MariaDB with Aria storage engine</h3>";
        echo "<p>The error you're seeing is from MariaDB's Aria storage engine (used for system tables).</p>";
        echo "<p><strong>XAMPP includes MariaDB by default</strong> - it's not a separate installation.</p>";
        
        echo "<h3>Fix for MariaDB Aria Error:</h3>";
        echo "<p>Run these commands in phpMyAdmin SQL tab:</p>";
        echo "<pre style='background: #f0f0f0; padding: 15px; border: 1px solid #ccc;'>";
        echo "REPAIR TABLE mysql.user;\n";
        echo "REPAIR TABLE mysql.db;\n";
        echo "REPAIR TABLE mysql.tables_priv;\n";
        echo "REPAIR TABLE mysql.columns_priv;\n";
        echo "FLUSH PRIVILEGES;\n";
        echo "</pre>";
        
    } else if ($isMySQL) {
        echo "<h3>You're using MySQL</h3>";
        echo "<p>If you're seeing an Aria error, it might be:</p>";
        echo "<ul>";
        echo "<li>A misidentified error message</li>";
        echo "<li>You actually have MariaDB (XAMPP often uses MariaDB even if it says MySQL)</li>";
        echo "</ul>";
        
        echo "<h3>Fix for MySQL/MyISAM Tables:</h3>";
        echo "<pre style='background: #f0f0f0; padding: 15px; border: 1px solid #ccc;'>";
        echo "REPAIR TABLE mysql.user;\n";
        echo "REPAIR TABLE mysql.db;\n";
        echo "FLUSH PRIVILEGES;\n";
        echo "</pre>";
        
    } else {
        echo "<h3>Unknown Database Type</h3>";
        echo "<p>Could not determine database type. Please check your XAMPP installation.</p>";
    }
    
    echo "<hr>";
    echo "<h3>How to Check in XAMPP:</h3>";
    echo "<ol>";
    echo "<li>Open XAMPP Control Panel</li>";
    echo "<li>Look at the MySQL/MariaDB service</li>";
    echo "<li>Click 'Admin' next to MySQL to open phpMyAdmin</li>";
    echo "<li>In phpMyAdmin, look at the bottom right corner - it will show the version</li>";
    echo "</ol>";
    
    echo "<hr>";
    echo "<h3>Quick Fix Steps:</h3>";
    echo "<ol>";
    echo "<li>Open phpMyAdmin (click 'Admin' next to MySQL in XAMPP Control Panel)</li>";
    echo "<li>Click on the 'SQL' tab</li>";
    echo "<li>Copy and paste the repair commands shown above</li>";
    echo "<li>Click 'Go' to execute</li>";
    echo "<li>If successful, try your order approval again</li>";
    echo "</ol>";
    
    echo "<hr>";
    echo "<p><a href='javascript:history.back()'>← Go Back</a></p>";
    
} catch (Exception $e) {
    echo "<h3 style='color: red;'>Error</h3>";
    echo "<p>" . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<p><strong>Note:</strong> If you can't connect, make sure MySQL/MariaDB is running in XAMPP Control Panel.</p>";
}
?>

