/**
 * Calendar Scheduling System
 * Interactive calendar for booking delivery appointments
 */

class CalendarScheduler {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            minAdvanceDays: (typeof options.minAdvanceDays === 'number') ? options.minAdvanceDays : 3,
            maxAdvanceDays: options.maxAdvanceDays || 30,
            deliveryHours: options.deliveryHours || { start: 7, end: 18 },
            onDateSelect: options.onDateSelect || null,
            onTimeSelect: options.onTimeSelect || null,
            unavailableSlots: options.unavailableSlots || [],
            ...options
        };
        // Pick Up always allows same-day (force minAdvanceDays to 0)
        if (String(this.options.deliveryMethod || '').trim().toLowerCase() === 'pick up') {
            this.options.minAdvanceDays = 0;
        }
        this.selectedDate = null;
        this.selectedTime = null;
        this.availableSlots = [];
        this.init();
    }

    init() {
        if (!this.container) {
            console.error('Calendar container not found');
            return;
        }
        this.render();
        this.attachEventListeners();
    }

    /**
     * Render calendar
     */
    render() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const minDate = new Date(today);
        minDate.setDate(today.getDate() + this.options.minAdvanceDays);
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + this.options.maxAdvanceDays);
        // When same-day is allowed (minAdvanceDays 0), start on current month
        if (this.options.minAdvanceDays === 0) {
            this.currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        }

        this.container.innerHTML = `
            <div class="calendar-scheduler">
                <div class="calendar-header">
                    <h5><i class="fas fa-calendar-alt mr-2"></i>Select Delivery Date</h5>
                </div>
                <div class="calendar-body">
                    <div class="calendar-month-view">
                        <div class="calendar-nav">
                            <button class="btn btn-sm btn-outline-secondary calendar-prev" type="button">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <h6 class="calendar-month-title"></h6>
                            <button class="btn btn-sm btn-outline-secondary calendar-next" type="button">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                        <div class="calendar-grid"></div>
                    </div>
                    <div class="time-slots-container" style="display: none;">
                        <h6 class="time-slots-title">Available Time Slots</h6>
                        <div class="time-slots-grid"></div>
                        <div class="time-slots-message text-muted"></div>
                    </div>
                </div>
                <div class="calendar-selected-info">
                    <div class="selected-date-info" style="display: none;">
                        <i class="fas fa-calendar-check text-primary"></i>
                        <span class="selected-date-text"></span>
                    </div>
                </div>
            </div>
        `;

        if (this.options.minAdvanceDays !== 0) {
            this.currentMonth = new Date(minDate);
        }
        this.renderMonth();
    }

    /**
     * Render month view
     */
    renderMonth() {
        const monthTitle = this.container.querySelector('.calendar-month-title');
        const grid = this.container.querySelector('.calendar-grid');
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        
        monthTitle.textContent = `${monthNames[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;

        const today = new Date();
        // Normalize today to midnight to avoid time-of-day comparison issues
        today.setHours(0, 0, 0, 0);
        // Get today's date in local timezone (not UTC)
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
        const todayDay = today.getDate();
        const todayStr = `${todayYear}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;
        
        const minDate = new Date(today);
        minDate.setDate(today.getDate() + this.options.minAdvanceDays);
        minDate.setHours(0, 0, 0, 0); // Normalize to midnight
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + this.options.maxAdvanceDays);
        maxDate.setHours(23, 59, 59, 999); // Set to end of day

        // Get first day of month and number of days
        const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
        const lastDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        // Day names
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        let html = '<div class="calendar-weekdays">';
        dayNames.forEach(day => {
            html += `<div class="calendar-weekday">${day}</div>`;
        });
        html += '</div><div class="calendar-days">';

        // Empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            html += '<div class="calendar-day empty"></div>';
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const year = this.currentMonth.getFullYear();
            const month = this.currentMonth.getMonth() + 1; // JavaScript months are 0-indexed
            // Create date string directly without using Date.toISOString() to avoid timezone issues
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const date = new Date(year, month - 1, day);
            date.setHours(0, 0, 0, 0); // Normalize to midnight for comparison
            // Check if date is in the past (before today) - compare date strings to avoid timezone issues
            const isPastDate = dateStr < todayStr;
            // Check if date is before minimum advance days
            // For same-day pickup (minAdvanceDays = 0), allow today's date
            const isBeforeMinDate = this.options.minAdvanceDays === 0 
                ? dateStr < todayStr  // For same-day, only exclude past dates
                : date < minDate;     // For advance notice, use date comparison
            // Check if date is after maximum advance days
            const isAfterMaxDate = date > maxDate;
            const isPast = isPastDate || isBeforeMinDate;
            const isFuture = isAfterMaxDate;
            const isToday = dateStr === todayStr;
            const isSelected = this.selectedDate === dateStr;
            // Check if date is unavailable (locked dates, e.g., previously selected dates)
            const isUnavailable = this.isDateUnavailable(dateStr);

            let classes = 'calendar-day';
            if (isPast || isFuture || isUnavailable) classes += ' disabled';
            if (isToday) classes += ' today';
            if (isSelected) classes += ' selected';
            if (isUnavailable) classes += ' unavailable';

            html += `
                <div class="${classes}" data-date="${dateStr}" ${isPast || isFuture || isUnavailable ? '' : 'tabindex="0" role="button" aria-label="Select date ' + dateStr + '"'}>
                    ${day}
                </div>
            `;
        }

        html += '</div>';
        grid.innerHTML = html;

        // Attach click handlers (exclude unavailable dates)
        grid.querySelectorAll('.calendar-day:not(.empty):not(.disabled):not(.unavailable)').forEach(day => {
            day.addEventListener('click', () => {
                const date = day.getAttribute('data-date');
                this.selectDate(date);
            });
            day.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const date = day.getAttribute('data-date');
                    this.selectDate(date);
                }
            });
        });
    }

    /**
     * Check if date is unavailable
     */
    isDateUnavailable(dateStr) {
        return this.options.unavailableSlots.some(slot => slot.date === dateStr);
    }

    /**
     * Select date
     */
    selectDate(dateStr) {
        // Prevent selection of past dates (dates before today)
        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth() + 1;
        const todayDay = today.getDate();
        const todayStr = `${todayYear}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;
        
        if (dateStr < todayStr) {
            if (window.showToast) {
                window.showToast('Cannot select a date that has already passed. Please select a future date.', 'warning', 6000);
            } else {
                alert('Cannot select a date that has already passed. Please select a future date.');
            }
            return;
        }
        
        // Parse selected date for later checks
        const [year, month, day] = dateStr.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        selectedDate.setHours(0, 0, 0, 0); // Normalize to midnight

        // Check if date is before minimum advance days
        // For same-day pickup (minAdvanceDays = 0), allow today's date
        if (this.options.minAdvanceDays > 0) {
            const minDate = new Date(today);
            minDate.setDate(today.getDate() + this.options.minAdvanceDays);
            minDate.setHours(0, 0, 0, 0); // Normalize to midnight
            
            if (selectedDate < minDate) {
                if (window.showToast) {
                    window.showToast(`Please select a date at least ${this.options.minAdvanceDays} days in advance.`, 'warning', 6000);
                } else {
                    alert(`Please select a date at least ${this.options.minAdvanceDays} days in advance.`);
                }
                return;
            }
        }
        
        // Check if date is after maximum advance days
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + this.options.maxAdvanceDays);
        maxDate.setHours(23, 59, 59, 999);
        if (selectedDate > maxDate) {
            if (window.showToast) {
                window.showToast(`Please select a date within ${this.options.maxAdvanceDays} days.`, 'warning', 6000);
            } else {
                alert(`Please select a date within ${this.options.maxAdvanceDays} days.`);
            }
            return;
        }
        
        // Check if date is unavailable (locked dates, e.g., previously selected dates)
        if (this.isDateUnavailable(dateStr)) {
            const unavailableSlot = this.options.unavailableSlots.find(slot => slot.date === dateStr);
            const reason = unavailableSlot?.reason || 'This date is unavailable';
            if (window.showToast) {
                window.showToast(reason, 'warning', 6000);
            } else {
                alert(reason);
            }
            return;
        }

        this.selectedDate = dateStr;
        this.selectedTime = null;
        
        // Update UI
        this.container.querySelectorAll('.calendar-day').forEach(day => {
            day.classList.remove('selected');
        });
        const selectedDay = this.container.querySelector(`[data-date="${dateStr}"]`);
        if (selectedDay) {
            selectedDay.classList.add('selected');
        }

        // Show selected date info
        const dateInfo = this.container.querySelector('.selected-date-info');
        const dateText = this.container.querySelector('.selected-date-text');
        if (dateInfo && dateText) {
            // Format date directly from string to avoid timezone issues
            const [year, month, day] = dateStr.split('-').map(Number);
            
            // Use a Date object created in local timezone to get day of week
            // Create at noon to avoid any timezone edge cases
            const localDate = new Date(year, month - 1, day, 12, 0, 0);
            const dayOfWeek = localDate.getDay(); // 0=Sunday, 1=Monday, etc.
            
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            
            // Verify the date components match (to ensure no timezone shift occurred)
            if (localDate.getFullYear() === year && localDate.getMonth() === month - 1 && localDate.getDate() === day) {
                // Use the original day value from the string
                const formattedDate = `${dayNames[dayOfWeek]}, ${monthNames[month - 1]} ${day}, ${year}`;
                dateText.textContent = formattedDate;
            } else {
                // Fallback: use the date from the Date object if there was a shift
                const formattedDate = `${dayNames[dayOfWeek]}, ${monthNames[localDate.getMonth()]} ${localDate.getDate()}, ${localDate.getFullYear()}`;
                dateText.textContent = formattedDate;
            }
            dateInfo.style.display = 'flex';
        }

        // Load time slots for selected date
        this.loadTimeSlots(dateStr);

        // Callback
        if (this.options.onDateSelect) {
            this.options.onDateSelect(dateStr);
        }
    }

    /**
     * Load time slots for selected date (DISABLED - Date only mode)
     */
    loadTimeSlots(dateStr) {
        // Time selection is disabled - only date selection
        const timeSlotsContainer = this.container.querySelector('.time-slots-container');
        if (timeSlotsContainer) {
            timeSlotsContainer.style.display = 'none';
        }
    }

    /**
     * Select time
     */
    selectTime(timeStr) {
        this.selectedTime = timeStr;

        // Update UI
        this.container.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('selected');
        });
        const selectedSlot = this.container.querySelector(`[data-time="${timeStr}"]`);
        if (selectedSlot) {
            selectedSlot.classList.add('selected');
        }

        // Time selection disabled - no time info to show
        // Callback (date only)
        if (this.options.onDateSelect) {
            this.options.onDateSelect(this.selectedDate);
        }
    }

    /**
     * Format time for display
     */
    formatTime(timeStr) {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    /**
     * Get selected date and time
     */
    getSelection() {
        return {
            date: this.selectedDate,
            time: this.selectedTime
        };
    }

    /**
     * Set selected date and time
     */
    setSelection(date, time) {
        if (date) this.selectDate(date);
        if (time && this.selectedDate) this.selectTime(time);
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Previous month
        const prevBtn = this.container.querySelector('.calendar-prev');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
                this.renderMonth();
            });
        }

        // Next month
        const nextBtn = this.container.querySelector('.calendar-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
                this.renderMonth();
            });
        }
    }

    /**
     * Update unavailable slots
     */
    updateUnavailableSlots(slots) {
        this.options.unavailableSlots = slots;
        this.renderMonth();
        if (this.selectedDate) {
            this.loadTimeSlots(this.selectedDate);
        }
    }
}

// Make available globally
window.CalendarScheduler = CalendarScheduler;

