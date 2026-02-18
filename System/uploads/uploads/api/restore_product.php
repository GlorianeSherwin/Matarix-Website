<?php
/**
 * Restore Product API
 * Restores an archived product back to active status
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// Check if user is logged in and has permission (Admin)
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'User not authenticated'
    ]);
    exit;
}

$userRole = $_SESSION['user_role'] ?? '';
if ($userRole !== 'Admin') {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Access denied. Only admins can restore products.'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$productId = $data['product_id'] ?? null;

if (!$productId) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Product ID is required'
    ]);
    exit;
}

$productId = (int)$productId;

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Start transaction
    $pdo->beginTransaction();
    
    // Check if archive columns exist
    $stmt = $pdo->query("SHOW COLUMNS FROM `products` LIKE 'is_archived'");
    $archiveColumnsExist = $stmt->rowCount() > 0;
    
    if (!$archiveColumnsExist) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Archive system not set up. Please run create_product_archive_system.php first.'
        ]);
        exit;
    }
    
    // Verify product exists and is archived
    $stmt = $pdo->prepare("SELECT Product_ID, Product_Name, is_archived FROM products WHERE Product_ID = :product_id");
    $stmt->execute(['product_id' => $productId]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$product) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Product not found'
        ]);
        $pdo->rollBack();
        exit;
    }
    
    if (!isset($product['is_archived']) || $product['is_archived'] != 1) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Product is not archived'
        ]);
        exit;
    }
    
    // Restore the product
    $stmt = $pdo->prepare("UPDATE products SET is_archived = 0, archived_at = NULL, archived_by = NULL WHERE Product_ID = :product_id");
    $stmt->execute(['product_id' => $productId]);
    
    if ($stmt->rowCount() === 0) {
        throw new Exception('Failed to restore product');
    }
    
    // Commit transaction
    $pdo->commit();
    
    error_log("Product restored successfully: Product_ID {$productId} ({$product['Product_Name']}) by user {$_SESSION['user_id']}");
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Product restored successfully',
        'product_id' => $productId,
        'product_name' => $product['Product_Name']
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Restore Product Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to restore product: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Restore Product Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to restore product: ' . $e->getMessage()
    ]);
}
?>

