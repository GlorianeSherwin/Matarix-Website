/**
 * Orders Calendar View - View orders by preferred date (separate for Delivery and Pick Up)
 */

(function() {
    let ordersByPreferredDate = {};
    let currentMonth = new Date();
    let currentCalendarMode = 'delivery';

    function buildOrdersByPreferredDate(orders, mode) {
        const map = {};
        const isPickup = mode === 'pickup';
        orders.forEach(o => {
            const dm = (o.delivery_method || '').trim();
            const match = isPickup ? (dm === 'Pick Up') : (dm !== 'Pick Up');
            if (!match) return;
            const d = o.availability_date;
            const dateKey = (d && String(d).trim() !== '') ? new Date(d).toISOString().slice(0, 10) : null;
            if (dateKey) {
                if (!map[dateKey]) map[dateKey] = [];
                map[dateKey].push(o);
            }
        });
        return map;
    }

    function getOrderCountForDate(dateStr) {
        return (ordersByPreferredDate[dateStr] || []).length;
    }

    function renderCalendar(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        let html = `
            <div class="calendar-scheduler">
                <div class="calendar-header">
                    <h5><i class="fas fa-calendar-alt mr-2"></i>Select a date to jump to orders</h5>
                </div>
                <div class="calendar-body">
                    <div class="calendar-month-view">
                        <div class="calendar-nav">
                            <button type="button" class="btn btn-sm btn-outline-secondary calendar-prev-month">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <h6 class="calendar-month-title">${monthNames[month]} ${year}</h6>
                            <button type="button" class="btn btn-sm btn-outline-secondary calendar-next-month">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                        <div class="calendar-grid">
                            <div class="calendar-weekdays">
                                ${dayNames.map(d => `<div class="calendar-weekday">${d}</div>`).join('')}
                            </div>
                            <div class="calendar-days">
        `;

        for (let i = 0; i < startingDayOfWeek; i++) {
            html += '<div class="calendar-day empty"></div>';
        }

        const today = new Date();
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            const hasOrders = getOrderCountForDate(dateStr) > 0;
            const isToday = dateStr === todayStr;

            let classes = 'calendar-day';
            if (isToday) classes += ' today';
            if (hasOrders) classes += ' has-orders';

            html += `<div class="${classes}" data-date="${dateStr}" role="button" tabindex="0">${day}</div>`;
        }

        html += `
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        container.querySelector('.calendar-prev-month').addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() - 1);
            renderCalendar(containerId);
        });
        container.querySelector('.calendar-next-month').addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() + 1);
            renderCalendar(containerId);
        });

        container.querySelectorAll('.calendar-day:not(.empty)').forEach(cell => {
            cell.addEventListener('click', () => {
                const dateStr = cell.getAttribute('data-date');
                jumpToDate(dateStr, currentCalendarMode);
            });
            cell.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const dateStr = cell.getAttribute('data-date');
                    jumpToDate(dateStr, currentCalendarMode);
                }
            });
        });
    }

    async function jumpToDate(dateStr, orderType) {
        const modalId = orderType === 'pickup' ? 'pickupOrdersCalendarModal' : 'deliveryOrdersCalendarModal';
        const modal = document.getElementById(modalId);
        if (modal && typeof $ !== 'undefined' && $.fn.modal) {
            $(modal).modal('hide');
        }

        const sortDelivery = document.getElementById('sortOrdersDelivery');
        const sortPickup = document.getElementById('sortOrdersPickup');
        if (sortDelivery) sortDelivery.value = 'preferred_date';
        if (sortPickup) sortPickup.value = 'preferred_date';

        if (orderType === 'pickup') {
            document.getElementById('pickup-orders-tab')?.click();
        } else {
            document.getElementById('delivery-orders-tab')?.click();
        }

        if (typeof window.loadOrders === 'function') {
            await window.loadOrders();
        }

        setTimeout(() => {
            if (typeof window.scrollToPreferredDate === 'function') {
                window.scrollToPreferredDate(dateStr, orderType);
            }
        }, 150);
    }

    async function openOrdersCalendar(mode) {
        currentCalendarMode = mode;
        const modalId = mode === 'pickup' ? 'pickupOrdersCalendarModal' : 'deliveryOrdersCalendarModal';
        const containerId = mode === 'pickup' ? 'pickupOrdersCalendarContainer' : 'deliveryOrdersCalendarContainer';
        const modal = document.getElementById(modalId);
        if (!modal) return;

        try {
            const response = await fetch('../api/get_orders.php', { method: 'GET', credentials: 'include' });
            const data = await response.json();
            if (!data.success || !data.orders) {
                ordersByPreferredDate = {};
            } else {
                ordersByPreferredDate = buildOrdersByPreferredDate(data.orders, mode);
            }
        } catch (e) {
            ordersByPreferredDate = {};
        }

        currentMonth = new Date();
        renderCalendar(containerId);

        if (typeof $ !== 'undefined' && $.fn.modal) {
            $(modal).modal('show');
        }
    }

    function init() {
        const btnDelivery = document.getElementById('calendarViewBtnDelivery');
        const btnPickup = document.getElementById('calendarViewBtnPickup');
        if (btnDelivery) btnDelivery.addEventListener('click', () => openOrdersCalendar('delivery'));
        if (btnPickup) btnPickup.addEventListener('click', () => openOrdersCalendar('pickup'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
