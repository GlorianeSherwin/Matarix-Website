<?php
/**
 * Semaphore SMS Sender Class
 * Handles SMS notifications via Semaphore API
 */

class SemaphoreSMS {
    private $pdo;
    private $apiKey;
    private $senderName;
    private $isActive;
    private $apiUrl = 'https://api.semaphore.co/api/v4/messages';
    
    /**
     * Constructor - loads configuration from database
     */
    public function __construct($pdo) {
        $this->pdo = $pdo;
        $this->loadConfig();
    }
    
    /**
     * Load SMS configuration from database
     */
    private function loadConfig() {
        try {
            $stmt = $this->pdo->query("
                SELECT api_key, sender_name, is_active 
                FROM sms_config 
                WHERE provider = 'semaphore' 
                LIMIT 1
            ");
            $config = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($config) {
                $this->apiKey = $config['api_key'];
                $this->senderName = $config['sender_name'] ?? 'Matarix';
                $this->isActive = (bool)$config['is_active'];
            } else {
                error_log("SemaphoreSMS: No configuration found in database");
                $this->isActive = false;
            }
        } catch (PDOException $e) {
            error_log("SemaphoreSMS: Failed to load config - " . $e->getMessage());
            $this->isActive = false;
        }
    }
    
    /**
     * Format phone number to Philippine format
     * Converts various formats to 639XXXXXXXXX
     */
    private function formatPhoneNumber($phone) {
        // Remove all non-numeric characters
        $phone = preg_replace('/[^0-9]/', '', $phone);
        
        // Handle different formats
        if (strlen($phone) == 10 && substr($phone, 0, 1) == '9') {
            // 9XXXXXXXXX -> 639XXXXXXXXX
            return '63' . $phone;
        } elseif (strlen($phone) == 11 && substr($phone, 0, 2) == '09') {
            // 09XXXXXXXXX -> 639XXXXXXXXX
            return '63' . substr($phone, 1);
        } elseif (strlen($phone) == 12 && substr($phone, 0, 2) == '63') {
            // Already in correct format
            return $phone;
        } elseif (strlen($phone) == 13 && substr($phone, 0, 3) == '+63') {
            // +63XXXXXXXXXX -> 63XXXXXXXXXX
            return substr($phone, 1);
        }
        
        // Return as-is if format is unknown
        return $phone;
    }
    
    /**
     * Send SMS notification
     * 
     * @param string $phoneNumber Recipient phone number
     * @param string $message SMS message content
     * @param int|null $orderId Associated order ID (optional)
     * @param string|null $deliveryStatus Delivery status trigger (optional)
     * @return array Response with success status and message
     */
    public function sendSMS($phoneNumber, $message, $orderId = null, $deliveryStatus = null) {
        // Check if SMS is active
        if (!$this->isActive) {
            error_log("SemaphoreSMS: SMS disabled in configuration");
            return [
                'success' => false,
                'message' => 'SMS service is currently disabled'
            ];
        }
        
        // Validate phone number
        if (empty($phoneNumber)) {
            error_log("SemaphoreSMS: Empty phone number provided");
            return [
                'success' => false,
                'message' => 'Phone number is required'
            ];
        }
        
        // Format phone number
        $formattedPhone = $this->formatPhoneNumber($phoneNumber);
        
        // Validate message
        if (empty($message)) {
            error_log("SemaphoreSMS: Empty message provided");
            return [
                'success' => false,
                'message' => 'Message content is required'
            ];
        }
        
        // Prepare request data
        $postData = [
            'apikey' => $this->apiKey,
            'number' => $formattedPhone,
            'message' => $message,
            'sendername' => $this->senderName
        ];
        
        try {
            // Send SMS via Semaphore API
            $ch = curl_init($this->apiUrl);
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);
            
            // Log the SMS attempt
            $this->logSMS(
                $formattedPhone,
                $message,
                $httpCode == 200 ? 'sent' : 'failed',
                $orderId,
                $deliveryStatus,
                $response
            );
            
            // Check response
            if ($httpCode == 200) {
                $responseData = json_decode($response, true);
                
                error_log("SemaphoreSMS: SMS sent successfully to {$formattedPhone}");
                
                return [
                    'success' => true,
                    'message' => 'SMS sent successfully',
                    'response' => $responseData
                ];
            } else {
                error_log("SemaphoreSMS: Failed to send SMS. HTTP {$httpCode}: {$response}");
                
                return [
                    'success' => false,
                    'message' => 'Failed to send SMS',
                    'http_code' => $httpCode,
                    'response' => $response,
                    'curl_error' => $curlError
                ];
            }
            
        } catch (Exception $e) {
            error_log("SemaphoreSMS: Exception - " . $e->getMessage());
            
            // Log failed attempt
            $this->logSMS(
                $formattedPhone,
                $message,
                'error',
                $orderId,
                $deliveryStatus,
                $e->getMessage()
            );
            
            return [
                'success' => false,
                'message' => 'SMS sending exception: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Log SMS to database
     */
    private function logSMS($phoneNumber, $message, $status, $orderId, $deliveryStatus, $response) {
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO sms_logs (phone_number, message, status, order_id, delivery_status, response)
                VALUES (:phone, :message, :status, :order_id, :delivery_status, :response)
            ");
            
            $stmt->execute([
                'phone' => $phoneNumber,
                'message' => $message,
                'status' => $status,
                'order_id' => $orderId,
                'delivery_status' => $deliveryStatus,
                'response' => is_string($response) ? $response : json_encode($response)
            ]);
        } catch (PDOException $e) {
            error_log("SemaphoreSMS: Failed to log SMS - " . $e->getMessage());
        }
    }
    
    /**
     * Send order status notification
     * 
     * @param int $orderId Order ID
     * @param string $status Order/Delivery status
     * @return array Response with success status
     */
    public function sendOrderStatusNotification($orderId, $status) {
        try {
            // Get customer phone and order details
            $stmt = $this->pdo->prepare("
                SELECT u.Phone_Number, u.First_Name, o.Order_ID
                FROM orders o
                JOIN users u ON o.User_ID = u.User_ID
                WHERE o.Order_ID = :order_id
            ");
            $stmt->execute(['order_id' => $orderId]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$order) {
                return [
                    'success' => false,
                    'message' => 'Order not found'
                ];
            }
            
            if (empty($order['Phone_Number'])) {
                return [
                    'success' => false,
                    'message' => 'Customer phone number not available'
                ];
            }
            
            // Build message based on status
            $customerName = $order['First_Name'] ?? 'Customer';
            $message = $this->buildStatusMessage($customerName, $orderId, $status);
            
            // Send SMS
            return $this->sendSMS(
                $order['Phone_Number'],
                $message,
                $orderId,
                $status
            );
            
        } catch (PDOException $e) {
            error_log("SemaphoreSMS: Error sending order status notification - " . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Build SMS message based on status
     */
    private function buildStatusMessage($customerName, $orderId, $status) {
        $messages = [
            'Preparing' => "Hi {$customerName}! Your Matarix order #{$orderId} is now being prepared. We'll notify you when it's on the way!",
            'Out for Delivery' => "Hi {$customerName}! Your Matarix order #{$orderId} is now out for delivery! Your order should arrive soon.",
            'Delivered' => "Hi {$customerName}! Your Matarix order #{$orderId} has been successfully delivered. Thank you for choosing Matarix!"
        ];
        
        return $messages[$status] ?? "Hi {$customerName}! Your Matarix order #{$orderId} status: {$status}";
    }

    /**
     * Send "ready for pickup" SMS for Pick Up orders
     *
     * @param int $orderId Order ID
     * @return array Response with success status
     */
    public function sendReadyForPickupNotification($orderId) {
        try {
            $stmt = $this->pdo->prepare("
                SELECT u.Phone_Number, u.First_Name, o.Order_ID
                FROM orders o
                JOIN users u ON o.User_ID = u.User_ID
                WHERE o.Order_ID = :order_id
            ");
            $stmt->execute(['order_id' => (int)$orderId]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                return ['success' => false, 'message' => 'Order not found'];
            }
            if (empty($order['Phone_Number'])) {
                return ['success' => false, 'message' => 'Customer phone number not available'];
            }

            $customerName = $order['First_Name'] ?? 'Customer';
            $ord = str_pad($orderId, 4, '0', STR_PAD_LEFT);
            $message = "Hi {$customerName}! Your Matarix order ORD-{$ord} is ready for pickup. Please come to the store to collect your order. Thank you!";

            return $this->sendSMS($order['Phone_Number'], $message, (int)$orderId, 'Ready for Pickup');
        } catch (PDOException $e) {
            error_log("SemaphoreSMS: Error sending ready for pickup notification - " . $e->getMessage());
            return ['success' => false, 'message' => 'Database error: ' . $e->getMessage()];
        }
    }
}
