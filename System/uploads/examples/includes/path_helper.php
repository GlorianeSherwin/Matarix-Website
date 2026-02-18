<?php
/**
 * Path Helper Functions
 * Provides dynamic path detection for both local development and production hosting
 */

/**
 * Get the base path of the application dynamically
 * Works for both local development and production hosting (Hostinger, etc.)
 * @return string Base path (e.g., '/MatarixWEB/' or '/')
 */
function getBasePath() {
    $scriptPath = $_SERVER['SCRIPT_NAME'] ?? '';
    $requestUri = $_SERVER['REQUEST_URI'] ?? '';
    
    // Extract base path from script name
    $pathParts = explode('/', trim(dirname($scriptPath), '/'));
    if (!empty($pathParts) && $pathParts[0] !== '') {
        return '/' . $pathParts[0] . '/';
    }
    
    // Fallback: try to get from REQUEST_URI
    $uriPath = parse_url($requestUri, PHP_URL_PATH);
    if ($uriPath) {
        $uriParts = explode('/', trim($uriPath, '/'));
        if (!empty($uriParts) && $uriParts[0] !== '') {
            return '/' . $uriParts[0] . '/';
        }
    }
    
    // Default fallback to root
    return '/';
}

/**
 * Get the base URL of the application dynamically
 * @return string Base URL (e.g., 'http://localhost/MatarixWEB' or 'https://matarix.store')
 */
function getBaseUrl() {
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || 
             (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ||
             (!empty($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);
    $scheme = $https ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $basePath = rtrim(getBasePath(), '/');
    return $scheme . '://' . $host . $basePath;
}

/**
 * Check if using HTTPS
 * @return bool
 */
function isSecure() {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || 
           (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ||
           (!empty($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);
}
