/**
 * Customer Notifications System
 * Polls for new notifications and displays them
 */

(function() {
    'use strict';
    
    let notificationPollInterval = null;
    let lastNotificationIds = new Set();
    let isInitialLoad = true;
    
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
            'order_approved': {
                icon: 'fa-check-circle',
                title: 'Order Approved',
                type: 'success',
                duration: 10000
            },
            'order_rejected': {
                icon: 'fa-times-circle',
                title: 'Order Rejected',
                type: 'warning',
                duration: 10000
            },
            'order_status_changed': {
                icon: 'fa-exchange-alt',
                title: 'Order Status Updated',
                type: 'info',
                duration: 8000
            },
            'order_ready': {
                icon: 'fa-box-open',
                title: 'Order Ready',
                type: 'success',
                duration: 10000
            },
            'order_processing': {
                icon: 'fa-cog',
                title: 'Order Processing',
                type: 'info',
                duration: 8000
            },
            'payment_received': {
                icon: 'fa-money-check-alt',
                title: 'Payment Received',
                type: 'success',
                duration: 8000
            },
            'payment_confirmed': {
                icon: 'fa-check-double',
                title: 'Payment Confirmed',
                type: 'success',
                duration: 10000
            },
            'delivery_assigned': {
                icon: 'fa-truck',
                title: 'Driver Assigned',
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
                duration: 10000
            }
        };
        
        return configs[activityType] || {
            icon: 'fa-bell',
            title: 'New Update',
            type: 'info',
            duration: 8000
        };
    }
    
    /**
     * Show simple notification (using browser notification or console)
     */
    function showSimpleNotification(notification) {
        const config = getActivityConfig(notification.activity_type || 'order_approved');
        const timeAgo = formatDateTime(notification.created_at);
        
        // Try to use browser notifications if available
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(config.title, {
                body: notification.message,
                icon: '/Customer_assets/images/LOGO.png',
                tag: `notification-${notification.id}`
            });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
            // Request permission
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(config.title, {
                        body: notification.message,
                        icon: '/Customer_assets/images/LOGO.png',
                        tag: `notification-${notification.id}`
                    });
                }
            });
        }
        
        // Also log to console for debugging
        console.log(`[Customer Notification] ${config.title}: ${notification.message} (${timeAgo})`);
    }
    
    /**
     * Check for new notifications
     */
    async function checkForNotifications() {
        try {
            const response = await fetch('../api/get_customer_notifications.php?limit=5', {
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
                    updateBadge(data.unread_count || 0);
                    return;
                }
                
                // Find new notifications
                const newNotifications = data.notifications.filter(n => !lastNotificationIds.has(n.id));
                
                // Show notifications for new activities
                newNotifications.forEach(notification => {
                    showSimpleNotification(notification);
                });
                
                // Update last known IDs
                lastNotificationIds = currentNotificationIds;
                updateBadge(data.unread_count || 0);
            } else {
                updateBadge(0);
            }
        } catch (error) {
            console.error('[Customer Notifications] Error checking notifications:', error);
        }
    }
    
    /**
     * Update notification badge
     */
    function updateBadge(count) {
        const badge = document.getElementById('customerNotificationBadge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }
    
    /**
     * Start polling for notifications
     */
    function startNotificationPolling() {
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
        // Check if user is logged in
        const userId = sessionStorage.getItem('user_id');
        if (!userId) {
            return; // Don't poll if not logged in
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(startNotificationPolling, 1000);
            });
        } else {
            setTimeout(startNotificationPolling, 1000);
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
    window.CustomerNotifications = {
        check: checkForNotifications,
        start: startNotificationPolling,
        stop: stopNotificationPolling,
        updateBadge: updateBadge
    };
    
    // Replace browser alert() globally to use custom notifications (if Notifications system is available)
    // This ensures alerts are replaced even if notifications.js loads after this file
    if (typeof window.alert !== 'undefined' && !window.alert._replaced) {
        const originalAlert = window.alert;
        window.alert = function(message) {
            if (typeof window.Notifications !== 'undefined') {
                // Determine type based on message content
                let type = 'info';
                const msg = String(message).toLowerCase();
                if (msg.includes('error') || msg.includes('failed') || msg.includes('invalid') || msg.includes('missing') || msg.includes('expired')) {
                    type = 'error';
                } else if (msg.includes('success') || msg.includes('confirmed') || msg.includes('received') || msg.includes('successfully')) {
                    type = 'success';
                } else if (msg.includes('warning') || msg.includes('please') || msg.includes('select') || msg.includes('empty')) {
                    type = 'warning';
                }
                window.Notifications.showToast(message, type, 5000);
            } else {
                // Fallback to original alert if Notifications not available yet
                originalAlert.call(window, message);
            }
        };
        window.alert._replaced = true;
    }
})();
