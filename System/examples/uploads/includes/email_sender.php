<?php
/**
 * Email Sender using PHPMailer
 * Handles sending emails via SMTP
 */

require_once __DIR__ . '/smtp_config.php';

// Check if PHPMailer is available
$phpmailerAvailable = false;

// Try to load PHPMailer from Composer
if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
    $phpmailerAvailable = class_exists('PHPMailer\PHPMailer\PHPMailer');
}

// If autoload didn't work, try loading PHPMailer directly
if (!$phpmailerAvailable && file_exists(__DIR__ . '/../vendor/phpmailer/phpmailer/src/PHPMailer.php')) {
    require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/Exception.php';
    require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/PHPMailer.php';
    require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/SMTP.php';
    $phpmailerAvailable = class_exists('PHPMailer\PHPMailer\PHPMailer');
}

// If PHPMailer is available, use it
if ($phpmailerAvailable) {
    class EmailSender {
        private $config;
        private $mailer;
        
        public function __construct() {
            $this->config = require __DIR__ . '/smtp_config.php';
            $this->mailer = new \PHPMailer\PHPMailer\PHPMailer(true);
            $this->configure();
        }
        
        private function configure() {
            try {
                // Server settings
                $this->mailer->isSMTP();
                $this->mailer->Host = $this->config['smtp_host'];
                $this->mailer->SMTPAuth = true;
                $this->mailer->Username = $this->config['smtp_username'];
                $this->mailer->Password = $this->config['smtp_password'];
                $this->mailer->SMTPSecure = $this->config['smtp_encryption'];
                $this->mailer->Port = $this->config['smtp_port'];
                
                // Enable verbose debug output for troubleshooting
                // Set to 2 for debugging, 0 for production
                $this->mailer->SMTPDebug = (int)($this->config['smtp_debug'] ?? 0);
                $this->mailer->Debugoutput = function($str, $level) {
                    error_log("PHPMailer Debug (Level $level): $str");
                };
                
                // Additional SMTP options
                $this->mailer->SMTPOptions = array(
                    'ssl' => array(
                        'verify_peer' => false,
                        'verify_peer_name' => false,
                        'allow_self_signed' => true
                    )
                );
                
                // Character encoding
                $this->mailer->CharSet = 'UTF-8';
                
                // From address
                $this->mailer->setFrom($this->config['from_email'], $this->config['from_name']);
                $this->mailer->addReplyTo($this->config['reply_to_email'], $this->config['reply_to_name']);
                
                error_log("Email configured successfully. SMTP Host: " . $this->config['smtp_host'] . ", Port: " . $this->config['smtp_port']);
                
            } catch (\Exception $e) {
                error_log("Email Configuration Error: " . $e->getMessage());
                error_log("Error trace: " . $e->getTraceAsString());
                throw new \Exception("Failed to configure email: " . $e->getMessage());
            }
        }
        
        /**
         * Send password reset email
         * @param string $to Recipient email
         * @param string $resetLink Password reset link
         * @param string $userName User's name (optional)
         * @return bool True if sent successfully
         */
        public function sendPasswordResetEmail($to, $resetLink, $userName = '') {
            try {
                error_log("Attempting to send password reset email to: " . $to);
                error_log("Reset link: " . $resetLink);
                
                $this->mailer->clearAddresses();
                $this->mailer->clearAttachments();
                $this->mailer->clearReplyTos();
                $this->mailer->clearAllRecipients();
                $this->mailer->clearCustomHeaders();
                
                // Re-add from and reply-to
                $this->mailer->setFrom($this->config['from_email'], $this->config['from_name']);
                $this->mailer->addReplyTo($this->config['reply_to_email'], $this->config['reply_to_name']);
                
                $this->mailer->clearAddresses();
                $this->mailer->addAddress($to);
                
                $subject = 'Password Reset Request - MATARIX';
                $body = $this->getPasswordResetEmailTemplate($resetLink, $userName);
                
                $this->mailer->isHTML(true);
                $this->mailer->Subject = $subject;
                $this->mailer->Body = $body;
                $this->mailer->AltBody = strip_tags($body);
                
                error_log("Sending email via PHPMailer...");
                $result = $this->mailer->send();
                
                if ($result) {
                    error_log("Email sent successfully to: " . $to);
                    return true;
                } else {
                    error_log("PHPMailer send() returned false. ErrorInfo: " . $this->mailer->ErrorInfo);
                    return false;
                }
                
            } catch (\Exception $e) {
                error_log("Email Send Exception: " . $e->getMessage());
                error_log("PHPMailer ErrorInfo: " . $this->mailer->ErrorInfo);
                error_log("Exception trace: " . $e->getTraceAsString());
                return false;
            }
        }

        /**
         * Send "payment required" email (order approved / waiting payment).
         * @param string $to Recipient email
         * @param int $orderId Order ID
         * @param float $amount Order amount (PHP)
         * @param string $paymentLink Link to payment page
         * @param string $userName User's name (optional)
         * @return bool True if sent successfully
         */
        public function sendPaymentRequiredEmail($to, $orderId, $amount, $paymentLink, $userName = '') {
            try {
                error_log("Attempting to send payment required email to: " . $to . " for order #" . $orderId);

                $this->mailer->clearAddresses();
                $this->mailer->clearAttachments();
                $this->mailer->clearReplyTos();
                $this->mailer->clearAllRecipients();
                $this->mailer->clearCustomHeaders();

                // Re-add from and reply-to
                $this->mailer->setFrom($this->config['from_email'], $this->config['from_name']);
                $this->mailer->addReplyTo($this->config['reply_to_email'], $this->config['reply_to_name']);

                $this->mailer->addAddress($to);

                $subject = 'Payment Required - Order #' . (int)$orderId . ' - MATARIX';
                $body = $this->getPaymentRequiredEmailTemplate((int)$orderId, (float)$amount, $paymentLink, $userName);

                $this->mailer->isHTML(true);
                $this->mailer->Subject = $subject;
                $this->mailer->Body = $body;
                $this->mailer->AltBody = strip_tags($body);

                $result = $this->mailer->send();
                if ($result) {
                    error_log("Payment required email sent successfully to: " . $to);
                    return true;
                }
                error_log("Payment required email failed. ErrorInfo: " . $this->mailer->ErrorInfo);
                return false;
            } catch (\Exception $e) {
                error_log("Payment required email exception: " . $e->getMessage());
                error_log("PHPMailer ErrorInfo: " . $this->mailer->ErrorInfo);
                return false;
            }
        }

        /**
         * Send "proof of payment reupload request" email.
         * @param string $to Recipient email
         * @param int $orderId Order ID
         * @param string $paymentLink Link to payment page
         * @param string $userName User's name (optional)
         * @return bool True if sent successfully
         */
        public function sendProofReuploadRequestEmail($to, $orderId, $paymentLink, $userName = '') {
            try {
                error_log("Attempting to send proof reupload request email to: " . $to . " for order #" . $orderId);

                $this->mailer->clearAddresses();
                $this->mailer->clearAttachments();
                $this->mailer->clearReplyTos();
                $this->mailer->clearAllRecipients();
                $this->mailer->clearCustomHeaders();

                // Re-add from and reply-to
                $this->mailer->setFrom($this->config['from_email'], $this->config['from_name']);
                $this->mailer->addReplyTo($this->config['reply_to_email'], $this->config['reply_to_name']);

                $this->mailer->addAddress($to);

                $subject = 'Proof of Payment Reupload Required - Order #' . (int)$orderId . ' - MATARIX';
                $body = $this->getProofReuploadRequestEmailTemplate((int)$orderId, $paymentLink, $userName);

                $this->mailer->isHTML(true);
                $this->mailer->Subject = $subject;
                $this->mailer->Body = $body;
                $this->mailer->AltBody = strip_tags($body);

                $result = $this->mailer->send();
                if ($result) {
                    error_log("Proof reupload request email sent successfully to: " . $to);
                    return true;
                }
                error_log("Proof reupload request email failed. ErrorInfo: " . $this->mailer->ErrorInfo);
                return false;
            } catch (\Exception $e) {
                error_log("Proof reupload request email exception: " . $e->getMessage());
                error_log("PHPMailer ErrorInfo: " . $this->mailer->ErrorInfo);
                return false;
            }
        }

        /**
         * Send "order in transit" email (delivery status becomes Out for Delivery).
         * @param string $to Recipient email
         * @param int $orderId Order ID
         * @param string $trackingLink Link to delivery tracking page
         * @param string $userName User's name (optional)
         * @return bool True if sent successfully
         */
        public function sendOrderInTransitEmail($to, $orderId, $trackingLink, $userName = '') {
            try {
                error_log("Attempting to send in-transit email to: " . $to . " for order #" . $orderId);

                $this->mailer->clearAddresses();
                $this->mailer->clearAttachments();
                $this->mailer->clearReplyTos();
                $this->mailer->clearAllRecipients();
                $this->mailer->clearCustomHeaders();

                // Re-add from and reply-to
                $this->mailer->setFrom($this->config['from_email'], $this->config['from_name']);
                $this->mailer->addReplyTo($this->config['reply_to_email'], $this->config['reply_to_name']);

                $this->mailer->addAddress($to);

                $subject = 'Your Order is In Transit - Order #' . (int)$orderId . ' - MATARIX';
                $body = $this->getOrderInTransitEmailTemplate((int)$orderId, $trackingLink, $userName);

                $this->mailer->isHTML(true);
                $this->mailer->Subject = $subject;
                $this->mailer->Body = $body;
                $this->mailer->AltBody = strip_tags($body);

                $result = $this->mailer->send();
                if ($result) {
                    error_log("In-transit email sent successfully to: " . $to);
                    return true;
                }
                error_log("In-transit email failed. ErrorInfo: " . $this->mailer->ErrorInfo);
                return false;
            } catch (\Exception $e) {
                error_log("In-transit email exception: " . $e->getMessage());
                error_log("PHPMailer ErrorInfo: " . $this->mailer->ErrorInfo);
                return false;
            }
        }
        
        /**
         * Send delivery completed email
         * @param string $to Recipient email
         * @param int $orderId Order ID
         * @param string $orderLink Link to order receipt page
         * @param string $userName User's name (optional)
         * @return bool True if sent successfully
         */
        public function sendDeliveryCompletedEmail($to, $orderId, $orderLink, $userName = '') {
            try {
                error_log("Attempting to send delivery completed email to: " . $to . " for order #" . $orderId);

                $this->mailer->clearAddresses();
                $this->mailer->clearAttachments();
                $this->mailer->clearReplyTos();
                $this->mailer->clearAllRecipients();
                $this->mailer->clearCustomHeaders();

                // Re-add from and reply-to
                $this->mailer->setFrom($this->config['from_email'], $this->config['from_name']);
                $this->mailer->addReplyTo($this->config['reply_to_email'], $this->config['reply_to_name']);

                $this->mailer->addAddress($to);

                $subject = 'Order Delivered - Order #' . (int)$orderId . ' - MATARIX';
                $body = $this->getDeliveryCompletedEmailTemplate((int)$orderId, $orderLink, $userName);

                $this->mailer->isHTML(true);
                $this->mailer->Subject = $subject;
                $this->mailer->Body = $body;
                $this->mailer->AltBody = strip_tags($body);

                $result = $this->mailer->send();
                if ($result) {
                    error_log("Delivery completed email sent successfully to: " . $to);
                    return true;
                }
                error_log("Delivery completed email failed. ErrorInfo: " . $this->mailer->ErrorInfo);
                return false;
            } catch (\Exception $e) {
                error_log("Delivery completed email exception: " . $e->getMessage());
                error_log("PHPMailer ErrorInfo: " . $this->mailer->ErrorInfo);
                return false;
            }
        }
        
        /**
         * Send delivery cancelled email
         * @param string $to Recipient email
         * @param int $orderId Order ID
         * @param string $rescheduleLink Link to reschedule page
         * @param string $userName User's name (optional)
         * @param string $reason Cancellation reason (optional)
         * @return bool True if sent successfully
         */
        public function sendDeliveryCancelledEmail($to, $orderId, $rescheduleLink, $userName = '', $reason = '') {
            try {
                error_log("Attempting to send delivery cancelled email to: " . $to . " for order #" . $orderId);

                $this->mailer->clearAddresses();
                $this->mailer->clearAttachments();
                $this->mailer->clearReplyTos();
                $this->mailer->clearAllRecipients();
                $this->mailer->clearCustomHeaders();

                // Re-add from and reply-to
                $this->mailer->setFrom($this->config['from_email'], $this->config['from_name']);
                $this->mailer->addReplyTo($this->config['reply_to_email'], $this->config['reply_to_name']);

                $this->mailer->addAddress($to);

                $subject = 'Delivery Cancelled - Order #' . (int)$orderId . ' - MATARIX';
                $body = $this->getDeliveryCancelledEmailTemplate((int)$orderId, $rescheduleLink, $userName, $reason);

                $this->mailer->isHTML(true);
                $this->mailer->Subject = $subject;
                $this->mailer->Body = $body;
                $this->mailer->AltBody = strip_tags($body);

                $result = $this->mailer->send();
                if ($result) {
                    error_log("Delivery cancelled email sent successfully to: " . $to);
                    return true;
                }
                error_log("Delivery cancelled email failed. ErrorInfo: " . $this->mailer->ErrorInfo);
                return false;
            } catch (\Exception $e) {
                error_log("Delivery cancelled email exception: " . $e->getMessage());
                error_log("PHPMailer ErrorInfo: " . $this->mailer->ErrorInfo);
                return false;
            }
        }
        
        /**
         * Get delivery cancelled email HTML template
         */
        private function getDeliveryCancelledEmailTemplate($orderId, $rescheduleLink, $userName = '', $reason = '') {
            $name = $userName ?: 'Customer';
            $escapedLink = htmlspecialchars($rescheduleLink, ENT_QUOTES, 'UTF-8');
            $escapedReason = htmlspecialchars($reason, ENT_QUOTES, 'UTF-8');
            
            return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>Delivery Cancelled - Order #{$orderId}</title>
            </head>
            <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
                <div style='background: linear-gradient(135deg, #d32f2f 0%, #f44336 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;'>
                    <h1 style='margin: 0; font-size: 28px;'>Delivery Cancelled</h1>
                </div>
                <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
                    <p style='font-size: 16px; margin-bottom: 20px;'>Dear {$name},</p>
                    <p style='font-size: 16px; margin-bottom: 20px;'>
                        We regret to inform you that your delivery for order <strong>#{$orderId}</strong> has been cancelled.
                    </p>
                    " . ($escapedReason ? "
                    <div style='background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;'>
                        <p style='margin: 0; font-size: 14px;'><strong>Reason:</strong> {$escapedReason}</p>
                    </div>
                    " : "") . "
                    <p style='font-size: 16px; margin: 20px 0;'>
                        Don't worry! You can easily reschedule your delivery by clicking the button below.
                    </p>
                    <div style='text-align: center; margin: 30px 0;'>
                        <a href='{$escapedLink}' style='display: inline-block; background: linear-gradient(135deg, #d32f2f 0%, #f44336 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;'>
                            Reschedule Delivery
                        </a>
                    </div>
                    <p style='font-size: 14px; color: #666; margin-top: 30px;'>
                        If you have any questions or concerns, please don't hesitate to contact us.
                    </p>
                    <p style='font-size: 14px; color: #666; margin-top: 20px;'>
                        Best regards,<br>
                        <strong>The MATARIX Team</strong>
                    </p>
                </div>
            </body>
            </html>
            ";
        }
        
        /**
         * Get delivery completed email HTML template
         */
        private function getDeliveryCompletedEmailTemplate($orderId, $orderLink, $userName = '') {
            $name = $userName ?: 'Customer';
            $escapedLink = htmlspecialchars($orderLink, ENT_QUOTES, 'UTF-8');
            
            return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>Order Delivered - Order #{$orderId}</title>
            </head>
            <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
                <div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;'>
                    <h1 style='margin: 0; font-size: 28px;'>Order Delivered!</h1>
                </div>
                <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
                    <p style='font-size: 16px; margin-bottom: 20px;'>Dear {$name},</p>
                    <p style='font-size: 16px; margin-bottom: 20px;'>
                        Great news! Your order <strong>#{$orderId}</strong> has been delivered successfully!
                    </p>
                    <div style='background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;'>
                        <p style='margin: 0; font-size: 14px;'><strong>Order Number:</strong> #{$orderId}</p>
                        <p style='margin: 10px 0 0 0; font-size: 14px;'><strong>Status:</strong> Delivered</p>
                    </div>
                    <p style='font-size: 16px; margin: 20px 0;'>
                        Thank you for choosing MATARIX! We hope you're satisfied with your purchase.
                    </p>
                    <div style='text-align: center; margin: 30px 0;'>
                        <a href='{$escapedLink}' style='display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;'>
                            View Order Receipt
                        </a>
                    </div>
                    <p style='font-size: 14px; color: #666; margin-top: 30px;'>
                        If you have any questions or concerns, please don't hesitate to contact us.
                    </p>
                    <p style='font-size: 14px; color: #666; margin-top: 20px;'>
                        Best regards,<br>
                        <strong>The MATARIX Team</strong>
                    </p>
                </div>
            </body>
            </html>
            ";
        }
        
        /**
         * Get password reset email HTML template
         */
        private function getPasswordResetEmailTemplate($resetLink, $userName = '') {
            $name = $userName ?: 'User';
            // Escape the reset link for HTML
            $escapedLink = htmlspecialchars($resetLink, ENT_QUOTES, 'UTF-8');
            
            return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
                    .content { padding: 30px 20px; background-color: #f9f9f9; }
                    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='header'>
                        <h1 style='margin: 0; color: white;'>MATARIX Construction Supply</h1>
                    </div>
                    <div class='content'>
                        <h2 style='color: #333; margin-top: 0;'>Password Reset Request</h2>
                        <p>Hello {$name},</p>
                        <p>We received a request to reset your password for your MATARIX account.</p>
                        <p>Click the button below to reset your password:</p>
                        <div style='text-align: center; margin: 30px 0;'>
                            <a href='{$escapedLink}' style='display: inline-block; padding: 14px 35px; background-color: #d32f2f; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; cursor: pointer;'>Reset Password</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style='word-break: break-all; color: #0066cc; background-color: #f0f0f0; padding: 10px; border-radius: 3px;'>{$escapedLink}</p>
                        <div class='warning'>
                            <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request this password reset, please ignore this email.
                        </div>
                        <p>If you have any questions, please contact our support team.</p>
                    </div>
                    <div class='footer'>
                        <p>&copy; " . date('Y') . " MATARIX Construction Supply. All rights reserved.</p>
                        <p>This is an automated email, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>";
        }

        /**
         * Get payment required email HTML template
         */
        private function getPaymentRequiredEmailTemplate($orderId, $amount, $paymentLink, $userName = '') {
            $name = $userName ?: 'Customer';
            $escapedLink = htmlspecialchars($paymentLink, ENT_QUOTES, 'UTF-8');
            $escapedName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
            $orderNumber = 'ORD-' . str_pad((string)(int)$orderId, 4, '0', STR_PAD_LEFT);
            $amountFormatted = '₱' . number_format((float)$amount, 2);

            return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
                    .content { padding: 30px 20px; background-color: #f9f9f9; }
                    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    .card { background: #ffffff; border: 1px solid #eee; border-radius: 8px; padding: 15px; margin: 18px 0; }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='header'>
                        <h1 style='margin: 0; color: white;'>MATARIX Construction Supply</h1>
                    </div>
                    <div class='content'>
                        <h2 style='color: #333; margin-top: 0;'>Payment Required</h2>
                        <p>Hello {$escapedName},</p>
                        <p>Your order has been approved and is now waiting for payment.</p>

                        <div class='card'>
                            <p style='margin: 0;'><strong>Order:</strong> {$orderNumber}</p>
                            <p style='margin: 0;'><strong>Amount:</strong> {$amountFormatted}</p>
                        </div>

                        <p>Please click the button below to proceed to payment:</p>
                        <div style='text-align: center; margin: 25px 0;'>
                            <a href='{$escapedLink}' style='display: inline-block; padding: 14px 35px; background-color: #d32f2f; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; cursor: pointer;'>Pay Now</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style='word-break: break-all; color: #0066cc; background-color: #f0f0f0; padding: 10px; border-radius: 3px;'>{$escapedLink}</p>
                        <p>If you have any questions, please contact our support team.</p>
                    </div>
                    <div class='footer'>
                        <p>&copy; " . date('Y') . " MATARIX Construction Supply. All rights reserved.</p>
                        <p>This is an automated email, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>";
        }

        /**
         * Get proof reupload request email HTML template
         */
        private function getProofReuploadRequestEmailTemplate($orderId, $paymentLink, $userName = '') {
            $name = $userName ?: 'Customer';
            $escapedLink = htmlspecialchars($paymentLink, ENT_QUOTES, 'UTF-8');
            $escapedName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
            $orderNumber = 'ORD-' . str_pad((string)(int)$orderId, 4, '0', STR_PAD_LEFT);

            return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
                    .content { padding: 30px 20px; background-color: #f9f9f9; }
                    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
                    .card { background: #ffffff; border: 1px solid #eee; border-radius: 8px; padding: 15px; margin: 18px 0; }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='header'>
                        <h1 style='margin: 0; color: white;'>MATARIX Construction Supply</h1>
                    </div>
                    <div class='content'>
                        <h2 style='color: #333; margin-top: 0;'>Proof of Payment Reupload Required</h2>
                        <p>Hello {$escapedName},</p>
                        <p>We need you to reupload your proof of payment for your order.</p>

                        <div class='warning'>
                            <strong><i class='fas fa-exclamation-triangle'></i> Action Required:</strong> Please upload a new proof of payment receipt for your GCash payment.
                        </div>

                        <div class='card'>
                            <p style='margin: 0;'><strong>Order Number:</strong> {$orderNumber}</p>
                            <p style='margin: 0;'><strong>Payment Method:</strong> GCash</p>
                        </div>

                        <p>Please click the button below to upload a new proof of payment:</p>
                        <div style='text-align: center; margin: 25px 0;'>
                            <a href='{$escapedLink}' style='display: inline-block; padding: 14px 35px; background-color: #d32f2f; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; cursor: pointer;'>Upload Proof of Payment</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style='word-break: break-all; color: #0066cc; background-color: #f0f0f0; padding: 10px; border-radius: 3px;'>{$escapedLink}</p>
                        <p>If you have any questions or concerns, please contact our support team.</p>
                    </div>
                    <div class='footer'>
                        <p>&copy; " . date('Y') . " MATARIX Construction Supply. All rights reserved.</p>
                        <p>This is an automated email, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>";
        }

        /**
         * Get order in transit email HTML template
         */
        private function getOrderInTransitEmailTemplate($orderId, $trackingLink, $userName = '') {
            $name = $userName ?: 'Customer';
            $escapedLink = htmlspecialchars($trackingLink, ENT_QUOTES, 'UTF-8');
            $escapedName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
            $orderNumber = 'ORD-' . str_pad((string)(int)$orderId, 4, '0', STR_PAD_LEFT);

            return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
                    .content { padding: 30px 20px; background-color: #f9f9f9; }
                    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    .badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #fff3cd; color: #856404; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='header'>
                        <h1 style='margin: 0; color: white;'>MATARIX Construction Supply</h1>
                    </div>
                    <div class='content'>
                        <h2 style='color: #333; margin-top: 0;'>Your Order is In Transit</h2>
                        <p>Hello {$escapedName},</p>
                        <p>Your delivery is now on the way.</p>
                        <p><strong>Order:</strong> {$orderNumber} <span class='badge'>Out for Delivery</span></p>

                        <p>You can track your delivery here:</p>
                        <div style='text-align: center; margin: 25px 0;'>
                            <a href='{$escapedLink}' style='display: inline-block; padding: 14px 35px; background-color: #d32f2f; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; cursor: pointer;'>Track Delivery</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style='word-break: break-all; color: #0066cc; background-color: #f0f0f0; padding: 10px; border-radius: 3px;'>{$escapedLink}</p>
                        <p>Thank you for shopping with MATARIX!</p>
                    </div>
                    <div class='footer'>
                        <p>&copy; " . date('Y') . " MATARIX Construction Supply. All rights reserved.</p>
                        <p>This is an automated email, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>";
        }
    }
} else {
    // Fallback to PHP's mail() function if PHPMailer is not available
    class EmailSender {
        private $config;
        
        public function __construct() {
            $this->config = require __DIR__ . '/smtp_config.php';
        }
        
        public function sendPasswordResetEmail($to, $resetLink, $userName = '') {
            $subject = 'Password Reset Request - MATARIX';
            $body = $this->getPasswordResetEmailTemplate($resetLink, $userName);
            
            $headers = "MIME-Version: 1.0" . "\r\n";
            $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
            $headers .= "From: " . $this->config['from_name'] . " <" . $this->config['from_email'] . ">" . "\r\n";
            $headers .= "Reply-To: " . $this->config['reply_to_email'] . "\r\n";
            
            return @mail($to, $subject, $body, $headers);
        }

        public function sendPaymentRequiredEmail($to, $orderId, $amount, $paymentLink, $userName = '') {
            $subject = 'Payment Required - Order #' . (int)$orderId . ' - MATARIX';
            $body = $this->getPaymentRequiredEmailTemplate((int)$orderId, (float)$amount, $paymentLink, $userName);

            $headers = "MIME-Version: 1.0" . "\r\n";
            $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
            $headers .= "From: " . $this->config['from_name'] . " <" . $this->config['from_email'] . ">" . "\r\n";
            $headers .= "Reply-To: " . $this->config['reply_to_email'] . "\r\n";

            return @mail($to, $subject, $body, $headers);
        }

        public function sendProofReuploadRequestEmail($to, $orderId, $paymentLink, $userName = '') {
            $subject = 'Proof of Payment Reupload Required - Order #' . (int)$orderId . ' - MATARIX';
            $body = $this->getProofReuploadRequestEmailTemplate((int)$orderId, $paymentLink, $userName);

            $headers = "MIME-Version: 1.0" . "\r\n";
            $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
            $headers .= "From: " . $this->config['from_name'] . " <" . $this->config['from_email'] . ">" . "\r\n";
            $headers .= "Reply-To: " . $this->config['reply_to_email'] . "\r\n";

            return @mail($to, $subject, $body, $headers);
        }

        public function sendOrderInTransitEmail($to, $orderId, $trackingLink, $userName = '') {
            $subject = 'Your Order is In Transit - Order #' . (int)$orderId . ' - MATARIX';
            $body = $this->getOrderInTransitEmailTemplate((int)$orderId, $trackingLink, $userName);

            $headers = "MIME-Version: 1.0" . "\r\n";
            $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
            $headers .= "From: " . $this->config['from_name'] . " <" . $this->config['from_email'] . ">" . "\r\n";
            $headers .= "Reply-To: " . $this->config['reply_to_email'] . "\r\n";

            return @mail($to, $subject, $body, $headers);
        }
        
        public function sendDeliveryCompletedEmail($to, $orderId, $orderLink, $userName = '') {
            $subject = 'Order Delivered - Order #' . (int)$orderId . ' - MATARIX';
            $body = $this->getDeliveryCompletedEmailTemplate((int)$orderId, $orderLink, $userName);

            $headers = "MIME-Version: 1.0" . "\r\n";
            $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
            $headers .= "From: " . $this->config['from_name'] . " <" . $this->config['from_email'] . ">" . "\r\n";
            $headers .= "Reply-To: " . $this->config['reply_to_email'] . "\r\n";

            return @mail($to, $subject, $body, $headers);
        }
        
        /**
         * Send delivery cancelled email
         * @param string $to Recipient email
         * @param int $orderId Order ID
         * @param string $rescheduleLink Link to reschedule page
         * @param string $userName User's name (optional)
         * @param string $reason Cancellation reason (optional)
         * @return bool True if sent successfully
         */
        public function sendDeliveryCancelledEmail($to, $orderId, $rescheduleLink, $userName = '', $reason = '') {
            $subject = 'Delivery Cancelled - Order #' . (int)$orderId . ' - MATARIX';
            $body = $this->getDeliveryCancelledEmailTemplate((int)$orderId, $rescheduleLink, $userName, $reason);

            $headers = "MIME-Version: 1.0" . "\r\n";
            $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
            $headers .= "From: " . $this->config['from_name'] . " <" . $this->config['from_email'] . ">" . "\r\n";
            $headers .= "Reply-To: " . $this->config['reply_to_email'] . "\r\n";

            return @mail($to, $subject, $body, $headers);
        }
        
        /**
         * Get delivery cancelled email HTML template
         */
        private function getDeliveryCancelledEmailTemplate($orderId, $rescheduleLink, $userName = '', $reason = '') {
            $name = $userName ?: 'Customer';
            $escapedLink = htmlspecialchars($rescheduleLink, ENT_QUOTES, 'UTF-8');
            $escapedReason = htmlspecialchars($reason, ENT_QUOTES, 'UTF-8');
            
            return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>Delivery Cancelled - Order #{$orderId}</title>
            </head>
            <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
                <div style='background: linear-gradient(135deg, #d32f2f 0%, #f44336 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;'>
                    <h1 style='margin: 0; font-size: 28px;'>Delivery Cancelled</h1>
                </div>
                <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
                    <p style='font-size: 16px; margin-bottom: 20px;'>Dear {$name},</p>
                    <p style='font-size: 16px; margin-bottom: 20px;'>
                        We regret to inform you that your delivery for order <strong>#{$orderId}</strong> has been cancelled.
                    </p>
                    " . ($escapedReason ? "
                    <div style='background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;'>
                        <p style='margin: 0; font-size: 14px;'><strong>Reason:</strong> {$escapedReason}</p>
                    </div>
                    " : "") . "
                    <p style='font-size: 16px; margin: 20px 0;'>
                        Don't worry! You can easily reschedule your delivery by clicking the button below.
                    </p>
                    <div style='text-align: center; margin: 30px 0;'>
                        <a href='{$escapedLink}' style='display: inline-block; background: linear-gradient(135deg, #d32f2f 0%, #f44336 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;'>
                            Reschedule Delivery
                        </a>
                    </div>
                    <p style='font-size: 14px; color: #666; margin-top: 30px;'>
                        If you have any questions or concerns, please don't hesitate to contact us.
                    </p>
                    <p style='font-size: 14px; color: #666; margin-top: 20px;'>
                        Best regards,<br>
                        <strong>The MATARIX Team</strong>
                    </p>
                </div>
            </body>
            </html>
            ";
        }
        
        private function getDeliveryCompletedEmailTemplate($orderId, $orderLink, $userName = '') {
            $name = $userName ?: 'Customer';
            $escapedLink = htmlspecialchars($orderLink, ENT_QUOTES, 'UTF-8');
            
            return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>Order Delivered - Order #{$orderId}</title>
            </head>
            <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
                <div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;'>
                    <h1 style='margin: 0; font-size: 28px;'>Order Delivered!</h1>
                </div>
                <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
                    <p style='font-size: 16px; margin-bottom: 20px;'>Dear {$name},</p>
                    <p style='font-size: 16px; margin-bottom: 20px;'>
                        Great news! Your order <strong>#{$orderId}</strong> has been delivered successfully!
                    </p>
                    <div style='background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;'>
                        <p style='margin: 0; font-size: 14px;'><strong>Order Number:</strong> #{$orderId}</p>
                        <p style='margin: 10px 0 0 0; font-size: 14px;'><strong>Status:</strong> Delivered</p>
                    </div>
                    <p style='font-size: 16px; margin: 20px 0;'>
                        Thank you for choosing MATARIX! We hope you're satisfied with your purchase.
                    </p>
                    <div style='text-align: center; margin: 30px 0;'>
                        <a href='{$escapedLink}' style='display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;'>
                            View Order Receipt
                        </a>
                    </div>
                    <p style='font-size: 14px; color: #666; margin-top: 30px;'>
                        If you have any questions or concerns, please don't hesitate to contact us.
                    </p>
                    <p style='font-size: 14px; color: #666; margin-top: 20px;'>
                        Best regards,<br>
                        <strong>The MATARIX Team</strong>
                    </p>
                </div>
            </body>
            </html>
            ";
        }

        private function getProofReuploadRequestEmailTemplate($orderId, $paymentLink, $userName = '') {
            $name = $userName ?: 'Customer';
            $escapedLink = htmlspecialchars($paymentLink, ENT_QUOTES, 'UTF-8');
            $escapedName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
            $orderNumber = 'ORD-' . str_pad((string)(int)$orderId, 4, '0', STR_PAD_LEFT);

            return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
                    .content { padding: 30px 20px; background-color: #f9f9f9; }
                    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
                    .card { background: #ffffff; border: 1px solid #eee; border-radius: 8px; padding: 15px; margin: 18px 0; }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='header'>
                        <h1 style='margin: 0; color: white;'>MATARIX Construction Supply</h1>
                    </div>
                    <div class='content'>
                        <h2 style='color: #333; margin-top: 0;'>Proof of Payment Reupload Required</h2>
                        <p>Hello {$escapedName},</p>
                        <p>We need you to reupload your proof of payment for your order.</p>

                        <div class='warning'>
                            <strong>⚠️ Action Required:</strong> Please upload a new proof of payment receipt for your GCash payment.
                        </div>

                        <div class='card'>
                            <p style='margin: 0;'><strong>Order Number:</strong> {$orderNumber}</p>
                            <p style='margin: 0;'><strong>Payment Method:</strong> GCash</p>
                        </div>

                        <p>Please click the button below to upload a new proof of payment:</p>
                        <div style='text-align: center; margin: 25px 0;'>
                            <a href='{$escapedLink}' style='display: inline-block; padding: 14px 35px; background-color: #d32f2f; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; cursor: pointer;'>Upload Proof of Payment</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style='word-break: break-all; color: #0066cc; background-color: #f0f0f0; padding: 10px; border-radius: 3px;'>{$escapedLink}</p>
                        <p>If you have any questions or concerns, please contact our support team.</p>
                    </div>
                    <div class='footer'>
                        <p>&copy; " . date('Y') . " MATARIX Construction Supply. All rights reserved.</p>
                        <p>This is an automated email, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>";
        }
        
        private function getPasswordResetEmailTemplate($resetLink, $userName = '') {
            $name = $userName ?: 'User';
            // Escape the reset link for HTML
            $escapedLink = htmlspecialchars($resetLink, ENT_QUOTES, 'UTF-8');
            
            return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
                    .content { padding: 30px 20px; background-color: #f9f9f9; }
                    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='header'>
                        <h1 style='margin: 0; color: white;'>MATARIX Construction Supply</h1>
                    </div>
                    <div class='content'>
                        <h2 style='color: #333; margin-top: 0;'>Password Reset Request</h2>
                        <p>Hello {$name},</p>
                        <p>We received a request to reset your password for your MATARIX account.</p>
                        <p>Click the button below to reset your password:</p>
                        <div style='text-align: center; margin: 30px 0;'>
                            <a href='{$escapedLink}' style='display: inline-block; padding: 14px 35px; background-color: #d32f2f; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; cursor: pointer;'>Reset Password</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style='word-break: break-all; color: #0066cc; background-color: #f0f0f0; padding: 10px; border-radius: 3px;'>{$escapedLink}</p>
                        <div class='warning'>
                            <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request this password reset, please ignore this email.
                        </div>
                        <p>If you have any questions, please contact our support team.</p>
                    </div>
                    <div class='footer'>
                        <p>&copy; " . date('Y') . " MATARIX Construction Supply. All rights reserved.</p>
                        <p>This is an automated email, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>";
        }

        private function getPaymentRequiredEmailTemplate($orderId, $amount, $paymentLink, $userName = '') {
            $name = $userName ?: 'Customer';
            $escapedLink = htmlspecialchars($paymentLink, ENT_QUOTES, 'UTF-8');
            $escapedName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
            $orderNumber = 'ORD-' . str_pad((string)(int)$orderId, 4, '0', STR_PAD_LEFT);
            $amountFormatted = '₱' . number_format((float)$amount, 2);

            return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
                    .content { padding: 30px 20px; background-color: #f9f9f9; }
                    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    .card { background: #ffffff; border: 1px solid #eee; border-radius: 8px; padding: 15px; margin: 18px 0; }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='header'>
                        <h1 style='margin: 0; color: white;'>MATARIX Construction Supply</h1>
                    </div>
                    <div class='content'>
                        <h2 style='color: #333; margin-top: 0;'>Payment Required</h2>
                        <p>Hello {$escapedName},</p>
                        <p>Your order has been approved and is now waiting for payment.</p>

                        <div class='card'>
                            <p style='margin: 0;'><strong>Order:</strong> {$orderNumber}</p>
                            <p style='margin: 0;'><strong>Amount:</strong> {$amountFormatted}</p>
                        </div>

                        <p>Please click the button below to proceed to payment:</p>
                        <div style='text-align: center; margin: 25px 0;'>
                            <a href='{$escapedLink}' style='display: inline-block; padding: 14px 35px; background-color: #d32f2f; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; cursor: pointer;'>Pay Now</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style='word-break: break-all; color: #0066cc; background-color: #f0f0f0; padding: 10px; border-radius: 3px;'>{$escapedLink}</p>
                        <p>If you have any questions, please contact our support team.</p>
                    </div>
                    <div class='footer'>
                        <p>&copy; " . date('Y') . " MATARIX Construction Supply. All rights reserved.</p>
                        <p>This is an automated email, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>";
        }

        private function getOrderInTransitEmailTemplate($orderId, $trackingLink, $userName = '') {
            $name = $userName ?: 'Customer';
            $escapedLink = htmlspecialchars($trackingLink, ENT_QUOTES, 'UTF-8');
            $escapedName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
            $orderNumber = 'ORD-' . str_pad((string)(int)$orderId, 4, '0', STR_PAD_LEFT);

            return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
                    .content { padding: 30px 20px; background-color: #f9f9f9; }
                    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    .badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #fff3cd; color: #856404; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='header'>
                        <h1 style='margin: 0; color: white;'>MATARIX Construction Supply</h1>
                    </div>
                    <div class='content'>
                        <h2 style='color: #333; margin-top: 0;'>Your Order is In Transit</h2>
                        <p>Hello {$escapedName},</p>
                        <p>Your delivery is now on the way.</p>
                        <p><strong>Order:</strong> {$orderNumber} <span class='badge'>Out for Delivery</span></p>

                        <p>You can track your delivery here:</p>
                        <div style='text-align: center; margin: 25px 0;'>
                            <a href='{$escapedLink}' style='display: inline-block; padding: 14px 35px; background-color: #d32f2f; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; cursor: pointer;'>Track Delivery</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style='word-break: break-all; color: #0066cc; background-color: #f0f0f0; padding: 10px; border-radius: 3px;'>{$escapedLink}</p>
                        <p>Thank you for shopping with MATARIX!</p>
                    </div>
                    <div class='footer'>
                        <p>&copy; " . date('Y') . " MATARIX Construction Supply. All rights reserved.</p>
                        <p>This is an automated email, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>";
        }
    }
}
