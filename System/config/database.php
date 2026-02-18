<?php
/**
 * Database Configuration
 * Loads credentials from config/database.local.php if it exists (for Hostinger/production),
 * otherwise uses environment variables or local XAMPP defaults.
 */

// Default values (local XAMPP development)
$db_host = 'localhost';
$db_port = '3306';
$db_name = 'u634157906_matarik';
$db_username = 'root';
$db_password = '';

// Use __DIR__ so this file finds database.local.php even when included from api/ or includes/
$configDir = defined('MATARIX_CONFIG_DIR') ? MATARIX_CONFIG_DIR : __DIR__;
$localConfig = $configDir . '/database.local.php';

if (is_file($localConfig)) {
    require $localConfig;
} else {
    // On production (e.g. matarix.store), database.local.php is required
    $isProduction = isset($_SERVER['HTTP_HOST']) && (
        strpos($_SERVER['HTTP_HOST'], 'matarix.store') !== false ||
        (strpos($_SERVER['HTTP_HOST'], 'localhost') === false && strpos($_SERVER['HTTP_HOST'], '127.0.0.1') === false)
    );
    if ($isProduction) {
        error_log('MATARIX: Create config/database.local.php with your Hostinger MySQL credentials. See config/database.local.php.example');
    }
    // Fall back to environment variables (supported by some hosts)
    if (getenv('DB_HOST')) $db_host = getenv('DB_HOST');
    if (getenv('DB_PORT')) $db_port = getenv('DB_PORT');
    if (getenv('DB_DATABASE')) $db_name = getenv('DB_DATABASE');
    if (getenv('DB_USERNAME')) $db_username = getenv('DB_USERNAME');
    if (getenv('DB_PASSWORD') !== false) $db_password = (string) getenv('DB_PASSWORD');
}
