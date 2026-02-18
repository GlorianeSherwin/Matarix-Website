/**
 * Customer Authentication Check Script
 * Verifies PHP session on page load - uses sessions only, no URL parameters
 */

(function() {
    'use strict';
    
    // Skip authentication check on login, registration, and forgot password pages
    const currentPath = window.location.pathname.toLowerCase();
    if (currentPath.includes('login.html') || 
        currentPath.includes('registration.html') || 
        currentPath.includes('forgotpassword.html') ||
        currentPath.includes('adminlogin.html') ||
        currentPath.includes('adminregistration.html')) {
        console.log('Skipping auth check on login/registration page');
        return;
    }
    
    // Check if user is authenticated via session
    function checkSession() {
        // Check PHP session via API
        const isRoot = window.location.pathname.includes('/index.html') || window.location.pathname.endsWith('/');
        const isInCustomerFolder = window.location.pathname.includes('/Customer/');
        let apiPath = '../api/check_session.php';
        if (isRoot) {
            apiPath = 'api/check_session.php';
        } else if (isInCustomerFolder) {
            apiPath = '../api/check_session.php';
        }
        
        console.log('Checking PHP session via API...', apiPath);
        return fetch(apiPath, {
            method: 'GET',
            credentials: 'include' // Important: include cookies for session
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Session check failed');
            }
            return response.json();
        })
        .then(data => {
            console.log('Session check response:', data);
            
            if (data.logged_in && data.user_id) {
                // Session exists, store user info in sessionStorage for quick access
                sessionStorage.setItem('user_id', data.user_id);
                if (data.user_email) sessionStorage.setItem('user_email', data.user_email);
                if (data.user_role) sessionStorage.setItem('user_role', data.user_role);
                if (data.user_name) sessionStorage.setItem('user_name', data.user_name);
                
                // Remove user_id from URL if present (clean up old URLs)
                const url = new URL(window.location.href);
                if (url.searchParams.has('user_id')) {
                    url.searchParams.delete('user_id');
                    window.history.replaceState({}, '', url.toString());
                    console.log('Removed user_id from URL - using session only');
                }
                
                return data;
            } else {
                // No session - clear any stale data
                console.log('No active session found - clearing stale user data');
                sessionStorage.removeItem('user_id');
                sessionStorage.removeItem('user_email');
                sessionStorage.removeItem('user_role');
                sessionStorage.removeItem('user_name');
                
                // Remove user_id from URL if present
                const url = new URL(window.location.href);
                if (url.searchParams.has('user_id')) {
                    url.searchParams.delete('user_id');
                    window.history.replaceState({}, '', url.toString());
                }
                
                // Only redirect if it's a protected page
                const protectedPages = ['customerprofile', 'cart', 'checkout', 'ordersummary', 'transactionhistory', 'delivery-tracking', 'deliverytracking'];
                const isProtectedPage = protectedPages.some(page => currentPath.includes(page));
                
                if (isProtectedPage) {
                    console.log('No active session on protected page, redirecting to login...');
                    
                    // Store current page for redirect after login
                    sessionStorage.setItem('redirect_after_login', window.location.pathname);
                    
                    // Redirect to customer login
                    window.location.href = '../Customer/Login.html';
                    return null;
                } else {
                    // Public page, allow browsing without login
                    console.log('Public page - allowing access without login');
                    return { logged_in: false };
                }
            }
        })
        .catch(error => {
            console.error('Error checking session:', error);
            
            // On error, only redirect if protected page
            const protectedPages = ['customerprofile', 'cart', 'checkout', 'ordersummary', 'transactionhistory', 'delivery-tracking', 'deliverytracking'];
            const isProtectedPage = protectedPages.some(page => currentPath.includes(page));
            
            if (isProtectedPage && !window.location.href.includes('Login.html')) {
                window.location.href = '../Customer/Login.html';
            }
            return { logged_in: false };
        });
    }
    
    /**
     * Initialize authentication check
     */
    function init() {
        // Check if we just logged in (coming from login page)
        const justLoggedIn = document.referrer && document.referrer.toLowerCase().includes('login.html');
        const delay = justLoggedIn ? 500 : 0; // 500ms delay if coming from login to ensure session cookie is set
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(checkSession, delay);
            });
        } else {
            // DOM already ready
            setTimeout(checkSession, delay);
        }
    }
    
    // Export functions for global access
    window.CustomerAuthCheck = {
        checkSession: checkSession
    };
    
    // Initialize immediately
    init();
    
})();
