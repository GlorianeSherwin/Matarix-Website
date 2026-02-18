<?php
/**
 * Semaphore SMS Configuration
 */

return [
    'api_key' => getenv('SEMAPHORE_API_KEY') ?: 'add888fb40ec6d6f131f6f8eb03f294c',
    'sender_name' => getenv('SEMAPHORE_SENDER_NAME') ?: 'MATARIK',
    'api_url' => 'https://api.semaphore.co/api/v4/messages',
    'enabled' => getenv('SEMAPHORE_ENABLED') !== 'false' // Enable/disable SMS
];
