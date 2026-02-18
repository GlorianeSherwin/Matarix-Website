/**
 * Driver Notification Center
 * Uses the existing notifications bell + modal, but calls driver APIs.
 */

(function() {
    'use strict';

    let unreadCount = 0;
    let allNotifications = [];
    let pollInterval = null;
    let initialized = false;

    function getRole() {
        return (sessionStorage.getItem('user_role') || '').trim();
    }

    function isDriver() {
        const role = getRole();
        return role === 'Delivery Driver';
    }

    function updateBadge() {
        const badge = document.getElementById('notificationBadge');
        if (!badge) return;
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

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

    function getActivityConfig(activityType) {
        const configs = {
            'delivery_assigned': { icon: 'fa-truck', title: 'New Delivery Assigned' },
            'delivery_status_changed': { icon: 'fa-shipping-fast', title: 'Delivery Status Updated' },
            'delivery_completed': { icon: 'fa-check-double', title: 'Delivery Completed' }
        };
        return configs[activityType] || { icon: 'fa-bell', title: 'Notification' };
    }

    async function loadNotifications() {
        if (!isDriver()) return;
        try {
            const response = await fetch('../api/get_driver_notifications.php?limit=100&unread_only=false', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-cache'
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Failed to load notifications');

            allNotifications = data.notifications || [];
            unreadCount = data.unread_count || 0;
            updateBadge();

            const modal = document.getElementById('notificationsModal');
            if (modal && $(modal).hasClass('show')) {
                displayNotifications();
            }
        } catch (e) {
            console.error('[Driver Notification Center] Error loading notifications:', e);
        }
    }

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

        const hasUnread = allNotifications.some(n => !n.is_read);
        if (markAllReadBtn) markAllReadBtn.style.display = hasUnread ? 'inline-block' : 'none';

        let html = '';
        allNotifications.forEach(n => {
            const isUnread = !n.is_read;
            const cfg = getActivityConfig(n.activity_type || 'delivery_assigned');
            const timeAgo = formatDateTime(n.created_at);

            const orderInfo = n.order_id ? `Order #ORD-${String(n.order_id).padStart(4, '0')}` : '';
            const deliveryInfo = n.delivery_id ? `Delivery #DEL-${String(n.delivery_id).padStart(6, '0')}` : '';
            const meta = [deliveryInfo, orderInfo].filter(Boolean).join(' • ');

            html += `
                <div class="notification-item ${isUnread ? 'unread' : ''}" data-notification-id="${n.id}">
                    <div class="d-flex align-items-start">
                        <div class="notification-icon mr-3">
                            <i class="fas ${cfg.icon} ${isUnread ? 'text-primary' : 'text-muted'}"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <h6 class="mb-1 ${isUnread ? 'font-weight-bold' : ''}">
                                        ${isUnread ? '<span class="badge badge-primary mr-2">New</span>' : ''}
                                        ${cfg.title}
                                    </h6>
                                    ${meta ? `<p class="mb-1 text-muted" style="font-size: 0.9rem;">${meta}</p>` : ''}
                                    <p class="mb-1 text-muted" style="font-size: 0.85rem;">${n.message || 'New notification'}</p>
                                    <small class="text-muted"><i class="fas fa-clock mr-1"></i>${timeAgo}</small>
                                </div>
                                <button class="btn btn-sm btn-link text-muted mark-read-btn"
                                        data-notification-id="${n.id}"
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

        if (listEl) listEl.innerHTML = html;
        attachHandlers();
    }

    function attachHandlers() {
        document.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(btn.getAttribute('data-notification-id'), 10);
                await markAsRead(id);
            });
        });

        document.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                if (e.target.closest('.mark-read-btn')) return;
                const id = parseInt(item.getAttribute('data-notification-id'), 10);
                const notif = allNotifications.find(x => x.id === id);
                if (!notif) return;
                if (!notif.is_read) await markAsRead(id);
                // Stay on Deliveries page; no redirect needed for driver
            });
        });
    }

    async function markAsRead(notificationId) {
        if (!isDriver()) return;
        try {
            const response = await fetch('../api/mark_driver_notification_read.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ notification_id: notificationId })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Failed to mark as read');

            const n = allNotifications.find(x => x.id === notificationId);
            if (n) n.is_read = true;
            unreadCount = Math.max(0, unreadCount - 1);
            updateBadge();
            displayNotifications();
        } catch (e) {
            console.error('[Driver Notification Center] Error marking as read:', e);
        }
    }

    async function markAllAsRead() {
        if (!isDriver()) return;
        try {
            const response = await fetch('../api/mark_all_driver_notifications_read.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Failed to mark all as read');

            allNotifications.forEach(n => { n.is_read = true; });
            unreadCount = 0;
            updateBadge();
            displayNotifications();
        } catch (e) {
            console.error('[Driver Notification Center] Error marking all as read:', e);
        }
    }

    function init() {
        if (initialized) return;
        const role = getRole();
        if (!role) {
            setTimeout(init, 100);
            return;
        }
        if (role !== 'Delivery Driver') return;
        initialized = true;

        const btn = document.getElementById('notifications-btn');
        if (btn) {
            btn.style.display = ''; // ensure visible
            btn.addEventListener('click', () => {
                const modal = document.getElementById('notificationsModal');
                if (modal) {
                    $('#notificationsLoading').show();
                    $('#notificationsList').hide();
                    $('#notificationsEmpty').hide();
                    $(modal).modal('show');
                    loadNotifications().then(() => displayNotifications());
                }
            });
        }

        const modal = document.getElementById('notificationsModal');
        if (modal) {
            $(modal).on('show.bs.modal', () => {
                loadNotifications();
            });
            $(modal).on('shown.bs.modal', () => {
                displayNotifications();
            });
        }

        const markAllReadBtn = document.getElementById('markAllReadBtn');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', markAllAsRead);
        }

        loadNotifications();
        pollInterval = setInterval(loadNotifications, 7000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.DriverNotificationCenter = { load: loadNotifications };
})();

