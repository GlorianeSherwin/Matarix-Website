<?php
/**
 * Setup Product Reviews Table
 * Run this file in your browser to create the product_reviews table
 * URL: http://localhost/MatarixWEBs/setup_product_reviews_table.php
 */

header('Content-Type: text/html; charset=utf-8');

require_once __DIR__ . '/includes/db_functions.php';

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setup Product Reviews Table</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #dc3545;
            border-bottom: 3px solid #dc3545;
            padding-bottom: 10px;
        }
        .success {
            background-color: #d4edda;
            color: #155724;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border: 1px solid #c3e6cb;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border: 1px solid #f5c6cb;
        }
        .info {
            background-color: #d1ecf1;
            color: #0c5460;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border: 1px solid #bee5eb;
        }
        pre {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            border: 1px solid #dee2e6;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background-color: #dc3545;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
        }
        .btn:hover {
            background-color: #c82333;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📝 Setup Product Reviews Table</h1>
        
        <?php
        try {
            $db = new DatabaseFunctions();
            $pdo = $db->getConnection();
            
            if (!$pdo) {
                throw new Exception("Failed to connect to database");
            }
            
            echo '<div class="info">✓ Database connection successful!</div>';
            
            // Check if table already exists
            $stmt = $pdo->query("SHOW TABLES LIKE 'product_reviews'");
            $tableExists = $stmt->rowCount() > 0;
            
            if ($tableExists) {
                echo '<div class="info">';
                echo '<strong>ℹ️ Table Already Exists</strong><br>';
                echo 'The <code>product_reviews</code> table already exists in your database.';
                echo '</div>';
                
                // Show table structure
                $stmt = $pdo->query("DESCRIBE product_reviews");
                $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                echo '<h2>Current Table Structure:</h2>';
                echo '<pre>';
                echo "Table: product_reviews\n";
                echo str_repeat('=', 80) . "\n";
                printf("%-20s %-20s %-10s %-10s %-10s\n", "Field", "Type", "Null", "Key", "Default");
                echo str_repeat('-', 80) . "\n";
                foreach ($columns as $col) {
                    printf("%-20s %-20s %-10s %-10s %-10s\n", 
                        $col['Field'], 
                        $col['Type'], 
                        $col['Null'], 
                        $col['Key'], 
                        $col['Default'] ?? 'NULL'
                    );
                }
                echo '</pre>';
                
                // Count existing reviews
                $countStmt = $pdo->query("SELECT COUNT(*) as count FROM product_reviews");
                $count = $countStmt->fetch(PDO::FETCH_ASSOC)['count'];
                echo "<div class='info'><strong>Total Reviews:</strong> $count</div>";
                
            } else {
                // Create the table
                echo '<div class="info">Creating product_reviews table...</div>';
                
                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `product_reviews` (
                      `Review_ID` int(11) NOT NULL AUTO_INCREMENT,
                      `Order_ID` int(11) NOT NULL COMMENT 'The order this review belongs to',
                      `Product_ID` int(11) NOT NULL COMMENT 'The product being reviewed',
                      `User_ID` int(11) NOT NULL COMMENT 'The user who wrote the review',
                      `Rating` tinyint(4) NOT NULL CHECK (`Rating` BETWEEN 1 AND 5) COMMENT 'Rating from 1 to 5 stars',
                      `Review_Text` text DEFAULT NULL COMMENT 'Optional review text/comment',
                      `Created_At` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'When the review was created',
                      `Updated_At` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'When the review was last updated',
                      PRIMARY KEY (`Review_ID`),
                      KEY `fk_product_reviews_order` (`Order_ID`),
                      KEY `fk_product_reviews_product` (`Product_ID`),
                      KEY `fk_product_reviews_user` (`User_ID`),
                      UNIQUE KEY `unique_order_product_user` (`Order_ID`, `Product_ID`, `User_ID`) COMMENT 'Prevents duplicate reviews for same product in same order by same user'
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores product reviews and ratings from customers'
                ");
                
                echo '<div class="success">';
                echo '<strong>✓ Table Created Successfully!</strong><br>';
                echo 'The <code>product_reviews</code> table has been created.';
                echo '</div>';
                
                // Try to add foreign key constraints
                try {
                    $pdo->exec("
                        ALTER TABLE `product_reviews`
                        ADD CONSTRAINT `fk_product_reviews_order` 
                          FOREIGN KEY (`Order_ID`) 
                          REFERENCES `orders` (`Order_ID`) 
                          ON DELETE CASCADE 
                          ON UPDATE CASCADE,
                        ADD CONSTRAINT `fk_product_reviews_product` 
                          FOREIGN KEY (`Product_ID`) 
                          REFERENCES `products` (`Product_ID`) 
                          ON DELETE CASCADE 
                          ON UPDATE CASCADE,
                        ADD CONSTRAINT `fk_product_reviews_user` 
                          FOREIGN KEY (`User_ID`) 
                          REFERENCES `users` (`User_ID`) 
                          ON DELETE CASCADE 
                          ON UPDATE CASCADE
                    ");
                    
                    echo '<div class="success">';
                    echo '<strong>✓ Foreign Key Constraints Added!</strong><br>';
                    echo 'Foreign keys have been successfully added to maintain data integrity.';
                    echo '</div>';
                    
                } catch (PDOException $e) {
                    echo '<div class="error">';
                    echo '<strong>⚠️ Foreign Key Warning</strong><br>';
                    echo 'Table created successfully, but foreign key constraints could not be added.<br>';
                    echo 'This is usually okay - the table will still work, but data integrity checks will be less strict.<br>';
                    echo '<strong>Error:</strong> ' . htmlspecialchars($e->getMessage());
                    echo '</div>';
                }
                
                // Show table structure
                $stmt = $pdo->query("DESCRIBE product_reviews");
                $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                echo '<h2>Table Structure:</h2>';
                echo '<pre>';
                echo "Table: product_reviews\n";
                echo str_repeat('=', 80) . "\n";
                printf("%-20s %-20s %-10s %-10s %-10s\n", "Field", "Type", "Null", "Key", "Default");
                echo str_repeat('-', 80) . "\n";
                foreach ($columns as $col) {
                    printf("%-20s %-20s %-10s %-10s %-10s\n", 
                        $col['Field'], 
                        $col['Type'], 
                        $col['Null'], 
                        $col['Key'], 
                        $col['Default'] ?? 'NULL'
                    );
                }
                echo '</pre>';
            }
            
            echo '<div class="info">';
            echo '<strong>📋 Table Information:</strong><br>';
            echo '• <strong>Review_ID:</strong> Auto-increment primary key<br>';
            echo '• <strong>Order_ID:</strong> Links to orders table<br>';
            echo '• <strong>Product_ID:</strong> Links to products table<br>';
            echo '• <strong>User_ID:</strong> Links to users table<br>';
            echo '• <strong>Rating:</strong> 1-5 star rating (required)<br>';
            echo '• <strong>Review_Text:</strong> Optional text review/comment<br>';
            echo '• <strong>Created_At:</strong> Timestamp when review was created<br>';
            echo '• <strong>Updated_At:</strong> Timestamp when review was last updated<br>';
            echo '<br>';
            echo '<strong>Unique Constraint:</strong> Prevents same user from reviewing the same product multiple times in the same order.';
            echo '</div>';
            
        } catch (Exception $e) {
            echo '<div class="error">';
            echo '<strong>❌ Error:</strong><br>';
            echo htmlspecialchars($e->getMessage());
            echo '</div>';
        }
        ?>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #dee2e6;">
            <p><strong>Next Steps:</strong></p>
            <ul>
                <li>The table is now ready to store product reviews</li>
                <li>Customers can now submit reviews when viewing their orders</li>
                <li>Reviews will appear on product detail pages</li>
                <li>You can view all reviews in the Admin → Customer Feedback page</li>
            </ul>
        </div>
    </div>
</body>
</html>

