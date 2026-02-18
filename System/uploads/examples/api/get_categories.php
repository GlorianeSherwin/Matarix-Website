<?php
/**
 * Get Categories API Endpoint
 * Returns all active categories from the database
 */

// Start output buffering to prevent any output before headers
ob_start();

// Suppress error display for production
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/../includes/db_functions.php';

try {
    $db = new DatabaseFunctions();
    $pdo = $db->getConnection();
    
    // Check if categories table exists, if not return enum categories
    $tableExists = $pdo->query("SHOW TABLES LIKE 'categories'")->rowCount() > 0;
    
    if ($tableExists) {
        // Get categories from categories table
        $stmt = $pdo->prepare("
            SELECT Category_ID, category_name, category_description, category_icon, display_order
            FROM categories 
            WHERE is_active = 1 
            ORDER BY display_order ASC, category_name ASC
        ");
        $stmt->execute();
        $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'categories' => $categories,
            'source' => 'table'
        ]);
        exit;
    } else {
        // Fallback to ENUM categories
        $enumCategories = [
            ['category_name' => 'Cement & Concrete Products', 'category_icon' => 'fas fa-hammer'],
            ['category_name' => 'Masonry', 'category_icon' => 'fas fa-th-large'],
            ['category_name' => 'Sand & Gravel', 'category_icon' => 'fas fa-mountain'],
            ['category_name' => 'Lumber & Wood', 'category_icon' => 'fas fa-tree'],
            ['category_name' => 'Steel & Metal', 'category_icon' => 'fas fa-industry'],
            ['category_name' => 'Roofing & Insulation', 'category_icon' => 'fas fa-home'],
            ['category_name' => 'Pipes & Plumbing', 'category_icon' => 'fas fa-faucet'],
            ['category_name' => 'Paints & Finishes', 'category_icon' => 'fas fa-paint-brush'],
            ['category_name' => 'Tools & Hardware', 'category_icon' => 'fas fa-tools'],
            ['category_name' => 'Electrical', 'category_icon' => 'fas fa-bolt']
        ];
        
        ob_end_clean();
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'categories' => $enumCategories,
            'source' => 'enum'
        ]);
        exit;
    }
    
} catch (Exception $e) {
    ob_end_clean();
    error_log("Get Categories API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while fetching categories'
    ]);
    exit;
}

