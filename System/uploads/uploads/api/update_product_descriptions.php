<?php
/**
 * Update Product Descriptions
 * Adds descriptions to existing products in the database
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

// Product descriptions
$descriptions = [
    1 => 'Concrete Mix is a pre-blended mixture of cement, sand, and aggregates designed for ready-to-use concrete applications. Perfect for small to medium construction projects, this high-quality mix ensures consistent strength and durability. Ideal for foundations, slabs, driveways, and general concrete work.',
    
    2 => 'Lumber Plank is premium quality wood lumber suitable for various construction and carpentry applications. Made from high-grade timber, these planks are properly seasoned and treated for enhanced durability. Perfect for framing, decking, furniture making, and general construction projects.',
    
    // Add description for the sample product we created
    3 => 'Republic Sand Cement is a high-quality Portland cement manufactured to meet Philippine National Standards. This 40kg bag is perfect for construction projects requiring strong, durable concrete. Ideal for foundations, walls, columns, and other structural applications. Features excellent workability and consistent quality.'
];

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    $updated = 0;
    $errors = [];
    
    foreach ($descriptions as $productId => $description) {
        try {
            $stmt = $pdo->prepare("UPDATE products SET description = :description WHERE Product_ID = :product_id");
            $result = $stmt->execute([
                'description' => $description,
                'product_id' => $productId
            ]);
            
            if ($result && $stmt->rowCount() > 0) {
                $updated++;
            }
        } catch (Exception $e) {
            $errors[] = "Product ID $productId: " . $e->getMessage();
        }
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => "Updated descriptions for $updated products",
        'updated' => $updated,
        'errors' => $errors
    ]);
    
} catch (Exception $e) {
    error_log("Update Product Descriptions Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred: ' . $e->getMessage()
    ]);
}

