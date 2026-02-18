<?php
/**
 * Chat Agent SMS trigger endpoint
 * Accepts POST JSON from your chat agent to send SMS notifications to customers.
 *
 * Usage examples:
 * 1) Trigger order status SMS by order_id + status:
 *    POST { "secret": "<secret>", "order_id": 123, "status": "Preparing" }
 *
 * 2) Send custom SMS by user_id + message:
 *    POST { "secret": "<secret>", "user_id": 45, "message": "Your custom text" }
 *
 * Security: The endpoint expects a `secret` value that matches the configured
 * Semaphore API key in `sms_config` by default. For stronger security, set an
 * env variable `CHAT_AGENT_SECRET` and supply that value from your chat agent.
 */

header('Content-Type: application/json');

// Load bootstrap and classes
require_once __DIR__ . '/../connection.php';
require_once __DIR__ . '/../includes/SemaphoreSMS.php';

// Read JSON body
$body = json_decode(file_get_contents('php://input'), true);

$providedSecret = $body['secret'] ?? null;
if (!$providedSecret) {
    // allow header fallback
    $providedSecret = $_SERVER['HTTP_X_CHAT_AUTH'] ?? null;
}

if (!$providedSecret) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Missing secret authentication token']);
    exit;
}

try {
    // Load configured sms_config row for semaphore
    $stmt = $pdo->prepare("SELECT api_key FROM sms_config WHERE provider = 'semaphore' LIMIT 1");
    $stmt->execute();
    $config = $stmt->fetch(PDO::FETCH_ASSOC);
    $configuredKey = $config['api_key'] ?? null;

    // Env secret has priority if present
    $envSecret = getenv('CHAT_AGENT_SECRET') ?: null;
    $validSecret = $envSecret ?: $configuredKey;

    if (!$validSecret || !hash_equals((string)$validSecret, (string)$providedSecret)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid secret token']);
        exit;
    }

    $sms = new SemaphoreSMS($pdo);

    // If order_id and status provided -> send status SMS
    if (!empty($body['order_id']) && !empty($body['status'])) {
        $orderId = (int)$body['order_id'];
        $status = trim($body['status']);
        $result = $sms->sendOrderStatusNotification($orderId, $status);

        echo json_encode(array_merge(['success' => (bool)$result['success']], $result));
        exit;
    }

    // If user_id and message provided -> send custom SMS
    if (!empty($body['user_id']) && !empty($body['message'])) {
        $userId = (int)$body['user_id'];
        $message = trim($body['message']);

        $stmt = $pdo->prepare("SELECT Phone_Number FROM users WHERE User_ID = :user_id LIMIT 1");
        $stmt->execute(['user_id' => $userId]);
        $phone = $stmt->fetchColumn();

        if (!$phone) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'User phone number not found']);
            exit;
        }

        $res = $sms->sendSMS($phone, $message, null, 'chat_custom');
        echo json_encode(array_merge(['success' => (bool)$res['success']], $res));
        exit;
    }

    // Nothing matched
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid payload. Provide either {order_id,status} or {user_id,message}']);
    exit;

} catch (Exception $e) {
    error_log('send_chat_sms.php exception: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
    exit;
}
