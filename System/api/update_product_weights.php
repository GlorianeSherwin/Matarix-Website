<?php
/**
 * Update Product Weights
 * Intelligently calculates and adds weights to products with NULL weight values
 * Uses dimensions and material density formulas - NOT hard-coded values
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();

    $pdo->beginTransaction();
    
    // Get all products with NULL weight
    $stmt = $pdo->query("
        SELECT Product_ID, Product_Name, category, price, length, Width, Unit, stock_unit
        FROM products 
        WHERE weight IS NULL OR weight = 0
    ");
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $updated = 0;
    $skipped = 0;
    $results = [];
    
    // Material density in kg/m³ (for volume-based calculations)
    $materialDensities = [
        'Cement & Concrete Products' => 2400,  // kg/m³
        'Lumber & Wood' => 600,                // kg/m³ (varies by wood type)
        'Steel & Metal' => 7850,               // kg/m³ (steel)
        'Electrical' => 1500,                   // kg/m³ (plastic/electronics)
        'Plumbing' => 2700,                     // kg/m³ (aluminum/copper mix)
        'Hardware' => 7800,                     // kg/m³ (steel hardware)
        'Tools' => 2000,                        // kg/m³ (mixed materials)
        'Paint & Coatings' => 1200,             // kg/m³
        'Roofing' => 1500,                      // kg/m³
        'Insulation' => 50,                     // kg/m³
    ];
    
    foreach ($products as $product) {
        $productId = $product['Product_ID'];
        $productName = $product['Product_Name'];
        $category = $product['category'];
        $length = $product['length'];
        $width = $product['Width'];
        $unit = $product['Unit'];
        $price = (float)$product['price'];
        
        $calculatedWeight = null;
        $weightUnit = 'kg';
        
        // Method 1: Calculate from dimensions if available
        if ($length && $width && $unit) {
            // Convert length to numeric (handle string values)
            $lengthValue = is_numeric($length) ? (float)$length : floatval($length);
            $widthValue = (float)$width;
            
            if ($lengthValue > 0 && $widthValue > 0) {
                // Convert dimensions to meters
                $lengthM = convertToMeters($lengthValue, $unit);
                $widthM = convertToMeters($widthValue, $unit);
                
                // Assume standard thickness/depth based on category
                $depthM = getStandardDepth($category);
                
                // Calculate volume in m³
                $volumeM3 = $lengthM * $widthM * $depthM;
                
                // Get material density
                $density = $materialDensities[$category] ?? 1000; // Default 1000 kg/m³ (water density)
                
                // Calculate weight: volume × density
                $calculatedWeight = $volumeM3 * $density;
                
                // Round to 2 decimal places
                $calculatedWeight = round($calculatedWeight, 2);
                
                // If weight is very small (< 0.01 kg), use grams
                if ($calculatedWeight < 0.01 && $calculatedWeight > 0) {
                    $calculatedWeight = round($calculatedWeight * 1000, 2);
                    $weightUnit = 'g';
                }
            }
        }
        
        // Method 2: Estimate from price if dimensions not available
        if (!$calculatedWeight || $calculatedWeight <= 0) {
            // Use price as indicator (higher price often = heavier/more material)
            // Estimate: ₱100 = ~1kg for construction materials
            $estimatedWeight = max(0.1, round($price / 100, 2));
            
            // Adjust based on category
            $categoryMultiplier = getCategoryWeightMultiplier($category);
            $calculatedWeight = round($estimatedWeight * $categoryMultiplier, 2);
            
            // If very small, use grams
            if ($calculatedWeight < 0.01 && $calculatedWeight > 0) {
                $calculatedWeight = round($calculatedWeight * 1000, 2);
                $weightUnit = 'g';
            }
        }
        
        // Ensure minimum weight (at least 0.01 kg or 10g)
        if ($calculatedWeight <= 0) {
            $calculatedWeight = 0.01;
            $weightUnit = 'kg';
        }
        
        // Update the product
        $updateStmt = $pdo->prepare("
            UPDATE products 
            SET weight = :weight, weight_unit = :weight_unit 
            WHERE Product_ID = :product_id
        ");
        
        $updateStmt->execute([
            'weight' => $calculatedWeight,
            'weight_unit' => $weightUnit,
            'product_id' => $productId
        ]);
        
        $updated++;
        $results[] = [
            'product_id' => $productId,
            'product_name' => $productName,
            'calculated_weight' => $calculatedWeight,
            'weight_unit' => $weightUnit,
            'method' => ($length && $width) ? 'dimensions' : 'price_estimate'
        ];
    }
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => "Updated weights for $updated products",
        'updated' => $updated,
        'skipped' => $skipped,
        'results' => $results
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Update product weights error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred: ' . $e->getMessage()
    ]);
}

/**
 * Convert dimension to meters
 */
function convertToMeters($value, $unit) {
    switch (strtolower($unit ?? '')) {
        case 'mm':
            return $value / 1000;
        case 'cm':
            return $value / 100;
        case 'm':
            return $value;
        case 'inch':
            return $value * 0.0254;
        case 'ft':
            return $value * 0.3048;
        default:
            return $value / 100; // Assume cm if unknown
    }
}

/**
 * Get standard depth/thickness based on category
 */
function getStandardDepth($category) {
    $depths = [
        'Cement & Concrete Products' => 0.1,  // 10cm bag depth
        'Lumber & Wood' => 0.05,              // 5cm plank thickness
        'Steel & Metal' => 0.01,              // 1cm sheet thickness
        'Electrical' => 0.02,                 // 2cm device depth
        'Plumbing' => 0.05,                   // 5cm pipe/fitting depth
        'Hardware' => 0.01,                   // 1cm hardware depth
        'Tools' => 0.05,                      // 5cm tool depth
        'Paint & Coatings' => 0.1,            // 10cm can depth
        'Roofing' => 0.005,                   // 0.5cm sheet thickness
        'Insulation' => 0.05,                 // 5cm insulation depth
    ];
    
    return $depths[$category] ?? 0.05; // Default 5cm
}

/**
 * Get weight multiplier based on category (for price-based estimation)
 */
function getCategoryWeightMultiplier($category) {
    $multipliers = [
        'Cement & Concrete Products' => 1.5,   // Heavier
        'Lumber & Wood' => 0.8,                // Lighter
        'Steel & Metal' => 2.0,                // Much heavier
        'Electrical' => 0.3,                   // Much lighter
        'Plumbing' => 1.2,                     // Slightly heavier
        'Hardware' => 1.5,                     // Heavier
        'Tools' => 1.0,                        // Standard
        'Paint & Coatings' => 0.6,             // Lighter
        'Roofing' => 1.2,                      // Slightly heavier
        'Insulation' => 0.2,                   // Very light
    ];
    
    return $multipliers[$category] ?? 1.0; // Default 1.0
}
?>

