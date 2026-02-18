/**
 * Admin Notification Center
 * Manages the notification mailbox/modal for viewing all notifications
 */

(function() {
    'use strict';
    
    let unreadCount = 0;
    let allNotifications = [];
    let pollInterval = null;
    let rbacDisabled = false;
    let initialized = false;

    function isRoleAllowed() {
        const role = (sessionStorage.getItem('user_role') || '').trim();
        if (!role) return null; // unknown yet
        return role === 'Admin' || role === 'Store Employee';
    }

    function disableNotificationsUi() {
        rbacDisabled = true;
        unreadCount = 0;
        allNotifications = [];

        // NOTE: Do NOT hide bell/badge here.
        // Delivery Drivers use a different notification system on this page.

        // Stop polling
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }
    
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
        const diffDays = Math.floor(diffMs / 8640000);
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
            'order_created': { icon: 'fa-shopping-cart', title: 'New Order' },
            'order_status_changed': { icon: 'fa-exchange-alt', title: 'Order Status Updated' },
            'order_approved': { icon: 'fa-check-circle', title: 'Order Approved' },
            'order_rejected': { icon: 'fa-times-circle', title: 'Order Rejected' },
            'payment_updated': { icon: 'fa-money-bill-wave', title: 'Payment Updated' },
            'payment_received': { icon: 'fa-money-check-alt', title: 'Payment Received' },
            'user_added': { icon: 'fa-user-plus', title: 'New User Added' },
            'user_updated': { icon: 'fa-user-edit', title: 'User Updated' },
            'user_deleted': { icon: 'fa-user-minus', title: 'User Deleted' },
            'user_status_changed': { icon: 'fa-user-cog', title: 'User Status Changed' },
            'product_added': { icon: 'fa-box', title: 'New Product Added' },
            'product_updated': { icon: 'fa-edit', title: 'Product Updated' },
            'product_deleted': { icon: 'fa-trash', title: 'Product Deleted' },
            'inventory_updated': { icon: 'fa-warehouse', title: 'Inventory Updated' },
            'delivery_assigned': { icon: 'fa-truck', title: 'Delivery Assigned' },
            'delivery_status_changed': { icon: 'fa-shipping-fast', title: 'Delivery Status Updated' },
            'delivery_completed': { icon: 'fa-check-double', title: 'Delivery Completed' }
        };
        
        return configs[activityType] || { icon: 'fa-bell', title: 'New Activity' };
    }
    
    /**
     * Update notification badge
     */
    function updateBadge() {
        const badge = document.getElementById('notificationBadge');
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
            if (rbacDisabled) return;
            const allowed = isRoleAllowed();
            if (allowed === null) return;
            if (!allowed) {
                // Delivery Driver should not call admin notification APIs
                disableNotificationsUi();
                return;
            }
            const response = await fetch('../api/get_admin_notifications.php?limit=100&unread_only=false', {
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
                const modal = document.getElementById('notificationsModal');
                if (modal && $(modal).hasClass('show')) {
                    displayNotifications();
                }
            }
        } catch (error) {
            console.error('[Notification Center] Error loading notifications:', error);
        }
    }
    
    /**
     * Display notifications in the modal
     */
    function displayNotifications() {
        const loadingEl = document.getElementById('notificationsLoading');
        const listEl = document.getElementById('notificationsList');
        const emptyEl = document.getElementById('notificationsEmpty');
        const markAllReadBtn = document.getElementById('markAllReadBtn');
        
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
                const activityType = notification.activity_type || 'order_created';
                const timeAgo = formatDateTime(notification.created_at);
                const fullDateTime = formatFullDateTime(notification.created_at);
                
                // Get icon and title based on activity type
                const activityConfig = getActivityConfig(activityType);
                const iconClass = activityConfig.icon;
                const title = activityConfig.title;
                
                // Build display message
                let displayMessage = notification.message || 'New activity';
                let orderInfo = '';
                if (notification.order_id) {
                    const orderNumber = `ORD-${notification.order_id.toString().padStart(4, '0')}`;
                    orderInfo = `<p class="mb-1 text-muted" style="font-size: 0.9rem;">Order #${orderNumber}</p>`;
                }
                if (notification.customer_name && activityType.includes('order')) {
                    displayMessage = `New order from ${notification.customer_name}`;
                }
                
                html += `
                    <div class="notification-item ${isUnread ? 'unread' : ''}" data-notification-id="${notification.id}" data-order-id="${notification.order_id || ''}" style="cursor: pointer;">
                        <div class="d-flex align-items-start">
                            <div class="notification-icon mr-3">
                                <i class="fas ${iconClass} ${isUnread ? 'text-primary' : 'text-muted'}"></i>
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
        
        // Attach click handlers
        attachNotificationHandlers();
    }
    
    /**
     * Attach event handlers to notification items
     */
    function attachNotificationHandlers() {
        // Mark as read buttons
        document.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const notificationId = parseInt(btn.getAttribute('data-notification-id'));
                await markAsRead(notificationId);
            });
        });
        
        // Click on notification to view order
        document.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.mark-read-btn')) return;
                
                const notificationId = parseInt(item.getAttribute('data-notification-id'));
                const notification = allNotifications.find(n => n.id === notificationId);
                
                if (notification) {
                    // Mark as read if unread
                    if (!notification.is_read) {
                        markAsRead(notificationId);
                    }
                    
                    // Navigate to order (if on OrdersAdmin page)
                    const orderId = notification.order_id;
                    window.location.href = `ViewOrderAccept.html?order_id=${orderId}`;
                }
            });
        });
    }
    
    /**
     * Mark notification as read
     */
    async function markAsRead(notificationId) {
        try {
            if (rbacDisabled || !isRoleAllowed()) return;
            const response = await fetch('../api/mark_notification_read.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    notification_id: notificationId
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Update local state
                const notification = allNotifications.find(n => n.id === notificationId);
                if (notification) {
                    notification.is_read = true;
                }
                unreadCount = Math.max(0, unreadCount - 1);
                updateBadge();
                
                // Refresh display
                displayNotifications();
            }
        } catch (error) {
            console.error('[Notification Center] Error marking notification as read:', error);
        }
    }
    
    /**
     * Mark all notifications as read
     */
    async function markAllAsRead() {
        const unreadNotifications = allNotifications.filter(n => !n.is_read);
        
        if (unreadNotifications.length === 0) return;
        
        try {
            if (rbacDisabled || !isRoleAllowed()) return;
            const response = await fetch('../api/mark_all_notifications_read.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Update local state
                allNotifications.forEach(n => {
                    n.is_read = true;
                });
                unreadCount = 0;
                updateBadge();
                
                // Refresh display
                displayNotifications();
            }
        } catch (error) {
            console.error('[Notification Center] Error marking all as read:', error);
            // Fallback: mark each individually
            await Promise.all(unreadNotifications.map(n => markAsRead(n.id)));
            await loadNotifications();
        }
    }
    
    /**
     * Initialize notification center
     */
    function init() {
        if (initialized) return;

        // Wait until admin auth check sets sessionStorage user_role
        const allowed = isRoleAllowed();
        if (allowed === null) {
            setTimeout(init, 100);
            return;
        }

        // Disable for roles that are not allowed to view admin notifications
        if (!allowed) {
            disableNotificationsUi();
            initialized = true;
            return;
        }
        initialized = true;

        // Setup notification button click
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
                const modal = document.getElementById('notificationsModal');
                if (modal) {
                    $(modal).modal('show');
                    loadNotifications();
                }
            });
        }
        
        // Setup modal events
        const modal = document.getElementById('notificationsModal');
        if (modal) {
            $(modal).on('show.bs.modal', () => {
                loadNotifications();
            });
            
            $(modal).on('shown.bs.modal', () => {
                displayNotifications();
            });
        }
        
        // Setup mark all as read button
        const markAllReadBtn = document.getElementById('markAllReadBtn');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', markAllAsRead);
        }
        
        // Load notifications on page load
        loadNotifications();
        
        // Poll for new notifications every 10 seconds
        pollInterval = setInterval(loadNotifications, 10000);
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Export for global access
    window.AdminNotificationCenter = {
        load: loadNotifications,
        refresh: () => {
            loadNotifications().then(() => displayNotifications());
        }
    };
})();
