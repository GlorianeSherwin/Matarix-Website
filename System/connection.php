<?php
/**
 * Database Connection File
 * This file establishes a connection to the MySQL/MariaDB database.
 * Uses the same config as the rest of the app (config/database.php → database.local.php on Hostinger).
 */
$configDir = defined('MATARIX_CONFIG_DIR') ? MATARIX_CONFIG_DIR : __DIR__ . '/config';
require_once $configDir . '/database.php';

// Create DSN (Data Source Name)
$dsn = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset=utf8mb4";

// Connection options
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
];

try {
    // Create PDO connection
    $pdo = new PDO($dsn, $db_username, $db_password, $options);
    
    // Set timezone
    $pdo->exec("SET time_zone = '+00:00'");
    
} catch (PDOException $e) {
    // Log error and display user-friendly message
    error_log("Database Connection Error: " . $e->getMessage());
    
    // In production, you might want to show a generic error message
    die("Unable to connect to the database. Please contact the administrator.");
}

