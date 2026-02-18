// deliveries-admin.js - Delivery Management JavaScript

function getAdminUserRole() {
    return (sessionStorage.getItem('user_role') || '').trim();
}

function isDeliveryDriverUser() {
    return getAdminUserRole() === 'Delivery Driver';
}

function waitForAdminRole(cb, attempts = 0) {
    const role = getAdminUserRole();
    if (role) return cb(role);
    if (attempts >= 30) return cb(''); // give up after ~3s
    setTimeout(() => waitForAdminRole(cb, attempts + 1), 100);
}

$(document).ready(function() {
    // Ensure completeDelivery function is available
    if (typeof window.completeDelivery === 'undefined') {
        console.warn('[DeliveriesAdmin] completeDelivery function not loaded yet, waiting...');
        // Wait a bit for load_deliveries.js to load
        setTimeout(() => {
            if (typeof window.completeDelivery === 'undefined') {
                console.error('[DeliveriesAdmin] completeDelivery function still not available after delay');
            } else {
                console.log('[DeliveriesAdmin] completeDelivery function now available');
            }
        }, 1000);
    }
    
    // Tab switching functionality (matching OrdersAdmin style)
    $('.tab-btn').click(function() {
        // Get the target tab
        const targetTab = $(this).data('tab');

        if ((targetTab === 'drivers' || targetTab === 'fleet') && isDeliveryDriverUser()) {
            if (window.AdminNotifications) {
                AdminNotifications.warning('Access Denied: This action is not available for your role', { duration: 4000 });
            }
            return;
        }
        
        // Remove active class from all tabs and content
        $('.tab-btn').removeClass('active');
        $('.tab-content').removeClass('active');
        
        // Add active class to clicked tab
        $(this).addClass('active');
        
        // Show corresponding content
        const targetContent = $('#' + targetTab + '-content');
        if (targetContent.length > 0) {
            targetContent.addClass('active');
        }
        
        console.log('Switched to tab:', targetTab);
        
        // If switching to completed delivery tab, ensure deliveries are loaded
        if (targetTab === 'completed-delivery') {
            // Trigger a refresh if deliveries haven't been loaded yet
            if (typeof loadDeliveries === 'function') {
                loadDeliveries();
            }
        }
        
        // If switching to drivers tab, load drivers
        if (targetTab === 'drivers') {
            if (typeof loadDrivers === 'function') {
                loadDrivers();
            }
        }
    });
    
    // Status tab switching functionality (sub-tabs within Active Deliveries)
    $(document).on('click', '.status-tab-btn', function() {
        const selectedStatus = $(this).data('status');
        
        // Remove active class from all active-deliveries status tabs
        $('.status-tab-btn').removeClass('active');
        
        // Add active class to clicked status tab
        $(this).addClass('active');
        
        console.log('Switched to Active Deliveries status tab:', selectedStatus);
        
        // Filter and display deliveries by status
        if (typeof filterDeliveriesByStatus === 'function') {
            filterDeliveriesByStatus(selectedStatus);
        }
    });

    // History status tab switching functionality (sub-tabs within Delivery History)
    $(document).on('click', '.history-status-tab-btn', function() {
        const selectedStatus = $(this).data('status');
        
        // Remove active class from all history status tabs
        $('.history-status-tab-btn').removeClass('active');
        
        // Add active class to clicked history status tab
        $(this).addClass('active');
        
        console.log('Switched to History status tab:', selectedStatus);
        
        // Filter and display history deliveries by status
        if (typeof filterHistoryByStatus === 'function') {
            filterHistoryByStatus(selectedStatus);
        }
    });
    
    // Setup event delegation for Complete Delivery buttons (jQuery version - backup)
    // Only attach if native handler didn't work (as a fallback)
    $(document).off('click', '.delivered-btn').on('click', '.delivered-btn', function(e) {
        // Check if this was already handled by native handler
        if (e.isDefaultPrevented() && e.isPropagationStopped()) {
            return false; // Already handled
        }
        
        // Prevent all default behaviors
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const deliveryId = parseInt($(this).data('delivery-id')) || 0;
        const orderId = parseInt($(this).data('order-id'));
        const customerName = $(this).data('customer-name') || 'the customer';
        
        console.log('[Complete Delivery Button] jQuery handler clicked:', { deliveryId, orderId, customerName });
        
        // Check if function exists
        if (typeof window.completeDelivery !== 'function') {
            console.error('[DeliveriesAdmin] completeDelivery function not available');
            if (window.AdminNotifications) {
                AdminNotifications.error('Complete delivery function not loaded. Please refresh the page.', {
                    duration: 5000
                });
            } else {
                alert('Complete delivery function not loaded. Please refresh the page.');
            }
            return false;
        }
        
        if (!orderId) {
            console.error('[DeliveriesAdmin] Missing order ID');
            if (window.AdminNotifications) {
                AdminNotifications.error('Missing order information. Please refresh the page.', {
                    duration: 5000
                });
            } else {
                alert('Missing order information. Please refresh the page.');
            }
            return false;
        }
        
        // Call the function
        try {
            window.completeDelivery(deliveryId, orderId, customerName);
        } catch (error) {
            console.error('[DeliveriesAdmin] Error calling completeDelivery:', error);
            if (window.AdminNotifications) {
                AdminNotifications.error('An error occurred: ' + (error.message || 'Unknown error'), {
                    duration: 5000
                });
            } else {
                alert('An error occurred: ' + (error.message || 'Unknown error'));
            }
        }
        
        return false;
    });
    
    // Ensure View buttons work properly (prevent any interference)
    // Single handler to avoid conflicts - just allow navigation
    $(document).off('click', '.order-card-btn.view-btn').on('click', '.order-card-btn.view-btn', function(e) {
        // Allow the link to work normally - don't prevent default
        const orderId = $(this).data('order-id') || $(this).attr('href')?.match(/order_id=(\d+)/)?.[1];
        console.log('[View Button] Clicked for order:', orderId);
        // Stop propagation to prevent parent handlers from interfering
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Explicitly allow navigation - don't return false
        return true;
    });
    
    // Legacy handler for old delivery view buttons (if they exist)
    $('.view-btn').click(function() {
        const buttonId = $(this).attr('id');
        
        // Check if it's a delivery view button
        if (buttonId && buttonId.includes('view-delivery')) {
            // Extract delivery data from the closest delivery card
            const deliveryCard = $(this).closest('.delivery-card');
            const deliveryCode = deliveryCard.find('.delivery-code').text();
            const customerName = deliveryCard.find('.customer-name').text();
            const driverName = deliveryCard.find('.driver-name').text();
            const deliveryAddress = deliveryCard.find('.delivery-address').text();
            const deliveryItems = deliveryCard.find('.delivery-items').text();
            
            // Populate modal with delivery data
            $('#modal-delivery-code').text(deliveryCode);
            $('#modal-customer-name').text(customerName);
            $('#modal-order-id').text('ORD-2025-001234'); // Default order ID
            $('#modal-driver-name').text(driverName);
            $('#modal-vehicle-info').text('Truck-001 (ABC-1234)'); // Default vehicle info
            $('#modal-delivery-address').text(deliveryAddress);
            $('#modal-delivery-items').text(deliveryItems.replace(/^\d+\.\d+\s*km\s*/, '')); // Remove distance prefix
            $('#modal-distance').text('8.5 km'); // Default distance
            $('#modal-progress-status').text('In Transit');
            
            // Show delivery details modal
            $('#deliveryDetailsModal').modal('show');
            console.log('Showing delivery details for:', deliveryCode);
        }
        
        // Check if it's a driver view button
        else if (buttonId && buttonId.includes('view-driver')) {
            // Extract driver data from the closest driver row
            const driverRow = $(this).closest('.driver-row');
            const driverName = driverRow.find('.driver-name').text();
            const vehicleId = driverRow.find('.vehicle-id').text();
            const deliveryId = driverRow.find('.delivery-id').text();
            const location = driverRow.find('.location').text();
            
            // Populate modal with driver data
            $('#modal-driver-profile-name').text(driverName);
            $('#modal-driver-phone').text('+63 912 345 6789'); // Default phone
            $('#modal-driver-vehicle').text('Truck-001 (' + vehicleId + ')');
            $('#modal-driver-delivery').text(deliveryId);
            $('#modal-driver-location').text(location);
            
            // Show driver profile modal
            $('#driverProfileModal').modal('show');
            console.log('Showing driver profile for:', driverName);
        }
        
        // Default view action for other buttons
        else {
            const target = $(this).data('driver') || $(this).data('vehicle') || $(this).attr('id');
            console.log('View action clicked for:', target);
        }
    });
    
    // EDIT BUTTON FUNCTIONALITY
    $('.edit-btn').click(function() {
        const target = $(this).data('driver') || $(this).data('vehicle') || $(this).attr('id');
        console.log('Edit action clicked for:', target);
        // Add your edit functionality here
    });
    
    // MORE OPTIONS BUTTON FUNCTIONALITY
    $('.more-btn').click(function() {
        const deliveryId = $(this).attr('id').replace('more-delivery-', '');
        console.log('More options clicked for delivery:', deliveryId);
        // Add your more options functionality here
    });
    
    // ADD BUTTONS FUNCTIONALITY
    $('#add-driver-btn').click(function() {
        console.log('Add Driver button clicked');
        if (isDeliveryDriverUser()) {
            if (window.AdminNotifications) {
                AdminNotifications.warning('Access Denied: This action is not available for your role', { duration: 4000 });
            }
            return;
        }
        if (typeof addDriver === 'function') {
            addDriver();
        } else {
            alert('Add driver function not loaded. Please refresh the page.');
        }
    });
    
    $('#add-fleet-btn').click(function() {
        console.log('Add Fleet button clicked');
        if (isDeliveryDriverUser()) {
            if (window.AdminNotifications) {
                AdminNotifications.warning('Access Denied: This action is not available for your role', { duration: 4000 });
            }
            return;
        }
        if (typeof addFleetVehicle === 'function') {
            addFleetVehicle();
        } else {
            alert('Add fleet function not loaded. Please refresh the page.');
        }
    });
    
    // FILTER AND EXPORT BUTTONS
    $('#filter-btn').click(function() {
        console.log('Filter button clicked');
        waitForAdminRole(() => {
            if (isDeliveryDriverUser()) {
                if (window.AdminNotifications) {
                    AdminNotifications.warning('Access Denied: This action is not available for your role', { duration: 4000 });
                }
                return;
            }
            openFilterModal();
        });
    });
    
    $('#timetable-btn').click(function() {
        waitForAdminRole(() => {
            if (isDeliveryDriverUser()) {
                if (window.AdminNotifications) {
                    AdminNotifications.warning('Access Denied: This action is not available for your role', { duration: 4000 });
                }
                return;
            }
            openDeliveryTimetableModal();
        });
    });
    
    // Filter modal functionality
    $('#applyFiltersBtn').click(function() {
        applyFilters();
    });
    
    $('#clearFiltersBtn').click(function() {
        clearFilters();
    });
    
    // Load filter options when modal opens
    $('#filterModal').on('show.bs.modal', function() {
        if (isDeliveryDriverUser()) return;
        loadFilterOptions();
    });
    
    // MODAL CLOSE FUNCTIONALITY
    $('.close-modal-btn').click(function() {
        $(this).closest('.modal').modal('hide');
        console.log('Modal closed');
    });
});

// Global filter state
let currentFilters = {
    status: 'all',
    driver: 'all',
    vehicle: 'all',
    dateFrom: '',
    dateTo: '',
    customer: '',
    deliveryCode: ''
};

// Open filter modal
function openFilterModal() {
    if (isDeliveryDriverUser()) return;
    $('#filterModal').modal('show');
}

// Load filter options (drivers and vehicles)
async function loadFilterOptions() {
    try {
        if (!getAdminUserRole()) {
            setTimeout(loadFilterOptions, 150);
            return;
        }
        if (isDeliveryDriverUser()) return;

        // Load drivers
        const driversResponse = await fetch('../api/get_delivery_drivers.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (driversResponse.ok) {
            const driversData = await driversResponse.json();
            if (driversData.success && driversData.drivers) {
                const driverSelect = document.getElementById('filterDriver');
                const currentValue = driverSelect.value;
                driverSelect.innerHTML = '<option value="all">All Drivers</option><option value="unassigned">Unassigned</option>';
                
                driversData.drivers.forEach(driver => {
                    const option = document.createElement('option');
                    option.value = driver.user_id;
                    option.textContent = driver.full_name;
                    driverSelect.appendChild(option);
                });
                
                if (currentValue) {
                    driverSelect.value = currentValue;
                }
            }
        }
        
        // Load vehicles
        const vehiclesResponse = await fetch('../api/get_fleet.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (vehiclesResponse.ok) {
            const vehiclesData = await vehiclesResponse.json();
            if (vehiclesData.success && vehiclesData.fleet) {
                const vehicleSelect = document.getElementById('filterVehicle');
                const currentValue = vehicleSelect.value;
                vehicleSelect.innerHTML = '<option value="all">All Vehicles</option><option value="unassigned">Unassigned</option>';
                
                vehiclesData.fleet.forEach(vehicle => {
                    const option = document.createElement('option');
                    option.value = vehicle.vehicle_id;
                    option.textContent = vehicle.vehicle_model;
                    vehicleSelect.appendChild(option);
                });
                
                if (currentValue) {
                    vehicleSelect.value = currentValue;
                }
            }
        }
        
        // Restore filter values
        if (currentFilters.status) $('#filterStatus').val(currentFilters.status);
        if (currentFilters.driver) $('#filterDriver').val(currentFilters.driver);
        if (currentFilters.vehicle) $('#filterVehicle').val(currentFilters.vehicle);
        if (currentFilters.dateFrom) $('#filterDateFrom').val(currentFilters.dateFrom);
        if (currentFilters.dateTo) $('#filterDateTo').val(currentFilters.dateTo);
        if (currentFilters.customer) $('#filterCustomer').val(currentFilters.customer);
        if (currentFilters.deliveryCode) $('#filterDeliveryCode').val(currentFilters.deliveryCode);
        
        updateActiveFiltersDisplay();
    } catch (error) {
        console.error('[Load Filter Options] Error:', error);
    }
}

// Apply filters
function applyFilters() {
    // Get filter values
    currentFilters = {
        status: $('#filterStatus').val() || 'all',
        driver: $('#filterDriver').val() || 'all',
        vehicle: $('#filterVehicle').val() || 'all',
        dateFrom: $('#filterDateFrom').val() || '',
        dateTo: $('#filterDateTo').val() || '',
        customer: $('#filterCustomer').val() || '',
        deliveryCode: $('#filterDeliveryCode').val() || ''
    };
    
    // Close modal
    $('#filterModal').modal('hide');
    
    // Apply filters to displayed deliveries
    filterDeliveries();
    
    // Update filter button badge
    updateFilterButtonBadge();
    
    console.log('[Apply Filters] Filters applied:', currentFilters);
}

// Clear all filters
function clearFilters() {
    $('#filterStatus').val('all');
    $('#filterDriver').val('all');
    $('#filterVehicle').val('all');
    $('#filterDateFrom').val('');
    $('#filterDateTo').val('');
    $('#filterCustomer').val('');
    $('#filterDeliveryCode').val('');
    
    currentFilters = {
        status: 'all',
        driver: 'all',
        vehicle: 'all',
        dateFrom: '',
        dateTo: '',
        customer: '',
        deliveryCode: ''
    };
    
    updateActiveFiltersDisplay();
    filterDeliveries();
    updateFilterButtonBadge();
}

// Filter deliveries based on current filters
function filterDeliveries() {
    const activeContainer = document.querySelector('#active-deliveries-content .delivery-cards');
    const historyContainer = document.getElementById('delivery-history-cards');
    
    // Get all delivery cards
    const allCards = document.querySelectorAll('.delivery-card');
    
    let visibleCount = 0;
    
    allCards.forEach(card => {
        let shouldShow = true;
        
        // Get delivery data from card
        const deliveryId = card.getAttribute('data-delivery-id');
        const orderId = card.getAttribute('data-order-id');
        const status = card.getAttribute('data-status') || card.querySelector('.delivery-status-dropdown')?.value || 'Pending';
        const driverId = card.getAttribute('data-driver-id') || card.querySelector('.driver-name')?.getAttribute('data-driver-id') || '';
        const vehicleId = card.getAttribute('data-vehicle-id') || card.querySelector('.vehicle-name')?.getAttribute('data-vehicle-id') || '';
        const driverName = card.querySelector('.driver-name')?.textContent?.trim() || '';
        const vehicleName = card.querySelector('.vehicle-name')?.textContent?.trim() || '';
        const customerName = card.querySelector('.customer-name')?.textContent?.trim() || '';
        const deliveryCode = card.querySelector('.delivery-code')?.textContent?.trim() || '';
        const createdDate = card.getAttribute('data-created-date') || '';
        
        // Apply status filter
        if (currentFilters.status !== 'all' && status !== currentFilters.status) {
            shouldShow = false;
        }
        
        // Apply driver filter
        if (currentFilters.driver !== 'all') {
            if (currentFilters.driver === 'unassigned') {
                if (driverId && driverId !== '') {
                    shouldShow = false;
                }
            } else {
                if (driverId !== currentFilters.driver) {
                    shouldShow = false;
                }
            }
        }
        
        // Apply vehicle filter
        if (currentFilters.vehicle !== 'all') {
            if (currentFilters.vehicle === 'unassigned') {
                if (vehicleId && vehicleId !== '') {
                    shouldShow = false;
                }
            } else {
                if (vehicleId !== currentFilters.vehicle) {
                    shouldShow = false;
                }
            }
        }
        
        // Apply date filters
        if (currentFilters.dateFrom && createdDate) {
            const cardDate = new Date(createdDate);
            const filterDate = new Date(currentFilters.dateFrom);
            if (cardDate < filterDate) {
                shouldShow = false;
            }
        }
        
        if (currentFilters.dateTo && createdDate) {
            const cardDate = new Date(createdDate);
            const filterDate = new Date(currentFilters.dateTo);
            filterDate.setHours(23, 59, 59); // Include entire day
            if (cardDate > filterDate) {
                shouldShow = false;
            }
        }
        
        // Apply customer filter
        if (currentFilters.customer) {
            const searchTerm = currentFilters.customer.toLowerCase();
            if (!customerName.toLowerCase().includes(searchTerm)) {
                shouldShow = false;
            }
        }
        
        // Apply delivery code filter
        if (currentFilters.deliveryCode) {
            const searchTerm = currentFilters.deliveryCode.toLowerCase();
            if (!deliveryCode.toLowerCase().includes(searchTerm)) {
                shouldShow = false;
            }
        }
        
        // Show/hide card
        if (shouldShow) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    // Show message if no deliveries match
    if (visibleCount === 0) {
        const activeTab = $('.tab-btn.active').data('tab');
        const container = activeTab === 'active-deliveries' 
            ? activeContainer 
            : historyContainer;
        
        if (container && container.querySelectorAll('.delivery-card[style=""]').length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'text-center py-5';
            noResults.innerHTML = '<p class="text-muted">No deliveries match the current filters.</p>';
            container.appendChild(noResults);
        }
    }
    
    console.log('[Filter Deliveries] Visible deliveries:', visibleCount);
}

// Update active filters display
function updateActiveFiltersDisplay() {
    const activeFiltersList = document.getElementById('activeFiltersList');
    const activeFiltersDiv = document.getElementById('activeFilters');
    
    if (!activeFiltersList) return;
    
    const activeFilters = [];
    
    if (currentFilters.status !== 'all') {
        activeFilters.push(`Status: ${currentFilters.status}`);
    }
    if (currentFilters.driver !== 'all') {
        const driverSelect = document.getElementById('filterDriver');
        const driverText = driverSelect.options[driverSelect.selectedIndex]?.text || 'Driver';
        activeFilters.push(`Driver: ${driverText}`);
    }
    if (currentFilters.vehicle !== 'all') {
        const vehicleSelect = document.getElementById('filterVehicle');
        const vehicleText = vehicleSelect.options[vehicleSelect.selectedIndex]?.text || 'Vehicle';
        activeFilters.push(`Vehicle: ${vehicleText}`);
    }
    if (currentFilters.dateFrom) {
        activeFilters.push(`From: ${currentFilters.dateFrom}`);
    }
    if (currentFilters.dateTo) {
        activeFilters.push(`To: ${currentFilters.dateTo}`);
    }
    if (currentFilters.customer) {
        activeFilters.push(`Customer: ${currentFilters.customer}`);
    }
    if (currentFilters.deliveryCode) {
        activeFilters.push(`Code: ${currentFilters.deliveryCode}`);
    }
    
    if (activeFilters.length > 0) {
        activeFiltersList.innerHTML = activeFilters.map(filter => 
            `<span class="badge badge-secondary mr-2 mb-2">${filter}</span>`
        ).join('');
        activeFiltersDiv.style.display = 'block';
    } else {
        activeFiltersDiv.style.display = 'none';
    }
}

// Update filter button badge
function updateFilterButtonBadge() {
    const filterBtn = document.getElementById('filter-btn');
    if (!filterBtn) return;
    
    const activeCount = Object.values(currentFilters).filter(v => v && v !== 'all').length;
    
    // Remove existing badge
    const existingBadge = filterBtn.querySelector('.filter-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
    // Add badge if filters are active
    if (activeCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'filter-badge badge badge-danger ml-2';
        badge.textContent = activeCount;
        badge.style.cssText = 'position: absolute; top: -5px; right: -5px; font-size: 10px; padding: 2px 5px;';
        filterBtn.style.position = 'relative';
        filterBtn.appendChild(badge);
    }
}

// Delivery Timetable Modal - calendar view of deliveries (day, week, month)
let timetableCalendarInstance = null;

function openDeliveryTimetableModal() {
    $('#timetableEventDetail').hide();
    if (timetableCalendarInstance) {
        timetableCalendarInstance.destroy();
        timetableCalendarInstance = null;
    }
    // Show modal first; build and render calendar only after modal is fully visible
    // so FullCalendar gets correct dimensions (fixes collapsed/blank view on open)
    $('#timetableModal').one('shown.bs.modal', function() {
        var calendarEl = document.getElementById('timetableCalendar');
        if (calendarEl) calendarEl.innerHTML = '<div class="text-center py-5 text-muted"><i class="fas fa-spinner fa-spin fa-2x mb-2"></i><p>Loading timetable...</p></div>';
        fetch('../api/load_deliveries_admin.php', { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                if (!data.success || !data.deliveries) {
                    if (window.AdminNotifications) {
                        AdminNotifications.error('Failed to load deliveries for timetable.', { duration: 4000 });
                    }
                    return;
                }
                const events = [];
                const deliveries = (data.deliveries || []).filter(d => {
                    const method = (d.delivery_method || '').toLowerCase().trim();
                    return method !== 'pick up';
                });
                deliveries.forEach(d => {
                    const avDate = d.availability_date || d.order_date;
                    const avTime = (d.availability_time || '09:00:00').toString().trim();
                    if (!avDate) return;
                    const dateStr = avDate.includes(' ') ? avDate.split(' ')[0] : avDate;
                    let start, end, timeWindowLabel;
                    const timePart = avTime.split(':')[0] || '';
                    const hour = parseInt(timePart, 10);
                    if (hour >= 8 && hour < 12) {
                        start = new Date(dateStr + 'T08:00:00');
                        end = new Date(dateStr + 'T12:00:00');
                        timeWindowLabel = 'Morning (8 AM – 12 PM)';
                    } else if (hour >= 12 && hour < 17) {
                        start = new Date(dateStr + 'T12:00:00');
                        end = new Date(dateStr + 'T17:00:00');
                        timeWindowLabel = 'Afternoon (12 PM – 5 PM)';
                    } else {
                        if (hour < 12) {
                            start = new Date(dateStr + 'T08:00:00');
                            end = new Date(dateStr + 'T12:00:00');
                            timeWindowLabel = 'Morning (8 AM – 12 PM)';
                        } else {
                            start = new Date(dateStr + 'T12:00:00');
                            end = new Date(dateStr + 'T17:00:00');
                            timeWindowLabel = 'Afternoon (12 PM – 5 PM)';
                        }
                    }
                    const driverName = d.driver_name || d.drivers?.[0]?.name || 'Unassigned';
                    const vehicleName = d.vehicle_model || d.vehicles?.[0]?.model || 'Unassigned';
                    const customerName = d.customer_name || 'Unknown';
                    const orderId = d.Order_ID ? 'ORD-' + String(d.Order_ID).padStart(4, '0') : '-';
                    const amount = d.amount ? '₱' + parseFloat(d.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '₱0';
                    const status = d.Delivery_Status || 'Pending';
                    const title = timeWindowLabel ? orderId + ' - ' + customerName + ' [' + (timeWindowLabel.split(' ')[0]) + ']' : orderId + ' - ' + customerName;
                    events.push({
                        id: 'd-' + (d.Delivery_ID || d.Order_ID),
                        title: title,
                        start: start,
                        end: end,
                        extendedProps: {
                            deliveryId: d.Delivery_ID,
                            orderId: d.Order_ID,
                            customerName,
                            driverName,
                            vehicleName,
                            amount,
                            status,
                            address: d.Customer_Address || '',
                            timeWindow: timeWindowLabel
                        }
                    });
                });
                calendarEl = document.getElementById('timetableCalendar');
                if (!calendarEl) return;
                calendarEl.innerHTML = ''; // clear loading message
                timetableCalendarInstance = new FullCalendar.Calendar(calendarEl, {
                    initialView: 'dayGridWeek',
                    contentHeight: 'auto',
                    eventMinHeight: 48,
                    headerToolbar: {
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,dayGridWeek,dayGridDay'
                    },
                    dayMaxEventRows: 10,
                    events: events,
                    eventContent: function(arg) {
                        var orderId = arg.event.extendedProps.orderId;
                        var orderIdStr = orderId != null ? 'ORD-' + String(orderId).padStart(4, '0') : '-';
                        var timeWindow = arg.event.extendedProps.timeWindow || '';
                        var timeRange = '';
                        if (timeWindow.indexOf('Morning') !== -1) timeRange = '8am-12pm';
                        else if (timeWindow.indexOf('Afternoon') !== -1) timeRange = '12pm-5pm';
                        if (!timeRange && (arg.timeText || '').trim()) timeRange = (arg.timeText || '').trim();
                        var customerName = arg.event.extendedProps.customerName || '';
                        var html = '<div class="fc-event-main-frame"><div class="fc-event-time">' + (timeRange || '') + '</div><div class="fc-event-title-container"><div class="fc-event-title fc-sticky">' + orderIdStr + (customerName ? ' &ndash; ' + customerName : '') + '</div></div></div>';
                        return { html: html };
                    },
                    eventClick: function(info) {
                        const p = info.event.extendedProps;
                        const html = `
                        <p class="mb-1"><strong>Order:</strong> ORD-${String(p.orderId).padStart(4,'0')}</p>
                        ${p.timeWindow ? '<p class="mb-1"><strong>Time Window:</strong> ' + p.timeWindow + '</p>' : ''}
                        <p class="mb-1"><strong>Customer:</strong> ${p.customerName || 'N/A'}</p>
                        <p class="mb-1"><strong>Driver:</strong> ${p.driverName || 'Unassigned'}</p>
                        <p class="mb-1"><strong>Vehicle:</strong> ${p.vehicleName || 'Unassigned'}</p>
                        <p class="mb-1"><strong>Amount:</strong> ${p.amount || '₱0'}</p>
                        <p class="mb-1"><strong>Status:</strong> ${p.status || 'Pending'}</p>
                        ${p.address ? '<p class="mb-0"><strong>Address:</strong> ' + p.address + '</p>' : ''}
                    `;
                        $('#timetableEventContent').html(html);
                        $('#timetableEventDetail').show();
                    }
                });
                timetableCalendarInstance.render();
                // Force layout recalculation after modal and DOM have settled (fixes collapsed view)
                requestAnimationFrame(function() {
                    if (timetableCalendarInstance && typeof timetableCalendarInstance.updateSize === 'function') {
                        timetableCalendarInstance.updateSize();
                    }
                });
            })
            .catch(err => {
                console.error('Timetable load error:', err);
                if (window.AdminNotifications) {
                    AdminNotifications.error('Failed to load delivery timetable.', { duration: 4000 });
                }
            });
    });
    $('#timetableModal').modal('show');
}

// Clean up calendar when modal closes
$('#timetableModal').on('hidden.bs.modal', function() {
    if (timetableCalendarInstance) {
        timetableCalendarInstance.destroy();
        timetableCalendarInstance = null;
    }
});