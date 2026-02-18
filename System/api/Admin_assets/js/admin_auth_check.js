/**
 * Admin Authentication Check Script
 * Verifies PHP session on page load - uses sessions only, no URL parameters
 */

(function() {
    'use strict';
    
    // Check if user is authenticated via session
    function checkSession() {
        // Check PHP session via API
        console.log('Checking PHP session via API...');
        return fetch('../api/check_session.php', {
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
                // Verify user has admin role
                const userRole = data.user_role;
                const adminRoles = ['Admin', 'Store Employee', 'Delivery Driver'];
                
                if (!adminRoles.includes(userRole)) {
                    console.log('User does not have admin role, redirecting...');
                    sessionStorage.clear();
                    window.location.href = '../Customer/Login.html';
                    return null;
                }
                
                // Session exists, store user info in sessionStorage for quick access
                sessionStorage.setItem('user_id', data.user_id);
                if (data.user_email) sessionStorage.setItem('user_email', data.user_email);
                if (data.user_role) sessionStorage.setItem('user_role', data.user_role);
                if (data.user_name) sessionStorage.setItem('user_name', data.user_name);

                // Apply RBAC UI + page guards (hide unauthorized features, redirect if needed)
                try {
                    applyAdminRbacGuards(userRole);
                } catch (e) {
                    console.warn('RBAC guard error:', e);
                }
                
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
                console.log('No active session found - redirecting to login');
                sessionStorage.clear();
                
                // Remove user_id from URL if present
                const url = new URL(window.location.href);
                if (url.searchParams.has('user_id')) {
                    url.searchParams.delete('user_id');
                    window.history.replaceState({}, '', url.toString());
                }
                
                // Redirect to admin login
                window.location.href = '../Customer/Login.html';
                return null;
            }
        })
        .catch(error => {
            console.error('Error checking session:', error);
            // On error, redirect to login
            sessionStorage.clear();
            window.location.href = '../Customer/Login.html';
            return null;
        });
    }

    /**
     * Hide/guard admin pages based on fixed role permissions.
     * - Admin: full access
     * - Store Employee: Orders/Inventory/Deliveries/Reports (+ profile/about), no User Management
     * - Delivery Driver: Deliveries only (+ profile/about), no Orders/Inventory/Reports/User Management
     */
    function applyAdminRbacGuards(userRole) {
        const path = (window.location.pathname || '').toLowerCase();
        const isAdmin = userRole === 'Admin';
        const isEmployee = userRole === 'Store Employee';
        const isDriver = userRole === 'Delivery Driver';

        // Sidebar link IDs are consistent across admin pages
        const hide = (selector) => {
            const el = document.querySelector(selector);
            if (el) {
                const li = el.closest('li');
                if (li) li.style.display = 'none';
                else el.style.display = 'none';
            }
        };

        // Hide links based on role
        if (isDriver) {
            hide('#orders-nav');
            hide('#inventory-nav');
            hide('#analytics-nav');
            hide('#user-management-nav');
        } else if (isEmployee) {
            hide('#user-management-nav');
        }

        if (isAdmin) return;

        // Page guards: redirect away from unauthorized pages
        const onUserMgmt = path.includes('/admin/usermanagement.html');
        const onReports = path.includes('/admin/reportsadmin.html');
        const onCustomerFeedback = path.includes('/admin/customerfeedback.html');
        const onOrders = path.includes('/admin/ordersadmin.html')
            || path.includes('/admin/vieworderaccept.html')
            || path.includes('/admin/viewordersreject.html');
        const onInventory = path.includes('/admin/inventoryadmin.html');
        const onDeliveries = path.includes('/admin/deliveriesadmin.html');
        const onProfile = path.includes('/admin/adminprofile.html');
        const onAbout = path.includes('/admin/aboutus.html');
        const onViewOrderAccept = path.includes('/admin/vieworderaccept.html');
        const onViewOrdersReject = path.includes('/admin/viewordersreject.html');

        if (isDriver) {
            // Drivers: deliveries + view order details (same page as admin; APIs enforce assigned-only access)
            if (!(onDeliveries || onProfile || onAbout || onViewOrderAccept || onViewOrdersReject)) {
                sessionStorage.setItem('rbac_denied_message', 'Access Denied: This action is not available for your role');
                window.location.href = '../Admin/DeliveriesAdmin.html';
            }
            return;
        }

        if (isEmployee) {
            // Employees: no user management
            if (onUserMgmt) {
                sessionStorage.setItem('rbac_denied_message', 'Access Denied: This action is not available for your role');
                window.location.href = '../Admin/OrdersAdmin.html';
            }
            // Otherwise allow Orders/Inventory/Deliveries/Reports/CustomerFeedback
            if (!(onOrders || onInventory || onDeliveries || onReports || onCustomerFeedback || onAbout || onProfile)) {
                // Default safe landing
                window.location.href = '../Admin/OrdersAdmin.html';
            }
        }
    }
    
    /**
     * Setup logout button handlers for all admin pages
     */
    function setupLogoutHandlers() {
        // Handle sidebar logout buttons
        $(document).on('click', '.logout-button', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Logging out from sidebar...');
            window.location.href = '../Customer/Login.html';
        });
        
        // Handle bottom logout buttons (like in AdminProfile)
        $(document).on('click', '.logout-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Are you sure you want to logout?')) {
                console.log('Logging out...');
                window.location.href = '../Customer/Login.html';
            }
        });
    }
    
    /**
     * Initialize authentication check
     */
    function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                checkSession();
                setupLogoutHandlers();
            });
        } else {
            // DOM already ready
            checkSession();
            setupLogoutHandlers();
        }
    }
    
    // Export functions for global access
    window.AdminAuthCheck = {
        checkSession: checkSession
    };
    
    // Initialize immediately
    init();
    
})();
