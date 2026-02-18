<?php
/**
 * Insert Sample Product Variations
 * Adds variations for existing products
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

// Sample variations for products
$variations = [
    // Variations for Product ID 1 (Concrete Mix)
    [
        'Product_ID' => 1,
        'variation_name' => 'Size',
        'variation_value' => '50kg bag'
    ],
    [
        'Product_ID' => 1,
        'variation_name' => 'Size',
        'variation_value' => '40kg bag'
    ],
    
    // Variations for Product ID 2 (Lumber Plank)
    [
        'Product_ID' => 2,
        'variation_name' => 'Size',
        'variation_value' => '2x2 x 8ft'
    ],
    [
        'Product_ID' => 2,
        'variation_name' => 'Size',
        'variation_value' => '2x3 x 8ft'
    ],
    [
        'Product_ID' => 2,
        'variation_name' => 'Size',
        'variation_value' => '2x4 x 8ft'
    ],
    [
        'Product_ID' => 2,
        'variation_name' => 'Size',
        'variation_value' => '2x6 x 8ft'
    ],
    [
        'Product_ID' => 2,
        'variation_name' => 'Length',
        'variation_value' => '8ft'
    ],
    [
        'Product_ID' => 2,
        'variation_name' => 'Length',
        'variation_value' => '10ft'
    ],
    [
        'Product_ID' => 2,
        'variation_name' => 'Length',
        'variation_value' => '12ft'
    ],
    
    // Variations for Product ID 3 (Republic Sand Cement)
    [
        'Product_ID' => 3,
        'variation_name' => 'Size',
        'variation_value' => '40kg bag'
    ],
    [
        'Product_ID' => 3,
        'variation_name' => 'Type',
        'variation_value' => 'Type 1P (Portland)'
    ]
];

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    $inserted = 0;
    $skipped = 0;
    $errors = [];
    
    foreach ($variations as $variation) {
        try {
            // Check if variation already exists
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM product_variations WHERE Product_ID = :product_id AND variation_name = :variation_name AND variation_value = :variation_value");
            $stmt->execute([
                'product_id' => $variation['Product_ID'],
                'variation_name' => $variation['variation_name'],
                'variation_value' => $variation['variation_value']
            ]);
            
            if ($stmt->fetchColumn() > 0) {
                $skipped++;
                continue;
            }
            
            // Insert variation
            $stmt = $pdo->prepare("INSERT INTO product_variations (Product_ID, variation_name, variation_value) VALUES (:product_id, :variation_name, :variation_value)");
            $result = $stmt->execute($variation);
            
            if ($result) {
                $inserted++;
            }
        } catch (Exception $e) {
            $errors[] = "Variation for Product ID {$variation['Product_ID']}: " . $e->getMessage();
        }
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => "Inserted $inserted variations, skipped $skipped duplicates",
        'inserted' => $inserted,
        'skipped' => $skipped,
        'errors' => $errors
    ]);
    
} catch (Exception $e) {
    error_log("Insert Product Variations Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred: ' . $e->getMessage()
    ]);
}

