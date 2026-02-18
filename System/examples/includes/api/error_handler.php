<?php
/**
 * Centralized Error Handler
 * Provides consistent error handling and user-friendly messages
 */

class ErrorHandler {
    /**
     * Handle and format errors for API responses
     */
    public static function handleError($error, $context = '') {
        $errorCode = 500;
        $userMessage = 'An unexpected error occurred. Please try again later.';
        $logMessage = '';
        
        if ($error instanceof PDOException) {
            $errorCode = 500;
            $errorCode = $error->getCode();
            
            // Database-specific error handling
            switch ($error->getCode()) {
                case 23000: // Integrity constraint violation
                    $userMessage = 'This operation conflicts with existing data. Please check your input.';
                    $logMessage = "Database constraint violation: " . $error->getMessage();
                    break;
                case '42S02': // Table doesn't exist
                    $userMessage = 'Database configuration error. Please contact administrator.';
                    $logMessage = "Missing table: " . $error->getMessage();
                    break;
                case '42S22': // Column doesn't exist
                    $userMessage = 'Database configuration error. Please run migration scripts.';
                    $logMessage = "Missing column: " . $error->getMessage();
                    break;
                default:
                    $logMessage = "Database error [{$error->getCode()}]: " . $error->getMessage();
            }
        } elseif ($error instanceof Exception) {
            $logMessage = "Exception in {$context}: " . $error->getMessage();
            
            // Check for specific error messages
            $message = $error->getMessage();
            if (strpos($message, 'connection') !== false || strpos($message, 'database') !== false) {
                $userMessage = 'Unable to connect to database. Please try again later.';
            } elseif (strpos($message, 'permission') !== false || strpos($message, 'access') !== false) {
                $userMessage = 'You do not have permission to perform this action.';
                $errorCode = 403;
            }
        } else {
            $logMessage = "Unknown error in {$context}: " . (string)$error;
        }
        
        // Log error
        error_log($logMessage . " | Context: {$context} | File: " . ($error->getFile() ?? 'unknown') . " | Line: " . ($error->getLine() ?? 'unknown'));
        
        return [
            'success' => false,
            'message' => $userMessage,
            'error_code' => $errorCode,
            'context' => $context
        ];
    }
    
    /**
     * Validate required fields
     */
    public static function validateRequired($data, $requiredFields) {
        $missing = [];
        foreach ($requiredFields as $field) {
            if (!isset($data[$field]) || (is_string($data[$field]) && trim($data[$field]) === '')) {
                $missing[] = ucfirst(str_replace('_', ' ', $field));
            }
        }
        
        if (!empty($missing)) {
            return [
                'success' => false,
                'message' => 'Missing required fields: ' . implode(', ', $missing),
                'missing_fields' => $missing
            ];
        }
        
        return ['success' => true];
    }
    
    /**
     * Validate email format
     */
    public static function validateEmail($email) {
        if (empty($email)) {
            return ['success' => false, 'message' => 'Email is required'];
        }
        
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'message' => 'Invalid email format'];
        }
        
        return ['success' => true];
    }
    
    /**
     * Validate phone number
     */
    public static function validatePhone($phone) {
        $phoneNumber = preg_replace('/\D/', '', $phone);
        if (empty($phoneNumber) || strlen($phoneNumber) < 10 || strlen($phoneNumber) > 15) {
            return ['success' => false, 'message' => 'Please enter a valid phone number (10-15 digits)'];
        }
        return ['success' => true, 'cleaned' => $phoneNumber];
    }
    
    /**
     * Validate postal code (Philippines: 4 digits)
     */
    public static function validatePostalCode($postalCode) {
        if (empty($postalCode)) {
            return ['success' => false, 'message' => 'Postal code is required'];
        }
        
        if (!preg_match('/^\d{4}$/', trim($postalCode))) {
            return ['success' => false, 'message' => 'Postal code must be 4 digits'];
        }
        
        return ['success' => true];
    }
    
    /**
     * Send error response
     */
    public static function sendError($message, $code = 400, $details = []) {
        http_response_code($code);
        echo json_encode([
            'success' => false,
            'message' => $message,
            'details' => $details
        ]);
        exit;
    }
    
    /**
     * Send success response
     */
    public static function sendSuccess($message, $data = [], $code = 200) {
        http_response_code($code);
        echo json_encode([
            'success' => true,
            'message' => $message,
            'data' => $data
        ]);
        exit;
    }
}

