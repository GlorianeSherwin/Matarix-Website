<?php
/**
 * RBAC Helper
 * - Fixed, predefined permissions per role (immutable after account creation)
 * - Backend enforcement for every API call
 */
require_once __DIR__ . '/session_helper.php';

/**
 * Load RBAC config from JSON (single source of truth).
 * @return array
 */
function rbac_load_config(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;

    $path = __DIR__ . '/../config/rbac.json';
    $raw = @file_get_contents($path);
    if ($raw === false) {
        throw new RuntimeException("RBAC config missing: {$path}");
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || !isset($decoded['roles']) || !is_array($decoded['roles'])) {
        throw new RuntimeException("RBAC config invalid: {$path}");
    }
    $cfg = $decoded;
    return $cfg;
}

/**
 * Normalize role input.
 * @param string|null $role
 * @return string|null
 */
function rbac_normalize_role(?string $role): ?string {
    if ($role === null) return null;
    $role = trim($role);
    return $role === '' ? null : $role;
}

/**
 * Check if a role has a permission.
 * Supports '*' for full access.
 */
function rbac_can(?string $role, string $permission): bool {
    $role = rbac_normalize_role($role);
    $permission = trim($permission);
    if ($role === null || $permission === '') return false;

    $cfg = rbac_load_config();
    $roles = $cfg['roles'] ?? [];
    if (!isset($roles[$role])) return false;

    $perms = $roles[$role]['permissions'] ?? [];
    if (!is_array($perms)) return false;

    if (in_array('*', $perms, true)) return true;
    return in_array($permission, $perms, true);
}

/**
 * Write a standard JSON error response and exit.
 */
function rbac_api_deny(int $statusCode, string $message, ?string $requiredPermission = null): void {
    // Clean any output before sending JSON response
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    if (!headers_sent()) {
        http_response_code($statusCode);
        header('Content-Type: application/json');
    }
    
    echo json_encode([
        'success' => false,
        'message' => $message,
        'required_permission' => $requiredPermission
    ]);
    exit;
}

/**
 * Require authentication (API context).
 */
function rbac_require_login_api(): void {
    if (!isset($_SESSION['user_id']) || empty($_SESSION['user_id'])) {
        rbac_api_deny(401, 'Not authenticated');
    }
}

/**
 * Require a permission (API context), with logging.
 */
function rbac_require_permission_api(string $permission): void {
    rbac_require_login_api();

    $role = $_SESSION['user_role'] ?? null;
    if (!rbac_can($role, $permission)) {
        $userId = $_SESSION['user_id'] ?? null;
        $path = $_SERVER['SCRIPT_NAME'] ?? 'unknown';
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        error_log("[RBAC] DENY user_id={$userId} role=" . ($role ?? 'null') . " perm={$permission} path={$path} ip={$ip}");
        rbac_api_deny(403, 'Access Denied: This action is not available for your role', $permission);
    }
}

