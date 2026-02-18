/**
 * URL Authentication Helper
 * DISABLED - System now uses session-based authentication only
 * This file is kept for backward compatibility but does not add user_id to URLs
 */

(function() {
    'use strict';
    
    // All functions are now no-ops - authentication is handled via PHP sessions
    // This file is kept to prevent errors if other scripts reference it
    
    /**
     * Get user_id from sessionStorage (not URL)
     * @returns {string|null} User ID or null if not present
     */
    function getUserId() {
        return sessionStorage.getItem('user_id');
    }
    
    /**
     * Check if user is logged in (checks sessionStorage only)
     * @returns {boolean} True if user is logged in
     */
    function isLoggedIn() {
        const userIdInStorage = sessionStorage.getItem('user_id');
        return userIdInStorage !== null && userIdInStorage !== '';
    }
    
    /**
     * Add user_id to a URL - DISABLED (returns URL as-is)
     * @param {string} url - The URL
     * @returns {string} URL unchanged
     */
    function addUserIdToUrl(url) {
        // No-op: Sessions handle authentication, no need for URL params
        return url;
    }
    
    // Export functions for backward compatibility
    window.addUserIdToUrl = addUserIdToUrl;
    window.getUserId = getUserId;
    window.isLoggedIn = isLoggedIn;
    
    // Remove user_id from current URL if present (cleanup)
    if (window.location.search.includes('user_id=')) {
        const url = new URL(window.location.href);
        url.searchParams.delete('user_id');
        window.history.replaceState({}, '', url.toString());
    }
    
})();
