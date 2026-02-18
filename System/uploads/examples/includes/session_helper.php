<?php
/**
 * Session Helper Functions
 * Provides functions for managing user sessions
 * Uses different session names for Admin and Customer to prevent conflicts
 */

// Include path helper for dynamic path detection
require_once __DIR__ . '/path_helper.php';

/**
 * Determine session context (admin or customer) based on request path
 * @return string 'admin' or 'customer'
 */
function getSessionContext() {
    // Check if we're in an admin API or page
    $scriptPath = $_SERVER['SCRIPT_NAME'] ?? '';
    $requestUri = $_SERVER['REQUEST_URI'] ?? '';
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    
    // Check if path contains /Admin/ or admin-specific APIs
    if (strpos($scriptPath, '/Admin/') !== false || 
        strpos($requestUri, '/Admin/') !== false ||
        strpos($referer, '/Admin/') !== false ||
        (strpos($scriptPath, '/api/') !== false && (
            strpos($scriptPath, 'get_users') !== false ||
            strpos($scriptPath, 'get_analytics') !== false ||
            strpos($scriptPath, 'get_orders') !== false ||
            strpos($scriptPath, 'get_product_details') !== false ||
            strpos($scriptPath, 'generate_report') !== false ||
            strpos($scriptPath, 'export_report') !== false ||
            strpos($scriptPath, 'get_all_feedback') !== false ||
            strpos($scriptPath, 'get_top_products') !== false ||
            strpos($scriptPath, 'update_user') !== false ||
            strpos($scriptPath, 'add_user') !== false ||
            strpos($scriptPath, 'delete_user') !== false ||
            strpos($scriptPath, 'load_deliveries_admin') !== false ||
            strpos($scriptPath, 'get_delivery') !== false ||
            strpos($scriptPath, 'assign_') !== false ||
            strpos($scriptPath, 'update_delivery') !== false ||
            strpos($scriptPath, 'get_fleet') !== false ||
            strpos($scriptPath, 'add_product') !== false ||
            strpos($scriptPath, 'update_product') !== false ||
            strpos($scriptPath, 'delete_product') !== false ||
            strpos($scriptPath, 'get_products_admin') !== false ||
            strpos($scriptPath, 'update_payment_status') !== false ||
            strpos($scriptPath, 'update_order_status') !== false ||
            strpos($scriptPath, 'delete_order') !== false ||
            strpos($scriptPath, 'approve_order') !== false ||
            strpos($scriptPath, 'reject_order') !== false ||
            strpos($scriptPath, 'add_driver') !== false ||
            strpos($scriptPath, 'add_fleet_vehicle') !== false ||
            strpos($scriptPath, 'remove_driver') !== false ||
            strpos($scriptPath, 'remove_fleet_vehicle') !== false ||
            strpos($scriptPath, 'update_fleet_vehicle') !== false ||
            strpos($scriptPath, 'get_delivery_drivers') !== false ||
            strpos($scriptPath, 'get_delivery_status') !== false ||
            strpos($scriptPath, 'get_driver_deliveries') !== false ||
            strpos($scriptPath, 'export_deliveries_pdf') !== false ||
            strpos($scriptPath, 'manage_product_variations') !== false ||
            strpos($scriptPath, 'upload_product_image') !== false ||
            strpos($scriptPath, 'update_order_settings') !== false ||
            strpos($scriptPath, 'get_order_settings') !== false ||
            strpos($scriptPath, 'manage_categories') !== false
        ))) {
        return 'admin';
    }
    
    // Default to customer
    return 'customer';
}

/**
 * Start session with appropriate name based on context
 * @param string|null $context Optional context ('admin' or 'customer'), auto-detected if null
 */
function startSession($context = null) {
    // Close any existing session first to allow switching contexts
    if (session_status() !== PHP_SESSION_NONE) {
        session_write_close();
    }
    
    if ($context === null) {
        $context = getSessionContext();
    }
    
    // Set different session names for admin and customer
    $sessionName = $context === 'admin' ? 'MATARIX_ADMIN_SESSION' : 'MATARIX_CUSTOMER_SESSION';
    
    // Dynamically determine cookie path - works for both local and Hostinger hosting
    $cookiePath = getBasePath();
    
    // Configure session cookie parameters BEFORE setting session name
    // This ensures cookies are stored separately and don't conflict
    session_set_cookie_params([
        'lifetime' => 0, // Session cookie (expires when browser closes)
        'path' => $cookiePath,
        'domain' => '', // Empty = current domain (works for both localhost and Hostinger)
        'secure' => isSecure(), // Automatically set based on HTTPS detection
        'httponly' => true, // Prevent JavaScript access for security
        'samesite' => 'Lax' // CSRF protection
    ]);
    
    session_name($sessionName);
    session_start();
}

// Don't auto-start session here - let each API/page decide when to start

/**
 * Check if user is logged in
 * @return bool
 */
function isLoggedIn() {
    return isset($_SESSION['user_id']);
}

/**
 * Get current user ID
 * @return int|null
 */
function getUserId() {
    return $_SESSION['user_id'] ?? null;
}

/**
 * Get current user role
 * @return string|null
 */
function getUserRole() {
    return $_SESSION['user_role'] ?? null;
}

/**
 * Get current user email
 * @return string|null
 */
function getUserEmail() {
    return $_SESSION['user_email'] ?? null;
}

/**
 * Get current user name
 * @return string|null
 */
function getUserName() {
    return $_SESSION['user_name'] ?? null;
}

/**
 * Check if user has specific role
 * @param string|array $roles Role or array of roles to check
 * @return bool
 */
function hasRole($roles) {
    $userRole = getUserRole();
    if (is_array($roles)) {
        return in_array($userRole, $roles);
    }
    return $userRole === $roles;
}

/**
 * Require user to be logged in (redirect if not)
 * @param string $redirectUrl URL to redirect to if not logged in
 */
function requireLogin($redirectUrl = '../Customer/Login.html') {
    if (!isLoggedIn()) {
        header('Location: ' . $redirectUrl);
        exit;
    }
}

/**
 * Require specific role (redirect if not)
 * @param string|array $roles Required role(s)
 * @param string $redirectUrl URL to redirect to if role doesn't match
 */
function requireRole($roles, $redirectUrl = '../Customer/Login.html') {
    requireLogin($redirectUrl);
    if (!hasRole($roles)) {
        header('Location: ' . $redirectUrl);
        exit;
    }
}

/**
 * Logout user
 */
function logout() {
    $sessionName = session_name();
    $_SESSION = array();
    
    // Get base path for cookie deletion (path_helper.php is already included at top)
    $basePath = getBasePath();
    
    // Destroy session cookie with correct path
    if (isset($_COOKIE[$sessionName])) {
        setcookie($sessionName, '', time() - 3600, $basePath);
    }
    
    // Also try to clear both session types
    $adminSessionName = 'MATARIX_ADMIN_SESSION';
    $customerSessionName = 'MATARIX_CUSTOMER_SESSION';
    
    if (isset($_COOKIE[$adminSessionName])) {
        setcookie($adminSessionName, '', time() - 3600, $basePath);
    }
    if (isset($_COOKIE[$customerSessionName])) {
        setcookie($customerSessionName, '', time() - 3600, $basePath);
    }
    
    session_destroy();
}
