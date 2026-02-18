<?php
/**
 * Seed Test Users (Delivery Driver + Store Employee)
 *
 * Run:
 *   php scripts/seed_test_staff_users.php
 *
 * Notes:
 * - Uses existing DatabaseFunctions so password hashing matches the app.
 * - Creates ACTIVE users. If email already exists, it will create a new unique email.
 */

require_once __DIR__ . '/../includes/db_functions.php';

function uniqueEmail(DatabaseFunctions $db, string $baseLocal, string $domain): string {
    $try = $baseLocal . '@' . $domain;
    if (!$db->emailExists($try)) return $try;

    for ($i = 2; $i < 1000; $i++) {
        $candidate = $baseLocal . $i . '@' . $domain;
        if (!$db->emailExists($candidate)) return $candidate;
    }

    // Fallback: timestamp-based
    $candidate = $baseLocal . '-' . date('Ymd-His') . '@' . $domain;
    if (!$db->emailExists($candidate)) return $candidate;

    throw new RuntimeException('Unable to generate unique email for ' . $baseLocal);
}

function ensureStatusColumn(DatabaseFunctions $db): void {
    $pdo = $db->getConnection();
    $check = $pdo->query("SHOW COLUMNS FROM users LIKE 'status'");
    $exists = $check->fetch() !== false;
    if (!$exists) {
        $pdo->exec("ALTER TABLE users ADD COLUMN status ENUM('active', 'inactive', 'pending', 'archived') DEFAULT 'active'");
    }
}

function setUserStatus(DatabaseFunctions $db, int $userId, string $status): void {
    $pdo = $db->getConnection();
    $stmt = $pdo->prepare("UPDATE users SET status = :status WHERE User_ID = :id");
    $stmt->execute(['status' => $status, 'id' => $userId]);
}

try {
    $db = new DatabaseFunctions();
    ensureStatusColumn($db);

    $password = 'Test@12345'; // shared test password
    $domain = 'matarix.local';

    // Delivery Driver
    $driverEmail = uniqueEmail($db, 'test.driver', $domain);
    $driverId = $db->insertUser([
        'first_name' => 'Test',
        'middle_name' => null,
        'last_name' => 'Driver',
        'phone_number' => '09170000001',
        'email' => $driverEmail,
        'password' => $password,
        'role' => 'Delivery Driver',
        'address' => 'Test Address'
    ]);
    if (!$driverId) throw new RuntimeException('Failed to create Delivery Driver user');
    setUserStatus($db, (int)$driverId, 'active');

    // Store Employee
    $employeeEmail = uniqueEmail($db, 'test.employee', $domain);
    $employeeId = $db->insertUser([
        'first_name' => 'Test',
        'middle_name' => null,
        'last_name' => 'Employee',
        'phone_number' => '09170000002',
        'email' => $employeeEmail,
        'password' => $password,
        'role' => 'Store Employee',
        'address' => 'Test Address'
    ]);
    if (!$employeeId) throw new RuntimeException('Failed to create Store Employee user');
    setUserStatus($db, (int)$employeeId, 'active');

    echo "Created test users successfully.\n\n";
    echo "Delivery Driver:\n";
    echo "  email: {$driverEmail}\n";
    echo "  password: {$password}\n\n";
    echo "Store Employee:\n";
    echo "  email: {$employeeEmail}\n";
    echo "  password: {$password}\n\n";
    echo "DB: " . (getenv('DB_DATABASE') ?: 'u634157906_matarik') . " @ " . (getenv('DB_HOST') ?: 'localhost') . ":" . (getenv('DB_PORT') ?: '3306') . "\n";
} catch (Throwable $e) {
    fwrite(STDERR, "ERROR: " . $e->getMessage() . "\n");
    exit(1);
}

