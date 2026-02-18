/**
 * Admin Order Notifications System
 * Polls for new order notifications and displays them
 */

(function() {
    'use strict';
    
    let notificationPollInterval = null;
    let lastNotificationIds = new Set();
    let isInitialLoad = true;
    let rbacDisabled = false;

    function isRoleAllowed() {
        const role = (sessionStorage.getItem('user_role') || '').trim();
        if (!role) return null; // unknown yet
        return role === 'Admin' || role === 'Store Employee';
    }

    function hideNotificationsUiIfPresent() {
        // NOTE: Do NOT hide bell/badge here.
        // Delivery Drivers use a different notification system on this page.
    }
    
    /**
     * Format date/time for display
     */
    function formatDateTime(dateString) {
        if (!dateString) return 'Just now';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }
    
    /**
     * Get activity type configuration (icon, title, notification type)
     */
    function getActivityConfig(activityType) {
        const configs = {
            'order_created': {
                icon: 'fa-shopping-cart',
                title: 'New Order Received',
                type: 'info',
                duration: 10000
            },
            'order_status_changed': {
                icon: 'fa-exchange-alt',
                title: 'Order Status Updated',
                type: 'info',
                duration: 8000
            },
            'order_approved': {
                icon: 'fa-check-circle',
                title: 'Order Approved',
                type: 'success',
                duration: 8000
            },
            'order_rejected': {
                icon: 'fa-times-circle',
                title: 'Order Rejected',
                type: 'warning',
                duration: 8000
            },
            'payment_updated': {
                icon: 'fa-money-bill-wave',
                title: 'Payment Updated',
                type: 'info',
                duration: 8000
            },
            'payment_received': {
                icon: 'fa-money-check-alt',
                title: 'Payment Received',
                type: 'success',
                duration: 8000
            },
            'user_added': {
                icon: 'fa-user-plus',
                title: 'New User Added',
                type: 'info',
                duration: 8000
            },
            'user_updated': {
                icon: 'fa-user-edit',
                title: 'User Updated',
                type: 'info',
                duration: 8000
            },
            'user_deleted': {
                icon: 'fa-user-minus',
                title: 'User Deleted',
                type: 'warning',
                duration: 8000
            },
            'user_status_changed': {
                icon: 'fa-user-cog',
                title: 'User Status Changed',
                type: 'info',
                duration: 8000
            },
            'product_added': {
                icon: 'fa-box',
                title: 'New Product Added',
                type: 'info',
                duration: 8000
            },
            'product_updated': {
                icon: 'fa-edit',
                title: 'Product Updated',
                type: 'info',
                duration: 8000
            },
            'product_deleted': {
                icon: 'fa-trash',
                title: 'Product Deleted',
                type: 'warning',
                duration: 8000
            },
            'inventory_updated': {
                icon: 'fa-warehouse',
                title: 'Inventory Updated',
                type: 'info',
                duration: 8000
            },
            'delivery_assigned': {
                icon: 'fa-truck',
                title: 'Delivery Assigned',
                type: 'info',
                duration: 8000
            },
            'delivery_status_changed': {
                icon: 'fa-shipping-fast',
                title: 'Delivery Status Updated',
                type: 'info',
                duration: 8000
            },
            'delivery_completed': {
                icon: 'fa-check-double',
                title: 'Delivery Completed',
                type: 'success',
                duration: 8000
            }
        };
        
        return configs[activityType] || {
            icon: 'fa-bell',
            title: 'New Activity',
            type: 'info',
            duration: 8000
        };
    }
    
    /**
     * Show notification for any activity
     */
    function showActivityNotification(notification) {
        if (typeof AdminNotifications === 'undefined') {
            console.warn('AdminNotifications not available');
            return;
        }
        
        const activityType = notification.activity_type || 'order_created';
        const config = getActivityConfig(activityType);
        const timeAgo = formatDateTime(notification.created_at);
        const message = notification.message || 'New activity';
        
        const details = {};
        if (notification.order_id) {
            details['Order ID'] = `ORD-${notification.order_id.toString().padStart(4, '0')}`;
        }
        if (notification.customer_name) {
            details['Customer'] = notification.customer_name;
        }
        if (notification.order_date) {
            details['Order Date'] = notification.order_date;
        }
        details['Time'] = timeAgo;
        
        AdminNotifications[config.type](message, {
            title: config.title,
            duration: config.duration,
            showProgress: true,
            details: details
        });
    }
    
    /**
     * Check for new notifications
     */
    async function checkForNotifications() {
        try {
            if (rbacDisabled) return;
            const allowed = isRoleAllowed();
            if (allowed === null) return;
            if (!allowed) {
                // Delivery Driver should not poll admin notifications
                rbacDisabled = true;
                stopNotificationPolling();
                hideNotificationsUiIfPresent();
                return;
            }
            const response = await fetch('../api/get_admin_notifications.php?limit=5', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.notifications && data.notifications.length > 0) {
                // Get current notification IDs
                const currentNotificationIds = new Set(data.notifications.map(n => n.id));
                
                // On initial load, just store the IDs
                if (isInitialLoad) {
                    lastNotificationIds = currentNotificationIds;
                    isInitialLoad = false;
                    return;
                }
                
                // Find new notifications
                const newNotifications = data.notifications.filter(n => !lastNotificationIds.has(n.id));
                
                // Show notifications for all activities
                newNotifications.forEach(notification => {
                    showActivityNotification(notification);
                });
                
                // Update last known IDs
                lastNotificationIds = currentNotificationIds;
            }
        } catch (error) {
            console.error('[Admin Order Notifications] Error checking notifications:', error);
        }
    }
    
    /**
     * Start polling for notifications
     */
    function startNotificationPolling() {
        if (rbacDisabled) return;
        const allowed = isRoleAllowed();
        if (allowed === null) {
            setTimeout(startNotificationPolling, 200);
            return;
        }
        if (!allowed) {
            rbacDisabled = true;
            hideNotificationsUiIfPresent();
            stopNotificationPolling();
            return;
        }

        // Check immediately
        checkForNotifications();
        
        // Then check every 5 seconds
        notificationPollInterval = setInterval(checkForNotifications, 5000);
    }
    
    /**
     * Stop polling for notifications
     */
    function stopNotificationPolling() {
        if (notificationPollInterval) {
            clearInterval(notificationPollInterval);
            notificationPollInterval = null;
        }
    }
    
    /**
     * Initialize notification system
     */
    function init() {
        // Wait for AdminNotifications to be available
        const checkAdminNotifications = (attempts = 0) => {
            if (typeof AdminNotifications !== 'undefined') {
                startNotificationPolling();
            } else if (attempts < 20) {
                setTimeout(() => checkAdminNotifications(attempts + 1), 500);
            } else {
                console.warn('[Admin Order Notifications] AdminNotifications not found after 10 seconds');
            }
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(checkAdminNotifications, 1000);
            });
        } else {
            setTimeout(checkAdminNotifications, 1000);
        }
        
        // Stop polling when page is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopNotificationPolling();
            } else {
                startNotificationPolling();
            }
        });
        
        // Stop polling when page is unloaded
        window.addEventListener('beforeunload', stopNotificationPolling);
    }
    
    // Initialize
    init();
    
    // Export for manual control
    window.AdminOrderNotifications = {
        check: checkForNotifications,
        start: startNotificationPolling,
        stop: stopNotificationPolling
    };
})();
