/**
 * Booking History Component
 * Displays customer's delivery booking history with cancel/reschedule options
 */

class BookingHistory {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            apiEndpoint: options.apiEndpoint || '../api/get_customer_orders.php',
            cancelEndpoint: options.cancelEndpoint || '../api/cancel_booking.php',
            rescheduleEndpoint: options.rescheduleEndpoint || '../api/reschedule_booking.php',
            ...options
        };
        this.bookings = [];
        this.init();
    }

    init() {
        if (!this.container) {
            console.error('Booking history container not found');
            return;
        }
        this.loadBookings();
    }

    /**
     * Load bookings from API
     */
    async loadBookings() {
        try {
            window.showLoading('Loading booking history...');
            
            const response = await fetch(this.options.apiEndpoint, {
                method: 'GET',
                credentials: 'include'
            });
            
            const data = await response.json();
            window.hideLoading();
            
            if (data.success && data.orders) {
                // Filter orders that have availability slots (bookings)
                this.bookings = data.orders
                    .filter(order => order.availability_slots && order.availability_slots.length > 0)
                    .map(order => ({
                        order_id: order.order_id,
                        order_number: order.order_number || `ORD-${String(order.order_id).padStart(4, '0')}`,
                        status: order.status,
                        slots: order.availability_slots || [],
                        created_at: order.created_at,
                        total_amount: order.total_amount
                    }));
                
                this.render();
            } else {
                this.renderEmpty('No bookings found.');
            }
        } catch (error) {
            console.error('Error loading bookings:', error);
            window.hideLoading();
            window.showToast('Failed to load booking history. Please try again.', 'error', 7000);
            this.renderEmpty('Failed to load bookings.');
        }
    }

    /**
     * Render booking history
     */
    render() {
        if (this.bookings.length === 0) {
            this.renderEmpty('You have no delivery bookings yet.');
            return;
        }

        let html = '<div class="booking-history-list">';
        
        this.bookings.forEach(booking => {
            const preferredSlot = booking.slots.find(slot => slot.is_preferred) || booking.slots[0];
            const statusClass = this.getStatusClass(booking.status);
            const statusIcon = this.getStatusIcon(booking.status);
            
            html += `
                <div class="booking-card" data-order-id="${booking.order_id}">
                    <div class="booking-header">
                        <div class="booking-order-info">
                            <h6 class="booking-order-number">${booking.order_number}</h6>
                            <span class="booking-status ${statusClass}">
                                <i class="fas ${statusIcon}"></i> ${this.formatStatus(booking.status)}
                            </span>
                        </div>
                        <div class="booking-amount">
                            <strong>₱${parseFloat(booking.total_amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                        </div>
                    </div>
                    <div class="booking-body">
                        <div class="booking-slot preferred-slot">
                            <i class="fas fa-star text-warning"></i>
                            <div class="slot-details">
                                <strong>Preferred Delivery:</strong>
                                <div class="slot-date-time">
                                    <i class="fas fa-calendar"></i> ${this.formatDate(preferredSlot.date)}
                                    <i class="fas fa-clock ml-3"></i> ${this.formatTime(preferredSlot.time)}
                                </div>
                            </div>
                        </div>
                        ${booking.slots.length > 1 ? `
                            <div class="booking-alternatives">
                                <small class="text-muted">Alternative options:</small>
                                ${booking.slots.filter(s => !s.is_preferred).map(slot => `
                                    <div class="booking-slot alternative-slot">
                                        <i class="fas fa-calendar-alt"></i>
                                        ${this.formatDate(slot.date)} at ${this.formatTime(slot.time)}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        <div class="booking-actions">
                            ${this.canCancel(booking.status) ? `
                                <button class="btn btn-sm btn-outline-danger cancel-booking-btn" data-order-id="${booking.order_id}">
                                    <i class="fas fa-times"></i> Cancel
                                </button>
                            ` : ''}
                            ${this.canReschedule(booking.status) ? `
                                <button class="btn btn-sm btn-outline-primary reschedule-booking-btn" data-order-id="${booking.order_id}">
                                    <i class="fas fa-calendar-alt"></i> Reschedule
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="booking-footer">
                        <small class="text-muted">
                            <i class="fas fa-clock"></i> Booked on ${this.formatDateTime(booking.created_at)}
                        </small>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        this.container.innerHTML = html;
        
        // Attach event listeners
        this.attachEventListeners();
    }

    /**
     * Render empty state
     */
    renderEmpty(message) {
        this.container.innerHTML = `
            <div class="booking-history-empty">
                <i class="fas fa-calendar-times fa-3x text-muted mb-3"></i>
                <p class="text-muted">${message}</p>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Cancel booking buttons
        this.container.querySelectorAll('.cancel-booking-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.currentTarget.getAttribute('data-order-id');
                this.handleCancelBooking(orderId);
            });
        });

        // Reschedule booking buttons
        this.container.querySelectorAll('.reschedule-booking-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.currentTarget.getAttribute('data-order-id');
                this.handleRescheduleBooking(orderId);
            });
        });
    }

    /**
     * Handle cancel booking
     */
    async handleCancelBooking(orderId) {
        const booking = this.bookings.find(b => b.order_id == orderId);
        if (!booking) return;

        const confirmed = await window.showConfirm({
            title: 'Cancel Delivery Booking',
            message: `Are you sure you want to cancel the delivery booking for ${booking.order_number}? This action cannot be undone.`,
            icon: 'danger',
            confirmText: 'Cancel Booking',
            cancelText: 'Keep Booking',
            confirmClass: 'btn-danger',
            showLoading: true,
            onConfirm: async () => {
                try {
                    window.showLoading('Cancelling booking...');
                    
                    const response = await fetch(this.options.cancelEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            order_id: orderId
                        })
                    });
                    
                    const data = await response.json();
                    window.hideLoading();
                    
                    if (data.success) {
                        window.showToast('Booking cancelled successfully.', 'success', 5000);
                        // Reload bookings
                        await this.loadBookings();
                    } else {
                        window.showToast(data.message || 'Failed to cancel booking.', 'error', 7000);
                    }
                } catch (error) {
                    console.error('Cancel booking error:', error);
                    window.hideLoading();
                    window.showToast('Connection error. Please try again.', 'error', 7000);
                }
            }
        });
    }

    /**
     * Handle reschedule booking
     */
    async handleRescheduleBooking(orderId) {
        const booking = this.bookings.find(b => b.order_id == orderId);
        if (!booking) return;

        // Show reschedule modal with calendar
        window.showToast('Reschedule functionality coming soon. Please contact support to reschedule.', 'info', 5000);
        // TODO: Implement reschedule with calendar picker
    }

    /**
     * Check if booking can be cancelled
     */
    canCancel(status) {
        const cancellableStatuses = ['pending', 'approved', 'processing'];
        return cancellableStatuses.includes(status?.toLowerCase());
    }

    /**
     * Check if booking can be rescheduled
     */
    canReschedule(status) {
        const reschedulableStatuses = ['pending', 'approved'];
        return reschedulableStatuses.includes(status?.toLowerCase());
    }

    /**
     * Get status class
     */
    getStatusClass(status) {
        const statusMap = {
            'pending': 'status-pending',
            'approved': 'status-approved',
            'processing': 'status-processing',
            'completed': 'status-completed',
            'cancelled': 'status-cancelled',
            'rejected': 'status-rejected'
        };
        return statusMap[status?.toLowerCase()] || 'status-unknown';
    }

    /**
     * Get status icon
     */
    getStatusIcon(status) {
        const iconMap = {
            'pending': 'fa-clock',
            'approved': 'fa-check-circle',
            'processing': 'fa-cog fa-spin',
            'completed': 'fa-check-double',
            'cancelled': 'fa-times-circle',
            'rejected': 'fa-ban'
        };
        return iconMap[status?.toLowerCase()] || 'fa-question-circle';
    }

    /**
     * Format status text
     */
    formatStatus(status) {
        return status?.charAt(0).toUpperCase() + status?.slice(1).toLowerCase() || 'Unknown';
    }

    /**
     * Format date
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    /**
     * Format time
     */
    formatTime(timeStr) {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    /**
     * Format date time
     */
    formatDateTime(dateTimeStr) {
        const date = new Date(dateTimeStr);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Make available globally
window.BookingHistory = BookingHistory;

