<?php
/**
 * Ensure Product Reviews Table Exists
 * Creates the product_reviews table if it doesn't exist
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../includes/db_functions.php';

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

try {
    // Check if table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'product_reviews'");
    $tableExists = $stmt->rowCount() > 0;
    
    if ($tableExists) {
        echo json_encode([
            'success' => true,
            'message' => 'product_reviews table already exists',
            'table_exists' => true
        ]);
        exit;
    }
    
    // Create table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `product_reviews` (
          `Review_ID` int(11) NOT NULL AUTO_INCREMENT,
          `Order_ID` int(11) NOT NULL,
          `Product_ID` int(11) NOT NULL,
          `User_ID` int(11) NOT NULL,
          `Rating` tinyint(4) NOT NULL CHECK (`Rating` between 1 and 5),
          `Review_Text` text DEFAULT NULL,
          `Created_At` timestamp NOT NULL DEFAULT current_timestamp(),
          `Updated_At` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
          PRIMARY KEY (`Review_ID`),
          KEY `fk_product_reviews_order` (`Order_ID`),
          KEY `fk_product_reviews_product` (`Product_ID`),
          KEY `fk_product_reviews_user` (`User_ID`),
          UNIQUE KEY `unique_order_product_user` (`Order_ID`, `Product_ID`, `User_ID`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    
    // Try to add foreign key constraints (may fail if tables don't exist yet, that's okay)
    try {
        $pdo->exec("
            ALTER TABLE `product_reviews`
            ADD CONSTRAINT `fk_product_reviews_order` FOREIGN KEY (`Order_ID`) REFERENCES `orders` (`Order_ID`) ON DELETE CASCADE,
            ADD CONSTRAINT `fk_product_reviews_product` FOREIGN KEY (`Product_ID`) REFERENCES `products` (`Product_ID`) ON DELETE CASCADE,
            ADD CONSTRAINT `fk_product_reviews_user` FOREIGN KEY (`User_ID`) REFERENCES `users` (`User_ID`) ON DELETE CASCADE
        ");
    } catch (PDOException $e) {
        // Foreign keys might already exist or tables might not be ready, that's okay
        error_log("Foreign key constraint warning: " . $e->getMessage());
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'product_reviews table created successfully',
        'table_exists' => true
    ]);
    
} catch (PDOException $e) {
    error_log("Ensure Product Reviews Table Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to create product_reviews table: ' . $e->getMessage()
    ]);
}
?>

