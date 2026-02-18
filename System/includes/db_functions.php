<?php
/**
 * Database Helper Functions
 * Provides reusable functions for database operations
 */

    // Set PHP default timezone to Philippine Time
date_default_timezone_set('Asia/Manila');

class DatabaseFunctions {
    private $pdo;
    
    public function __construct() {
        // Start output buffering to prevent any output before headers
        if (ob_get_level() == 0) {
            ob_start();
        }
        
        // Load database config (uses config/database.local.php for Hostinger, else defaults)
        $configPath = __DIR__ . '/../config/database.php';
        if (!is_file($configPath)) {
            throw new Exception('Database config not found. Ensure config/database.php exists.');
        }
        require_once $configPath;
        
        // Create DSN (Data Source Name)
        $dsn = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset=utf8mb4";
        
        // Connection options
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
        ];
        
        try {
            // Create PDO connection
            $this->pdo = new PDO($dsn, $db_username, $db_password, $options);
            
            // Set timezone to Philippine Time (UTC+8)
            $this->pdo->exec("SET time_zone = '+08:00'");
        } catch (PDOException $e) {
            // Clean any output before logging
            if (ob_get_level() > 0) {
                ob_clean();
            }
            error_log("Database Connection Error: " . $e->getMessage());
            throw new Exception("Unable to connect to the database. Please contact the administrator.");
        }
    }
    
    /**
     * Authenticate user login
     * @param string $email Email or username
     * @param string $password Plain text password
     * @return array|false User data if successful, false otherwise
     */
    public function login($email, $password) {
        try {
            // Check if email exists in database
            $stmt = $this->pdo->prepare("SELECT * FROM users WHERE email = :email LIMIT 1");
            $stmt->execute(['email' => $email]);
            $user = $stmt->fetch();
            
            if ($user && password_verify($password, $user['password'])) {
                // Remove password from returned data
                unset($user['password']);
                return $user;
            }
            
            return false;
        } catch (PDOException $e) {
            error_log("Login Error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Insert a new user into the database
     * @param array $userData User data array
     * @return int|false User_ID if successful, false otherwise
     */
    public function insertUser($userData) {
        try {
            // Hash the password
            $hashedPassword = password_hash($userData['password'], PASSWORD_DEFAULT);
            
            // Build dynamic INSERT query to handle both old and new address fields
            $columns = ['First_Name', 'Middle_Name', 'Last_Name', 'Phone_Number', 'email', 'password', 'role'];
            $placeholders = [':first_name', ':middle_name', ':last_name', ':phone_number', ':email', ':password', ':role'];
            $params = [
                'first_name' => $userData['first_name'] ?? null,
                'middle_name' => $userData['middle_name'] ?? null,
                'last_name' => $userData['last_name'] ?? null,
                'phone_number' => $userData['phone_number'] ?? null,
                'email' => $userData['email'],
                'password' => $hashedPassword,
                'role' => $userData['role'] ?? 'Customer'
            ];
            
            // Add address field (backward compatibility)
            if (isset($userData['address'])) {
                $columns[] = 'address';
                $placeholders[] = ':address';
                $params['address'] = $userData['address'];
            }
            
            // Add structured address fields if provided
            $addressFields = ['address_street', 'address_city', 'address_district', 'address_barangay', 'address_postal_code', 'address_region'];
            foreach ($addressFields as $field) {
                if (isset($userData[$field])) {
                    $dbField = str_replace('address_', 'address_', $field); // Keep as is
                    $columns[] = $dbField;
                    $placeholders[] = ':' . $field;
                    $params[$field] = $userData[$field];
                }
            }
            
            $sql = "INSERT INTO users (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";
            $stmt = $this->pdo->prepare($sql);
            $result = $stmt->execute($params);
            
            if ($result) {
                return $this->pdo->lastInsertId();
            }
            
            return false;
        } catch (PDOException $e) {
            error_log("Insert User Error: " . $e->getMessage());
            throw new Exception("Failed to create user account: " . $e->getMessage());
        }
    }
    
    /**
     * Get user by ID
     * @param int $userId User ID
     * @return array|false User data if found, false otherwise
     */
    public function getUserById($userId) {
        try {
            $stmt = $this->pdo->prepare("SELECT User_ID, First_Name, Middle_Name, Last_Name, Phone_Number, email, address, 
                address_street, address_city, address_district, address_barangay, address_postal_code, address_region, 
                role, created_at, profile_picture FROM users WHERE User_ID = :user_id LIMIT 1");
            $stmt->execute(['user_id' => $userId]);
            $user = $stmt->fetch();
            
            return $user ?: false;
        } catch (PDOException $e) {
            error_log("Get User Error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Check if email already exists
     * @param string $email Email to check
     * @return bool True if exists, false otherwise
     */
    public function emailExists($email) {
        try {
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM users WHERE email = :email");
            $stmt->execute(['email' => $email]);
            return $stmt->fetchColumn() > 0;
        } catch (PDOException $e) {
            error_log("Email Check Error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Generic insert function for any table
     * @param string $table Table name
     * @param array $data Associative array of column => value
     * @return int|false Insert ID if successful, false otherwise
     */
    public function insert($table, $data) {
        try {
            $columns = implode(', ', array_keys($data));
            $placeholders = ':' . implode(', :', array_keys($data));
            
            $stmt = $this->pdo->prepare("INSERT INTO {$table} ({$columns}) VALUES ({$placeholders})");
            $result = $stmt->execute($data);
            
            if ($result) {
                return $this->pdo->lastInsertId();
            }
            
            return false;
        } catch (PDOException $e) {
            error_log("Insert Error ({$table}): " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Generic select function
     * @param string $table Table name
     * @param array $conditions Associative array of conditions
     * @param string $orderBy Optional ORDER BY clause
     * @param int $limit Optional LIMIT
     * @return array Array of results
     */
    public function select($table, $conditions = [], $orderBy = null, $limit = null) {
        try {
            $sql = "SELECT * FROM {$table}";
            $params = [];
            
            if (!empty($conditions)) {
                $where = [];
                foreach ($conditions as $column => $value) {
                    $where[] = "{$column} = :{$column}";
                    $params[$column] = $value;
                }
                $sql .= " WHERE " . implode(' AND ', $where);
            }
            
            if ($orderBy) {
                $sql .= " ORDER BY {$orderBy}";
            }
            
            if ($limit) {
                $sql .= " LIMIT {$limit}";
            }
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            
            return $stmt->fetchAll();
        } catch (PDOException $e) {
            error_log("Select Error ({$table}): " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Generic update function
     * @param string $table Table name
     * @param array $data Data to update
     * @param array $conditions WHERE conditions
     * @return bool True if successful, false otherwise
     */
    public function update($table, $data, $conditions) {
        try {
            $set = [];
            $params = [];
            
            foreach ($data as $column => $value) {
                $set[] = "{$column} = :set_{$column}";
                $params["set_{$column}"] = $value;
            }
            
            $where = [];
            foreach ($conditions as $column => $value) {
                $where[] = "{$column} = :where_{$column}";
                $params["where_{$column}"] = $value;
            }
            
            $sql = "UPDATE {$table} SET " . implode(', ', $set) . " WHERE " . implode(' AND ', $where);
            
            $stmt = $this->pdo->prepare($sql);
            return $stmt->execute($params);
        } catch (PDOException $e) {
            error_log("Update Error ({$table}): " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get PDO connection (for custom queries)
     * @return PDO
     */
    public function getConnection() {
        return $this->pdo;
    }
}

