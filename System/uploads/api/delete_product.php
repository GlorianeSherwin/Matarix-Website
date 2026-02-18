<?php
/**
 * Delete Product API
 * Handles deletion of products and related data from the database
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';
require_once __DIR__ . '/../includes/rbac.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// RBAC: product management (Store Employee + Admin)
rbac_require_permission_api('products.delete');

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
    
    // Check if archive columns exist first
    $stmt = $pdo->query("SHOW COLUMNS FROM `products` LIKE 'is_archived'");
    $archiveColumnsExist = $stmt->rowCount() > 0;
    
    // Verify product exists (conditionally include is_archived if column exists)
    if ($archiveColumnsExist) {
        $stmt = $pdo->prepare("SELECT Product_ID, Product_Name, is_archived FROM products WHERE Product_ID = :product_id");
    } else {
        $stmt = $pdo->prepare("SELECT Product_ID, Product_Name FROM products WHERE Product_ID = :product_id");
    }
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
    
    // Check if product is already archived (only if archive columns exist)
    if ($archiveColumnsExist && isset($product['is_archived']) && $product['is_archived'] == 1) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Product is already archived'
        ]);
        exit;
    }
    
    // Check if product is used in any orders/transactions
    $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM transaction_items WHERE Product_ID = :product_id");
    $stmt->execute(['product_id' => $productId]);
    $usageCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    if ($usageCount > 0) {
        // Product is used in transactions, we should not delete it
        // Instead, we could mark it as inactive or just prevent deletion
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Cannot delete product. It is associated with existing orders/transactions. Consider marking it as out of stock instead.',
            'usage_count' => $usageCount
        ]);
        exit;
    }
    
    // Archive the product instead of deleting it (if archive columns exist)
    
    if ($archiveColumnsExist) {
        // Archive the product
        $stmt = $pdo->prepare("UPDATE products SET is_archived = 1, archived_at = NOW(), archived_by = :user_id WHERE Product_ID = :product_id");
        $stmt->execute([
            'product_id' => $productId,
            'user_id' => $_SESSION['user_id']
        ]);
        
        if ($stmt->rowCount() === 0) {
            throw new Exception('Failed to archive product');
        }
        
        error_log("Product archived successfully: Product_ID {$productId} ({$product['Product_Name']}) by user {$_SESSION['user_id']}");
        
        $pdo->commit();
        
        // Create notification for product deleted/archived
        require_once __DIR__ . '/create_admin_activity_notification.php';
        createAdminActivityNotification($pdo, 'product_deleted', [
            'product_name' => $product['Product_Name'],
            'message' => "Product archived: {$product['Product_Name']}"
        ]);
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Product archived successfully',
            'product_id' => $productId,
            'product_name' => $product['Product_Name']
        ]);
    } else {
        // Fallback to old deletion method if archive columns don't exist
        // Delete related records in correct order (to respect foreign key constraints)
        // 1. Delete product variations
        $stmt = $pdo->prepare("DELETE FROM product_variations WHERE Product_ID = :product_id");
        $stmt->execute(['product_id' => $productId]);
        
        // 2. Delete product reviews if they exist
        try {
            $stmt = $pdo->prepare("DELETE FROM product_reviews WHERE Product_ID = :product_id");
            $stmt->execute(['product_id' => $productId]);
        } catch (PDOException $e) {
            // Table might not exist, ignore
        }
        
        // 3. Delete the product itself
        $stmt = $pdo->prepare("DELETE FROM products WHERE Product_ID = :product_id");
        $stmt->execute(['product_id' => $productId]);
        
        if ($stmt->rowCount() === 0) {
            throw new Exception('Failed to delete product');
        }
        
        // Commit transaction
        $pdo->commit();
        
        // Create notification for product deleted
        require_once __DIR__ . '/create_admin_activity_notification.php';
        createAdminActivityNotification($pdo, 'product_deleted', [
            'product_name' => $product['Product_Name'],
            'message' => "Product deleted: {$product['Product_Name']}"
        ]);
        
        error_log("Product deleted successfully: Product_ID {$productId} ({$product['Product_Name']}) by user {$_SESSION['user_id']}");
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Product deleted successfully',
            'product_id' => $productId,
            'product_name' => $product['Product_Name']
        ]);
    }
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Delete Product Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to delete product: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Delete Product Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to delete product: ' . $e->getMessage()
    ]);
}
?>

