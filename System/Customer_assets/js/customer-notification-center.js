/**
 * Customer Notification Center
 * Manages the notification mailbox/modal for viewing all notifications
 */

(function() {
    'use strict';
    
    let unreadCount = 0;
    let allNotifications = [];
    
    /**
     * Format date/time for display
     */
    function formatDateTime(dateString) {
        if (!dateString) return 'Unknown time';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        const diffWeeks = Math.floor(diffMs / 604800000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }
    
    /**
     * Format full date/time for detailed view
     */
    function formatFullDateTime(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    /**
     * Get activity type configuration (icon, title)
     */
    function getActivityConfig(activityType) {
        const configs = {
            'order_approved': { icon: 'fa-check-circle', title: 'Order Approved', color: 'text-success' },
            'order_rejected': { icon: 'fa-times-circle', title: 'Order Rejected', color: 'text-danger' },
            'order_status_changed': { icon: 'fa-exchange-alt', title: 'Order Status Updated', color: 'text-info' },
            'order_ready': { icon: 'fa-box-open', title: 'Order Ready', color: 'text-success' },
            'order_processing': { icon: 'fa-cog', title: 'Order Processing', color: 'text-info' },
            'payment_received': { icon: 'fa-money-check-alt', title: 'Payment Received', color: 'text-success' },
            'payment_confirmed': { icon: 'fa-check-double', title: 'Payment Confirmed', color: 'text-success' },
            'delivery_assigned': { icon: 'fa-truck', title: 'Driver Assigned', color: 'text-info' },
            'delivery_status_changed': { icon: 'fa-shipping-fast', title: 'Delivery Status Updated', color: 'text-info' },
            'delivery_completed': { icon: 'fa-check-double', title: 'Delivery Completed', color: 'text-success' }
        };
        
        return configs[activityType] || { icon: 'fa-bell', title: 'New Update', color: 'text-primary' };
    }
    
    /**
     * Update notification badge
     */
    function updateBadge() {
        const badge = document.getElementById('customerNotificationBadge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }
    
    /**
     * Load all notifications
     */
    async function loadNotifications() {
        try {
            const response = await fetch('../api/get_customer_notifications.php?limit=100&unread_only=false', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                allNotifications = data.notifications || [];
                unreadCount = data.unread_count || 0;
                updateBadge();
                
                // If modal is open, refresh the list
                const modal = document.getElementById('customerNotificationsModal');
                if (modal && $(modal).hasClass('show')) {
                    displayNotifications();
                }
            }
        } catch (error) {
            console.error('[Customer Notification Center] Error loading notifications:', error);
        }
    }
    
    /**
     * Display notifications in the modal
     */
    function displayNotifications() {
        const loadingEl = document.getElementById('customerNotificationsLoading');
        const listEl = document.getElementById('customerNotificationsList');
        const emptyEl = document.getElementById('customerNotificationsEmpty');
        const markAllReadBtn = document.getElementById('markAllCustomerReadBtn');
        
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (!allNotifications || allNotifications.length === 0) {
            if (listEl) listEl.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'block';
            if (markAllReadBtn) markAllReadBtn.style.display = 'none';
            return;
        }
        
        if (emptyEl) emptyEl.style.display = 'none';
        if (listEl) listEl.style.display = 'block';
        
        // Show mark all as read button if there are unread notifications
        const hasUnread = allNotifications.some(n => !n.is_read);
        if (markAllReadBtn) {
            markAllReadBtn.style.display = hasUnread ? 'inline-block' : 'none';
        }
        
        // Group notifications by date
        const grouped = {};
        allNotifications.forEach(notification => {
            const date = new Date(notification.created_at);
            const dateKey = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(notification);
        });
        
        // Build HTML
        let html = '';
        // Sort dates by converting to Date objects for proper sorting
        const sortedDates = Object.keys(grouped).sort((a, b) => {
            const dateA = new Date(a);
            const dateB = new Date(b);
            return dateB - dateA; // Most recent first
        });
        
        sortedDates.forEach(dateKey => {
            html += `<div class="notification-date-group mb-4">
                <h6 class="text-muted mb-3" style="font-weight: 600; text-transform: uppercase; font-size: 0.85rem;">
                    <i class="fas fa-calendar-alt mr-2"></i>${dateKey}
                </h6>`;
            
            grouped[dateKey].forEach(notification => {
                const isUnread = !notification.is_read;
                const activityType = notification.activity_type || 'order_approved';
                const timeAgo = formatDateTime(notification.created_at);
                const fullDateTime = formatFullDateTime(notification.created_at);
                
                // Get icon and title based on activity type
                const activityConfig = getActivityConfig(activityType);
                const iconClass = activityConfig.icon;
                const title = activityConfig.title;
                const iconColor = activityConfig.color;
                
                // Build display message
                let displayMessage = notification.message || 'New update';
                let orderInfo = '';
                if (notification.order_id) {
                    const orderNumber = `ORD-${notification.order_id.toString().padStart(4, '0')}`;
                    orderInfo = `<p class="mb-1 text-muted" style="font-size: 0.9rem;">Order #${orderNumber}</p>`;
                }
                
                html += `
                    <div class="notification-item ${isUnread ? 'unread' : ''}" data-notification-id="${notification.id}" data-order-id="${notification.order_id || ''}" style="cursor: pointer;">
                        <div class="d-flex align-items-start">
                            <div class="notification-icon mr-3">
                                <i class="fas ${iconClass} ${isUnread ? iconColor : 'text-muted'}"></i>
                            </div>
                            <div class="flex-grow-1">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h6 class="mb-1 ${isUnread ? 'font-weight-bold' : ''}">
                                            ${isUnread ? '<span class="badge badge-primary mr-2">New</span>' : ''}
                                            ${title}
                                        </h6>
                                        ${orderInfo}
                                        <p class="mb-1 text-muted" style="font-size: 0.85rem;">
                                            ${displayMessage}
                                        </p>
                                        <small class="text-muted">
                                            <i class="fas fa-clock mr-1"></i>${timeAgo}
                                            <span class="mx-2">•</span>
                                            ${fullDateTime}
                                        </small>
                                    </div>
                                    <button class="btn btn-sm btn-link text-muted mark-read-btn" 
                                            data-notification-id="${notification.id}" 
                                            title="Mark as read"
                                            style="display: ${isUnread ? 'block' : 'none'};">
                                        <i class="fas fa-check"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
        });
        
        if (listEl) {
            listEl.innerHTML = html;
        }
        
        // Re-attach event handlers
        attachEventHandlers();
    }
    
    /**
     * Attach event handlers for mark as read buttons
     */
    function attachEventHandlers() {
        // Mark individual notification as read
        document.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const notificationId = this.getAttribute('data-notification-id');
                if (!notificationId) return;
                
                try {
                    const response = await fetch('../api/mark_customer_notification_read.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            notification_id: parseInt(notificationId)
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Reload notifications
                        await loadNotifications();
                    }
                } catch (error) {
                    console.error('[Customer Notification Center] Error marking notification as read:', error);
                }
            });
        });

        // Click notification to open related order (if available)
        document.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', async function(e) {
                // If the click came from the mark-read button, ignore here
                if (e.target.closest('.mark-read-btn')) return;

                const notificationId = this.getAttribute('data-notification-id');
                const orderId = this.getAttribute('data-order-id');

                // If there's no order associated, do nothing special
                if (!orderId) return;

                try {
                    // Mark notification as read (if not already)
                    if (notificationId) {
                        await fetch('../api/mark_customer_notification_read.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ notification_id: parseInt(notificationId) })
                        });
                    }
                } catch (err) {
                    console.error('[Customer Notification Center] Error marking notification read before navigation:', err);
                }

                // Navigate to the order summary for that order
                // Use relative path to Customer OrderSummary page
                const targetUrl = `../Customer/OrderSummary.html?order_id=${encodeURIComponent(orderId)}`;
                window.location.href = targetUrl;
            });
        });
    }
    
    /**
     * Mark all notifications as read
     */
    async function markAllAsRead() {
        try {
            const response = await fetch('../api/mark_all_customer_notifications_read.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Reload notifications
                await loadNotifications();
            }
        } catch (error) {
            console.error('[Customer Notification Center] Error marking all as read:', error);
        }
    }
    
    /**
     * Initialize notification center
     */
    function init() {
        // Check if user is logged in
        const userId = sessionStorage.getItem('user_id');
        if (!userId) {
            return; // Don't initialize if not logged in
        }
        
        // Load notifications on page load
        loadNotifications();
        
        // Set up modal event handlers
        const modal = document.getElementById('customerNotificationsModal');
        if (modal) {
            // Load notifications when modal is opened
            $(modal).on('show.bs.modal', function() {
                loadNotifications();
            });
            
            // Display notifications when modal is shown
            $(modal).on('shown.bs.modal', function() {
                displayNotifications();
            });
        }
        
        // Mark all as read button
        const markAllBtn = document.getElementById('markAllCustomerReadBtn');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', markAllAsRead);
        }
        
        // Notification bell click handler
        const notificationBtn = document.getElementById('customerNotificationsBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (modal) {
                    $(modal).modal('show');
                }
            });
        }
        
        // Poll for new notifications every 10 seconds
        setInterval(loadNotifications, 10000);
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Export for manual control
    window.CustomerNotificationCenter = {
        load: loadNotifications,
        display: displayNotifications,
        markAllAsRead: markAllAsRead
    };
})();
