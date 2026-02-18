<?php
/**
 * Local Database Configuration (XAMPP)
 * For localhost testing - uses XAMPP default MySQL credentials
 */
 
$db_host = getenv('DB_HOST') ?: 'localhost';
$db_port = getenv('DB_PORT') ?: '3306';
$db_name = getenv('DB_DATABASE') ?: 'u634157906_matarik';
$db_username = getenv('DB_USERNAME') ?: 'u634157906_matarik';
$db_password = getenv('DB_PASSWORD') ?: 'Matarik1234';
