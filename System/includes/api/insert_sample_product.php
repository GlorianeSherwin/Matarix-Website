<?php
/**
 * Insert Sample Product Script
 * Creates a sample product in the database for testing
 * Run this once to add a sample product
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db_functions.php';

// Sample product data
$sampleProduct = [
    'Product_Name' => 'Republic Sand Cement (40kg)',
    'category' => 'Cement & Concrete Products',
    'stock_level' => 150,
    'Minimum_Stock' => 20,
    'stock_status' => 'In Stock',
    'price' => 319.00,
    'length' => '40',
    'last_restock' => date('Y-m-d'),
    'Width' => null,
    'Unit' => 'kg'
];

try {
    $db = new DatabaseFunctions();
    
    // Check if product already exists
    $existing = $db->select('products', ['Product_Name' => $sampleProduct['Product_Name']]);
    
    if (!empty($existing)) {
        http_response_code(200);
        echo json_encode([
            'success' => false,
            'message' => 'Sample product already exists in database',
            'product' => $existing[0]
        ]);
        exit;
    }
    
    // Insert the product
    $productId = $db->insert('products', $sampleProduct);
    
    if ($productId) {
        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Sample product created successfully',
            'product_id' => $productId,
            'product' => $sampleProduct
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to create sample product'
        ]);
    }
    
} catch (Exception $e) {
    error_log("Insert Sample Product Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred: ' . $e->getMessage()
    ]);
}

