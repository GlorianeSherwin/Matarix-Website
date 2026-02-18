<?php
/**
 * SMTP Configuration
 * Configure your SMTP settings here
 */

return [
    'smtp_host' => getenv('SMTP_HOST') ?: 'smtp.gmail.com',  // Gmail SMTP, change for other providers
    'smtp_port' => getenv('SMTP_PORT') ?: 587,                // TLS port (465 for SSL)
    'smtp_username' => getenv('SMTP_USERNAME') ?: 'mcsproj.2@gmail.com',          // Your email address
    'smtp_password' => getenv('SMTP_PASSWORD') ?: 'ajaxsvsyllrgrxdg',          // Your email password or app password
    'smtp_encryption' => getenv('SMTP_ENCRYPTION') ?: 'tls',   // 'tls' or 'ssl'
    // 0 = off (production), 2 = verbose debug (troubleshooting)
    'smtp_debug' => getenv('SMTP_DEBUG') !== false ? (int)getenv('SMTP_DEBUG') : 0,
    'from_email' => getenv('FROM_EMAIL') ?: 'mcsproj.2@gmail.com',
    'from_name' => getenv('FROM_NAME') ?: 'MATARIX Construction Supply',
    'reply_to_email' => getenv('REPLY_TO_EMAIL') ?: 'support@matarix.com',
    'reply_to_name' => getenv('REPLY_TO_NAME') ?: 'MATARIX Support'
];

