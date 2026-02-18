<?php
/**
 * Example: How to use Database Functions
 * This file demonstrates how to use the database helper functions
 */

require_once __DIR__ . '/../includes/db_functions.php';

// Initialize database functions
$db = new DatabaseFunctions();

// ============================================
// EXAMPLE 1: Insert a new user
// ============================================
echo "Example 1: Inserting a new user\n";
$userData = [
    'first_name' => 'John',
    'last_name' => 'Doe',
    'email' => 'john.doe@example.com',
    'address' => '123 Main Street, City',
    'password' => 'password123',
    'role' => 'Customer'
];

$userId = $db->insertUser($userData);
if ($userId) {
    echo "User inserted successfully with ID: $userId\n\n";
} else {
    echo "Failed to insert user\n\n";
}

// ============================================
// EXAMPLE 2: Insert data into any table
// ============================================
echo "Example 2: Inserting into products table\n";
$productData = [
    'Product_Name' => 'Sample Product',
    'category' => 'Steel & Metal',
    'stock_level' => 100,
    'Minimum_Stock' => 20,
    'stock_status' => 'In Stock',
    'price' => 150.00,
    'length' => '200.00',
    'Unit' => 'cm'
];

$productId = $db->insert('products', $productData);
if ($productId) {
    echo "Product inserted successfully with ID: $productId\n\n";
} else {
    echo "Failed to insert product\n\n";
}

// ============================================
// EXAMPLE 3: Select data from database
// ============================================
echo "Example 3: Selecting users\n";
$users = $db->select('users', [], 'User_ID DESC', 10);
echo "Found " . count($users) . " users\n\n";

// Select with conditions
$customers = $db->select('users', ['role' => 'Customer'], 'User_ID DESC');
echo "Found " . count($customers) . " customers\n\n";

// ============================================
// EXAMPLE 4: Update data
// ============================================
echo "Example 4: Updating user\n";
if ($userId) {
    $updateData = [
        'First_Name' => 'Jane'
    ];
    $conditions = [
        'User_ID' => $userId
    ];
    
    $success = $db->update('users', $updateData, $conditions);
    if ($success) {
        echo "User updated successfully\n\n";
    } else {
        echo "Failed to update user\n\n";
    }
}

// ============================================
// EXAMPLE 5: Login authentication
// ============================================
echo "Example 5: Authenticating user\n";
$email = 'john.doe@example.com';
$password = 'password123';

$user = $db->login($email, $password);
if ($user) {
    echo "Login successful! User ID: " . $user['User_ID'] . "\n";
    echo "User Role: " . $user['role'] . "\n\n";
} else {
    echo "Login failed\n\n";
}

// ============================================
// EXAMPLE 6: Check if email exists
// ============================================
echo "Example 6: Checking if email exists\n";
$emailExists = $db->emailExists('john.doe@example.com');
echo $emailExists ? "Email exists\n\n" : "Email does not exist\n\n";

// ============================================
// EXAMPLE 7: Custom query using PDO
// ============================================
echo "Example 7: Custom query\n";
$pdo = $db->getConnection();
$stmt = $pdo->query("SELECT COUNT(*) as total FROM users");
$result = $stmt->fetch();
echo "Total users in database: " . $result['total'] . "\n";

