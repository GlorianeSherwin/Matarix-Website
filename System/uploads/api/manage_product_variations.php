<?php
/**
 * Manage Product Variations API
 * Handles adding, updating, and deleting product variations
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// Check if user is admin (optional - can be removed if not needed)
// if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'Admin') {
//     http_response_code(403);
//     echo json_encode(['success' => false, 'message' => 'Access denied']);
//     exit;
// }

// Get request method
$method = $_SERVER['REQUEST_METHOD'];

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Fallback to POST data if JSON is not available
if (!$input) {
    $input = $_POST;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    switch ($method) {
        case 'POST':
            // Add new variation
            if (!isset($input['product_id']) || !isset($input['variation_name']) || !isset($input['variation_value'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required fields: product_id, variation_name, variation_value'
                ]);
                exit;
            }
            
            $productId = (int)$input['product_id'];
            $variationName = trim($input['variation_name']);
            $variationValue = trim($input['variation_value']);
            
            // Validate product exists
            $stmt = $pdo->prepare("SELECT Product_ID FROM products WHERE Product_ID = :product_id");
            $stmt->execute(['product_id' => $productId]);
            if (!$stmt->fetch()) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Product not found'
                ]);
                exit;
            }
            
            // Check if variation already exists
            $stmt = $pdo->prepare("SELECT Variation_ID FROM product_variations WHERE Product_ID = :product_id AND variation_name = :variation_name AND variation_value = :variation_value");
            $stmt->execute([
                'product_id' => $productId,
                'variation_name' => $variationName,
                'variation_value' => $variationValue
            ]);
            
            if ($stmt->fetch()) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'This variation already exists for this product'
                ]);
                exit;
            }
            
            // Insert new variation
            $stmt = $pdo->prepare("INSERT INTO product_variations (Product_ID, variation_name, variation_value) VALUES (:product_id, :variation_name, :variation_value)");
            $result = $stmt->execute([
                'product_id' => $productId,
                'variation_name' => $variationName,
                'variation_value' => $variationValue
            ]);
            
            if ($result) {
                $variationId = $pdo->lastInsertId();
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Variation added successfully',
                    'variation' => [
                        'variation_id' => $variationId,
                        'variation_name' => $variationName,
                        'variation_value' => $variationValue
                    ]
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to add variation'
                ]);
            }
            break;
            
        case 'PUT':
            // Update existing variation
            if (!isset($input['variation_id']) || !isset($input['variation_name']) || !isset($input['variation_value'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required fields: variation_id, variation_name, variation_value'
                ]);
                exit;
            }
            
            $variationId = (int)$input['variation_id'];
            $variationName = trim($input['variation_name']);
            $variationValue = trim($input['variation_value']);
            
            // Check if variation exists
            $stmt = $pdo->prepare("SELECT Product_ID FROM product_variations WHERE Variation_ID = :variation_id");
            $stmt->execute(['variation_id' => $variationId]);
            $variation = $stmt->fetch();
            
            if (!$variation) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Variation not found'
                ]);
                exit;
            }
            
            // Check if another variation with same name and value exists for this product
            $stmt = $pdo->prepare("SELECT Variation_ID FROM product_variations WHERE Product_ID = :product_id AND variation_name = :variation_name AND variation_value = :variation_value AND Variation_ID != :variation_id");
            $stmt->execute([
                'product_id' => $variation['Product_ID'],
                'variation_name' => $variationName,
                'variation_value' => $variationValue,
                'variation_id' => $variationId
            ]);
            
            if ($stmt->fetch()) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'This variation already exists for this product'
                ]);
                exit;
            }
            
            // Update variation
            $stmt = $pdo->prepare("UPDATE product_variations SET variation_name = :variation_name, variation_value = :variation_value WHERE Variation_ID = :variation_id");
            $result = $stmt->execute([
                'variation_name' => $variationName,
                'variation_value' => $variationValue,
                'variation_id' => $variationId
            ]);
            
            if ($result) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Variation updated successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update variation'
                ]);
            }
            break;
            
        case 'DELETE':
            // Delete variation
            if (!isset($input['variation_id'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required field: variation_id'
                ]);
                exit;
            }
            
            $variationId = (int)$input['variation_id'];
            
            // Check if variation exists
            $stmt = $pdo->prepare("SELECT Variation_ID FROM product_variations WHERE Variation_ID = :variation_id");
            $stmt->execute(['variation_id' => $variationId]);
            
            if (!$stmt->fetch()) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Variation not found'
                ]);
                exit;
            }
            
            // Delete variation
            $stmt = $pdo->prepare("DELETE FROM product_variations WHERE Variation_ID = :variation_id");
            $result = $stmt->execute(['variation_id' => $variationId]);
            
            if ($result) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Variation deleted successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete variation'
                ]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode([
                'success' => false,
                'message' => 'Method not allowed'
            ]);
            break;
    }
    
} catch (PDOException $e) {
    error_log("Manage Product Variations API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Manage Product Variations API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred: ' . $e->getMessage()
    ]);
}

