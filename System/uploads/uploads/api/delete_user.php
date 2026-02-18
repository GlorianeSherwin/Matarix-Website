<?php
/**
 * Delete User API Endpoint
 * Deletes a user from the system
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: DELETE, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: user deactivation (delete is not allowed in UI; we soft-deactivate instead)
rbac_require_permission_api('users.deactivate');

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Fallback to POST data if JSON is not available
if (!$input) {
    $input = $_POST;
}

// Initialize database functions
$db = new DatabaseFunctions();
$pdo = $db->getConnection();

// Ensure status column exists (soft-deactivate uses status)
try {
    $checkStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'status'");
    $statusColumnExists = $checkStmt->fetch() !== false;
    if (!$statusColumnExists) {
        $pdo->exec("ALTER TABLE users ADD COLUMN status ENUM('active', 'inactive', 'pending', 'archived') DEFAULT 'active'");
    }
} catch (PDOException $e) {
    // If this fails, deactivation will fail later; let it surface in response
}

// Check if multiple users are being deleted
if (isset($input['user_ids']) && is_array($input['user_ids']) && count($input['user_ids']) > 0) {
    // Multiple user deletion
    $userIds = array_map('intval', $input['user_ids']);
    $currentUserId = (int)($_SESSION['user_id'] ?? 0);
    
    // Filter out current user's ID (cannot delete own account)
    $userIds = array_filter($userIds, function($id) use ($currentUserId) {
        return $id !== $currentUserId;
    });
    
    if (empty($userIds)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Cannot delete your own account'
        ]);
        exit;
    }
    
    try {
        $pdo->beginTransaction();
        $deletedCount = 0;
        $failedCount = 0;
        $errors = [];
        
        foreach ($userIds as $userId) {
            try {
                // Check if user exists
                $existingUser = $db->getUserById($userId);
                if (!$existingUser) {
                    $failedCount++;
                    $errors[] = "User ID {$userId} not found";
                    continue;
                }
                
                // Deactivate user (soft delete)
                $stmt = $pdo->prepare("UPDATE users SET status = 'inactive' WHERE User_ID = :user_id");
                $result = $stmt->execute(['user_id' => $userId]);
                
                if ($result) {
                    $deletedCount++;
                } else {
                    $failedCount++;
                    $errors[] = "Failed to deactivate user ID {$userId}";
                }
            } catch (Exception $e) {
                $failedCount++;
                $errors[] = "Error deactivating user ID {$userId}: " . $e->getMessage();
                error_log("Deactivate User Error (ID: {$userId}): " . $e->getMessage());
            }
        }
        
        $pdo->commit();
        
        if ($deletedCount > 0) {
            // Create notification for users deactivated
            require_once __DIR__ . '/create_admin_activity_notification.php';
            createAdminActivityNotification($pdo, 'user_deactivated', [
                'user_name' => "{$deletedCount} user(s)",
                'message' => "{$deletedCount} user(s) deactivated"
            ]);
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => "Successfully deactivated {$deletedCount} user(s)" . ($failedCount > 0 ? ". {$failedCount} failed." : ''),
                'deleted_count' => $deletedCount,
                'failed_count' => $failedCount,
                'errors' => $errors
            ]);
        } else {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to deactivate users',
                'errors' => $errors
            ]);
        }
        
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Deactivate Multiple Users API Error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'An error occurred while deactivating users: ' . $e->getMessage()
        ]);
    }
    
} else {
    // Single user deletion (existing functionality)
    if (!isset($input['user_id']) || empty($input['user_id'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'User ID is required'
        ]);
        exit;
    }

    $userId = (int)$input['user_id'];

    // Prevent deleting own account
    if (isset($_SESSION['user_id']) && $_SESSION['user_id'] == $userId) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'You cannot deactivate your own account'
        ]);
        exit;
    }

    // Check if user exists
    $existingUser = $db->getUserById($userId);
    if (!$existingUser) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'User not found'
        ]);
        exit;
    }

    try {
        // Deactivate user (soft delete)
        $stmt = $pdo->prepare("UPDATE users SET status = 'inactive' WHERE User_ID = :user_id");
        $result = $stmt->execute(['user_id' => $userId]);
        
        if ($result) {
            // Create notification for user deactivated
            require_once __DIR__ . '/create_admin_activity_notification.php';
            $userName = trim(($existingUser['First_Name'] ?? '') . ' ' . ($existingUser['Middle_Name'] ?? '') . ' ' . ($existingUser['Last_Name'] ?? ''));
            createAdminActivityNotification($pdo, 'user_deactivated', [
                'user_id' => $userId,
                'user_name' => $userName ?: ($existingUser['email'] ?? 'User'),
                'message' => "User deactivated: {$userName}"
            ]);
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'User deactivated successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to deactivate user'
            ]);
        }
        
    } catch (Exception $e) {
        error_log("Deactivate User API Error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'An error occurred while deactivating the user.'
        ]);
    }
}
?>

