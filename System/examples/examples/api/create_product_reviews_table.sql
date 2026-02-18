-- Create product_reviews table for individual product ratings
-- This table stores ratings and reviews for individual products within an order

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add foreign key constraints if tables exist
ALTER TABLE `product_reviews`
  ADD CONSTRAINT `fk_product_reviews_order` FOREIGN KEY (`Order_ID`) REFERENCES `orders` (`Order_ID`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_product_reviews_product` FOREIGN KEY (`Product_ID`) REFERENCES `products` (`Product_ID`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_product_reviews_user` FOREIGN KEY (`User_ID`) REFERENCES `users` (`User_ID`) ON DELETE CASCADE;

