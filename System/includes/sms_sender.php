<?php
/**
 * SMS Sender using Semaphore API
 * Handles sending SMS via Semaphore
 */

require_once __DIR__ . '/sms_config.php';

class SMSSender {
    private $config;
    
    public function __construct() {
        $this->config = require __DIR__ . '/sms_config.php';
    }
    
    /**
     * Send SMS via Semaphore API
     * @param string $to Recipient phone number (format: 09123456789 or +639123456789)
     * @param string $message SMS message content
     * @return array ['success' => bool, 'message' => string, 'message_id' => string|null]
     */
    public function sendSMS($to, $message) {
        // Check if SMS is enabled
        if (!$this->config['enabled']) {
            error_log("SMS is disabled in configuration");
            return ['success' => false, 'message' => 'SMS is disabled', 'message_id' => null];
        }
        
        // Validate API key
        if (empty($this->config['api_key'])) {
            error_log("Semaphore API key is not configured");
            return ['success' => false, 'message' => 'SMS API key not configured', 'message_id' => null];
        }
        
        // Format phone number (remove + if present, ensure it starts with 0 or country code)
        $phoneNumber = $this->formatPhoneNumber($to);
        if (!$phoneNumber) {
            return ['success' => false, 'message' => 'Invalid phone number format', 'message_id' => null];
        }
        
        try {
            // Prepare API request
            $data = [
                'apikey' => $this->config['api_key'],
                'number' => $phoneNumber,
                'message' => $message,
                'sendername' => $this->config['sender_name']
            ];
            
            // Send request to Semaphore API
            $ch = curl_init($this->config['api_url']);
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);
            
            if ($curlError) {
                error_log("Semaphore SMS cURL Error: " . $curlError);
                return ['success' => false, 'message' => 'Connection error: ' . $curlError, 'message_id' => null];
            }
            
            $result = json_decode($response, true);
            
            if ($httpCode === 200 && isset($result[0]['message_id'])) {
                error_log("SMS sent successfully to {$phoneNumber}. Message ID: " . $result[0]['message_id']);
                return [
                    'success' => true,
                    'message' => 'SMS sent successfully',
                    'message_id' => $result[0]['message_id']
                ];
            } else {
                $errorMsg = isset($result['message']) ? $result['message'] : (isset($result[0]['message']) ? $result[0]['message'] : 'Unknown error');
                error_log("Semaphore SMS Error (HTTP {$httpCode}): " . $errorMsg . " | Response: " . $response);
                return [
                    'success' => false,
                    'message' => $errorMsg,
                    'message_id' => null
                ];
            }
            
        } catch (Exception $e) {
            error_log("SMS Send Exception: " . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Exception: ' . $e->getMessage(),
                'message_id' => null
            ];
        }
    }
    
    /**
     * Format phone number for Semaphore
     * Converts to format: 09123456789 (Philippines format)
     */
    private function formatPhoneNumber($phone) {
        if (empty($phone)) {
            return false;
        }
        
        // Remove all non-digit characters except +
        $phone = preg_replace('/[^\d+]/', '', $phone);
        
        // Remove + if present
        $phone = str_replace('+', '', $phone);
        
        // If starts with 63 (country code), convert to 0 format
        if (substr($phone, 0, 2) === '63' && strlen($phone) === 12) {
            $phone = '0' . substr($phone, 2);
        }
        
        // Validate: should be 10-11 digits starting with 0
        if (preg_match('/^0\d{9,10}$/', $phone)) {
            return $phone;
        }
        
        return false;
    }
    
    /**
     * Send order approved SMS
     */
    public function sendOrderApprovedSMS($phoneNumber, $orderId) {
        $message = "Your order ORD-" . str_pad($orderId, 4, '0', STR_PAD_LEFT) . " has been approved! You can now proceed with payment. - MATARIK";
        return $this->sendSMS($phoneNumber, $message);
    }
    
    /**
     * Send order rejected SMS
     */
    public function sendOrderRejectedSMS($phoneNumber, $orderId, $reason = null) {
        $message = "Your order ORD-" . str_pad($orderId, 4, '0', STR_PAD_LEFT) . " has been rejected.";
        if ($reason) {
            $message .= " Reason: " . $reason;
        }
        $message .= " - MATARIK";
        return $this->sendSMS($phoneNumber, $message);
    }
    
    /**
     * Send payment received SMS
     */
    public function sendPaymentReceivedSMS($phoneNumber, $orderId) {
        $message = "Payment received for your order ORD-" . str_pad($orderId, 4, '0', STR_PAD_LEFT) . ". - MATARIK";
        return $this->sendSMS($phoneNumber, $message);
    }
    
    /**
     * Send payment confirmed SMS
     */
    public function sendPaymentConfirmedSMS($phoneNumber, $orderId) {
        $message = "Your payment for order ORD-" . str_pad($orderId, 4, '0', STR_PAD_LEFT) . " has been confirmed. - MATARIK";
        return $this->sendSMS($phoneNumber, $message);
    }
    
    /**
     * Send delivery in transit SMS
     */
    public function sendDeliveryInTransitSMS($phoneNumber, $orderId) {
        $message = "Your order ORD-" . str_pad($orderId, 4, '0', STR_PAD_LEFT) . " is now in transit and on its way to you! - MATARIK";
        return $this->sendSMS($phoneNumber, $message);
    }
    
    /**
     * Send proof of payment reupload request SMS
     * @param string $phoneNumber Customer phone
     * @param int $orderId Order ID
     * @param string|null $rejectionReason Reason for rejection (included in message so customer knows what to fix)
     */
    public function sendProofReuploadRequestSMS($phoneNumber, $orderId, $rejectionReason = null) {
        $ord = str_pad($orderId, 4, '0', STR_PAD_LEFT);
        $message = "Please reupload your proof of payment for order ORD-{$ord}. The current proof needs to be replaced.";
        if (!empty(trim((string)$rejectionReason))) {
            $message .= " Reason: " . trim($rejectionReason);
        }
        $message .= " - MATARIK";
        return $this->sendSMS($phoneNumber, $message);
    }
}
