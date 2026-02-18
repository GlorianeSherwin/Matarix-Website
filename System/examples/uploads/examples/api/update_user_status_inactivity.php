<?php
/**
 * Update User Status Based on Inactivity
 * Admin, Employees, Delivery Drivers: 30 days = Inactive
 * Customers: 90 days = Inactive
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Check if status and last_login columns exist
    $statusExists = false;
    $lastLoginExists = false;
    
    try {
        $checkStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'status'");
        $statusExists = $checkStmt->fetch() !== false;
    } catch (PDOException $e) {
        $statusExists = false;
    }
    
    try {
        $checkStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'last_login'");
        $lastLoginExists = $checkStmt->fetch() !== false;
    } catch (PDOException $e) {
        $lastLoginExists = false;
    }
    
    if (!$statusExists) {
        // Add status column if it doesn't exist
        $pdo->exec("
            ALTER TABLE users 
            ADD COLUMN status ENUM('active', 'inactive', 'pending', 'archived') 
            DEFAULT 'active'
        ");
        $statusExists = true;
    }
    
    if (!$lastLoginExists) {
        // Add last_login column if it doesn't exist
        $pdo->exec("
            ALTER TABLE users 
            ADD COLUMN last_login DATETIME DEFAULT NULL
        ");
        $lastLoginExists = true;
    }
    
    $updatedCount = 0;
    $now = new DateTime();
    
    // Get all users
    $stmt = $pdo->query("SELECT User_ID, role, last_login, status FROM users");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($users as $user) {
        $userId = $user['User_ID'];
        $role = $user['role'];
        $lastLogin = $user['last_login'];
        $currentStatus = $user['status'] ?? 'active';
        
        // Determine inactivity threshold based on role
        $inactivityDays = 90; // Default for customers
        if (in_array($role, ['Admin', 'Store Employee', 'Delivery Driver'])) {
            $inactivityDays = 30; // 30 days for admin, employees, delivery drivers
        }
        
        // Check if user should be marked as inactive
        if ($lastLogin) {
            $lastLoginDate = new DateTime($lastLogin);
            $daysSinceLogin = $now->diff($lastLoginDate)->days;
            
            if ($daysSinceLogin >= $inactivityDays && $currentStatus !== 'archived') {
                // Mark as inactive
                $updateStmt = $pdo->prepare("UPDATE users SET status = 'inactive' WHERE User_ID = :user_id");
                $updateStmt->execute(['user_id' => $userId]);
                $updatedCount++;
            } elseif ($daysSinceLogin < $inactivityDays && $currentStatus === 'inactive') {
                // Reactivate if they're within the threshold
                $updateStmt = $pdo->prepare("UPDATE users SET status = 'active' WHERE User_ID = :user_id");
                $updateStmt->execute(['user_id' => $userId]);
            }
        } else {
            // If user has never logged in, check created_at
            $createdStmt = $pdo->prepare("SELECT created_at FROM users WHERE User_ID = :user_id");
            $createdStmt->execute(['user_id' => $userId]);
            $createdData = $createdStmt->fetch();
            
            if ($createdData && $createdData['created_at']) {
                $createdDate = new DateTime($createdData['created_at']);
                $daysSinceCreated = $now->diff($createdDate)->days;
                
                if ($daysSinceCreated >= $inactivityDays && $currentStatus !== 'archived') {
                    // Mark as inactive if never logged in and past threshold
                    $updateStmt = $pdo->prepare("UPDATE users SET status = 'inactive' WHERE User_ID = :user_id");
                    $updateStmt->execute(['user_id' => $userId]);
                    $updatedCount++;
                }
            }
        }
    }
    
    echo json_encode([
        'success' => true,
        'message' => "Status update completed. {$updatedCount} user(s) updated.",
        'updated_count' => $updatedCount
    ]);
    
} catch (Exception $e) {
    error_log("Update User Status Inactivity Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while updating user statuses: ' . $e->getMessage()
    ]);
}
?>

