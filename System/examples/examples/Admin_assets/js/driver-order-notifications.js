/**
 * Driver Order Notifications (Toast)
 * Polls driver notifications and shows toast for new ones.
 */

(function() {
    'use strict';

    let pollInterval = null;
    let lastIds = new Set();
    let initialized = false;

    function getRole() {
        return (sessionStorage.getItem('user_role') || '').trim();
    }

    function isDriver() {
        return getRole() === 'Delivery Driver';
    }

    function getToastConfig(activityType) {
        const cfg = {
            'delivery_assigned': { type: 'info', title: 'New Delivery Assigned', icon: 'fa-truck', duration: 9000 },
            'delivery_status_changed': { type: 'info', title: 'Delivery Updated', icon: 'fa-shipping-fast', duration: 7000 },
            'delivery_completed': { type: 'success', title: 'Delivery Completed', icon: 'fa-check-double', duration: 7000 }
        };
        return cfg[activityType] || { type: 'info', title: 'Notification', icon: 'fa-bell', duration: 7000 };
    }

    async function checkForNotifications() {
        if (!isDriver()) return;
        try {
            const res = await fetch('../api/get_driver_notifications.php?limit=5&unread_only=false', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-cache'
            });
            if (!res.ok) return;
            const data = await res.json();
            if (!data.success || !Array.isArray(data.notifications)) return;

            const currentIds = new Set(data.notifications.map(n => n.id));
            if (lastIds.size === 0) {
                lastIds = currentIds;
                return;
            }

            const newOnes = data.notifications.filter(n => !lastIds.has(n.id));
            lastIds = currentIds;

            if (typeof window.AdminNotifications === 'undefined') return;
            newOnes.forEach(n => {
                const cfg = getToastConfig(n.activity_type || 'delivery_assigned');
                const msg = n.message || 'New notification';
                const details = {};
                if (n.delivery_id) details['Delivery'] = `DEL-${String(n.delivery_id).padStart(6, '0')}`;
                if (n.order_id) details['Order'] = `ORD-${String(n.order_id).padStart(4, '0')}`;
                AdminNotifications[cfg.type](msg, {
                    title: cfg.title,
                    duration: cfg.duration,
                    showProgress: true,
                    details
                });
            });
        } catch (_) {
            // ignore
        }
    }

    function start() {
        if (pollInterval) return;
        checkForNotifications();
        pollInterval = setInterval(checkForNotifications, 7000);
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

        // Wait for AdminNotifications utility (toasts)
        const wait = (attempts = 0) => {
            if (typeof AdminNotifications !== 'undefined') {
                start();
            } else if (attempts < 20) {
                setTimeout(() => wait(attempts + 1), 300);
            }
        };
        wait();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

