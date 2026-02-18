<?php
/**
 * Test Forgot Password Functionality
 * Use this to debug email sending issues
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h2>Testing Forgot Password Functionality</h2>";

// Test 1: Check database connection
echo "<h3>1. Testing Database Connection</h3>";
try {
    $pdo = new PDO(
        "mysql:host=localhost;port=3306;dbname=u634157906_matarik;charset=utf8mb4",
        'u634157906_matarik',
        'Matarik1234',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    echo "✓ Database connection successful<br>";
} catch (PDOException $e) {
    echo "✗ Database connection failed: " . $e->getMessage() . "<br>";
    exit;
}

// Test 2: Check if password_reset_tokens table exists
echo "<h3>2. Checking password_reset_tokens table</h3>";
$tableCheck = $pdo->query("SHOW TABLES LIKE 'password_reset_tokens'");
if ($tableCheck->rowCount() == 0) {
    echo "✗ Table doesn't exist. Creating it...<br>";
    $createTableSQL = "CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_token (token),
        INDEX idx_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    $pdo->exec($createTableSQL);
    echo "✓ Table created successfully<br>";
} else {
    echo "✓ Table exists<br>";
}

// Test 3: Check PHPMailer
echo "<h3>3. Checking PHPMailer</h3>";
if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
    if (class_exists('PHPMailer\PHPMailer\PHPMailer')) {
        echo "✓ PHPMailer is installed and available<br>";
    } else {
        echo "✗ PHPMailer class not found<br>";
        echo "  Attempting to load directly...<br>";
        // Try loading directly
        if (file_exists(__DIR__ . '/../vendor/phpmailer/phpmailer/src/PHPMailer.php')) {
            require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/PHPMailer.php';
            require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/SMTP.php';
            require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/Exception.php';
            if (class_exists('PHPMailer\PHPMailer\PHPMailer')) {
                echo "✓ PHPMailer loaded directly<br>";
            } else {
                echo "✗ Still cannot load PHPMailer<br>";
            }
        }
    }
} else {
    echo "✗ vendor/autoload.php not found. PHPMailer may not be installed.<br>";
    echo "  Install with: composer require phpmailer/phpmailer<br>";
}

// Test 4: Check SMTP config
echo "<h3>4. Checking SMTP Configuration</h3>";
$config = require __DIR__ . '/../includes/smtp_config.php';
echo "SMTP Host: " . $config['smtp_host'] . "<br>";
echo "SMTP Port: " . $config['smtp_port'] . "<br>";
echo "SMTP Username: " . ($config['smtp_username'] ? 'Set ✓' : 'Not set ✗') . "<br>";
echo "SMTP Password: " . ($config['smtp_password'] ? 'Set ✓' : 'Not set ✗') . "<br>";
echo "SMTP Encryption: " . $config['smtp_encryption'] . "<br>";
echo "From Email: " . $config['from_email'] . "<br>";

// Test 5: Test email sender initialization
echo "<h3>5. Testing Email Sender</h3>";
try {
    require_once __DIR__ . '/../includes/email_sender.php';
    $emailSender = new EmailSender();
    echo "✓ EmailSender class instantiated successfully<br>";
} catch (Exception $e) {
    echo "✗ Failed to create EmailSender: " . $e->getMessage() . "<br>";
    echo "Error details: " . $e->getTraceAsString() . "<br>";
}

// Test 6: Check if test email can be sent
echo "<h3>6. Testing Email Sending</h3>";
echo "Enter an email address to test: <form method='POST'><input type='email' name='test_email' placeholder='your-email@example.com' required><button type='submit'>Send Test Email</button></form>";

if (isset($_POST['test_email']) && !empty($_POST['test_email'])) {
    $testEmail = $_POST['test_email'];
    $testLink = "http://localhost/MatarixWEB/Customer/ResetPassword.html?token=test123";
    echo "<p><strong>Attempting to send test email to: " . htmlspecialchars($testEmail) . "</strong></p>";
    try {
        if (!isset($emailSender)) {
            require_once __DIR__ . '/../includes/email_sender.php';
            $emailSender = new EmailSender();
        }
        $emailSent = $emailSender->sendPasswordResetEmail($testEmail, $testLink, 'Test User');
        if ($emailSent) {
            echo "<p style='color: green;'>✓ Test email sent successfully to: " . htmlspecialchars($testEmail) . "</p>";
            echo "<p>Check your inbox (and spam folder) for the test email.</p>";
        } else {
            echo "<p style='color: red;'>✗ Failed to send test email. Check error logs below.</p>";
            echo "<p><strong>Check these log files:</strong></p>";
            echo "<ul>";
            echo "<li>PHP Error Log: C:\\xampp\\php\\logs\\php_error_log</li>";
            echo "<li>Apache Error Log: C:\\xampp\\apache\\logs\\error.log</li>";
            echo "</ul>";
        }
    } catch (Exception $e) {
        echo "<p style='color: red;'>✗ Error sending test email: " . htmlspecialchars($e->getMessage()) . "</p>";
        echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
    }
}
echo "<h3>6. Testing Email Sending (Optional)</h3>";
echo "Enter an email address to test: <form method='POST'><input type='email' name='test_email'><button type='submit'>Send Test Email</button></form>";

if (isset($_POST['test_email']) && !empty($_POST['test_email'])) {
    $testEmail = $_POST['test_email'];
    $testLink = "http://localhost/MatarixWebs/Customer/ResetPassword.html?token=test123";
    try {
        $emailSent = $emailSender->sendPasswordResetEmail($testEmail, $testLink, 'Test User');
        if ($emailSent) {
            echo "✓ Test email sent successfully to: " . $testEmail . "<br>";
        } else {
            echo "✗ Failed to send test email. Check error logs.<br>";
        }
    } catch (Exception $e) {
        echo "✗ Error sending test email: " . $e->getMessage() . "<br>";
    }
}
*/
echo "<hr>";
echo "<p><strong>Next steps:</strong></p>";
echo "<ul>";
echo "<li>If all tests pass, try the forgot password feature again</li>";
echo "<li>Check PHP error logs at: C:\\xampp\\php\\logs\\php_error_log</li>";
echo "<li>Check Apache error logs at: C:\\xampp\\apache\\logs\\error.log</li>";
echo "<li>Enable SMTP debug mode in includes/email_sender.php (set SMTPDebug = 2)</li>";
echo "</ul>";

