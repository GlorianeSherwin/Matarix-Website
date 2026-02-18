/**
 * Load Orders for Admin
 * Dynamically loads and displays orders from the database
 */

// Format price
function formatPrice(price) {
    return '₱' + parseFloat(price).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    });
}

// Format datetime
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Normalize delivery status (handle case variations and old values)
function normalizeDeliveryStatus(status) {
    if (!status) return 'Pending';
    const statusLower = status.toLowerCase().trim();
    
    // Map old values to new standardized values
    if (statusLower === 'on the way' || statusLower === 'out for delivery') {
        return 'Out for Delivery';
    }
    if (statusLower === 'preparing') {
        return 'Preparing';
    }
    if (statusLower === 'pending') {
        return 'Pending';
    }
    if (statusLower === 'delivered') {
        return 'Delivered';
    }
    if (statusLower === 'cancelled') {
        return 'Cancelled';
    }
    
    // Return as-is if already standardized (capitalize first letter of each word)
    return status.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
}

// Format time
function formatTime(timeString) {
    if (!timeString) return '';
    
    // Handle time-only strings (HH:MM:SS or HH:MM)
    if (timeString.includes(':') && !timeString.includes('T') && !timeString.includes(' ')) {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }
    
    // Handle full date-time strings
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Get status badge class
function getStatusBadgeClass(status) {
    const statusMap = {
        'Order Confirmed': 'status-confirmed',
        'Being Processed': 'status-preparing',
        'On the Way': 'status-ready',
        'Completed': 'status-completed'
    };
    return statusMap[status] || 'status-confirmed';
}

// Global cache for vehicle capacities and delivery fees
let vehicleCapacitiesCache = null;
let deliveryFeeCache = {};

// Load vehicle capacities from fleet
async function loadVehicleCapacities() {
    if (vehicleCapacitiesCache) {
        return vehicleCapacitiesCache;
    }
    
    try {
        const response = await fetch('../api/get_fleet.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.vehicles) {
                // Convert all capacities to kg
                vehicleCapacitiesCache = data.vehicles.map(vehicle => {
                    let capacityKg = parseFloat(vehicle.capacity) || 0;
                    const unit = vehicle.capacity_unit || 'kg';
                    
                    // Convert to kg
                    switch(unit) {
                        case 'g': capacityKg = capacityKg / 1000; break;
                        case 'lb': capacityKg = capacityKg * 0.453592; break;
                        case 'oz': capacityKg = capacityKg * 0.0283495; break;
                        case 'ton': capacityKg = capacityKg * 1000; break;
                    }
                    
                    return {
                        id: vehicle.vehicle_id || vehicle.Vehicle_ID,
                        model: vehicle.vehicle_model,
                        capacity: capacityKg,
                        status: vehicle.status
                    };
                }).filter(v => v.capacity > 0 && (v.status === 'Available' || v.status === 'In Use'))
                  .sort((a, b) => b.capacity - a.capacity); // Sort by capacity (largest first)
                
                return vehicleCapacitiesCache;
            }
        }
    } catch (error) {
        // Silently handle error
    }
    
    // Return default if API fails
    return [{ id: 1, model: 'Default Truck', capacity: 1700, status: 'Available' }];
}

// Calculate trucks needed for an order
async function calculateTrucksNeeded(orderWeightKg) {
    const vehicles = await loadVehicleCapacities();
    
    if (!vehicles || vehicles.length === 0) {
        return { trucks: 1, vehicles: [] };
    }
    
    let remainingWeight = parseFloat(orderWeightKg) || 0;
    let trucksNeeded = 0;
    const vehiclesUsed = [];
    
    // Use largest vehicles first
    for (const vehicle of vehicles) {
        if (remainingWeight <= 0) break;
        
        const trips = Math.ceil(remainingWeight / vehicle.capacity);
        trucksNeeded += trips;
        
        if (trips > 0) {
            vehiclesUsed.push({
                vehicle: vehicle.model,
                capacity: vehicle.capacity,
                trips: trips
            });
        }
        
        remainingWeight -= (vehicle.capacity * trips);
    }
    
    // If still weight remaining, add one more truck
    if (remainingWeight > 0) {
        trucksNeeded += 1;
    }
    
    return {
        trucks: trucksNeeded,
        vehicles: vehiclesUsed
    };
}

// Calculate delivery fee based on address
async function calculateDeliveryFee(deliveryAddress) {
    if (!deliveryAddress) {
        return { distance: 0, fee: 0 };
    }
    
    // Check cache first
    const cacheKey = deliveryAddress.toLowerCase().trim();
    if (deliveryFeeCache[cacheKey]) {
        return deliveryFeeCache[cacheKey];
    }
    
    try {
        const response = await fetch(`../api/calculate_delivery_fee.php?address=${encodeURIComponent(deliveryAddress)}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const result = {
                    distance: parseFloat(data.distance) || 0,
                    fee: parseFloat(data.delivery_fee) || 0
                };
                // Cache the result
                deliveryFeeCache[cacheKey] = result;
                return result;
            }
        }
    } catch (error) {
        // Silently handle error
    }
    
    // Return default if API fails
    return { distance: 0, fee: 0 };
}

// Get order weight from order items
async function getOrderWeight(orderId) {
    try {
        const response = await fetch(`../api/get_orders.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.order && data.order.items) {
                let totalWeightKg = 0;
                
                data.order.items.forEach(item => {
                    if (item.weight && item.Quantity) {
                        let weightKg = parseFloat(item.weight) || 0;
                        const unit = item.weight_unit || 'kg';
                        
                        // Convert to kg
                        switch(unit) {
                            case 'g': weightKg = weightKg / 1000; break;
                            case 'lb': weightKg = weightKg * 0.453592; break;
                            case 'oz': weightKg = weightKg * 0.0283495; break;
                            case 'ton': weightKg = weightKg * 1000; break;
                        }
                        
                        totalWeightKg += weightKg * parseInt(item.Quantity);
                    }
                });
                
                return totalWeightKg;
            }
        }
    } catch (error) {
        // Silently handle error
    }
    
    return 0;
}

// Create order card HTML for Kanban board
async function createOrderCard(order) {
    try {
        const orderId = order.Order_ID;
        const customerName = order.customer_name || 'Unknown Customer';
        const orderDate = formatDate(order.order_date);
        const status = order.status || 'Pending Approval';
        const payment = order.payment || 'To Pay';
        const amount = formatPrice(order.amount);
        const availabilityDate = order.availability_date ? formatDate(order.availability_date) : 'N/A';
        const deliveryAddress = order.address || '';
        // Get delivery method
        const deliveryMethod = order.delivery_method || 'Standard Delivery';
        // Normalize delivery status for consistent display
        const rawDeliveryStatus = order.Delivery_Status || 'Pending';
        const deliveryStatus = normalizeDeliveryStatus(rawDeliveryStatus);
        
        const isRejected = status === 'Rejected';
        const isApproved = !isRejected; // No approval step - all non-rejected orders are "approved"
        
        // Get payment method (only show if order is approved and payment method exists)
        const paymentMethod = (isApproved && order.payment_method && 
                              order.payment_method !== 'null' && 
                              order.payment_method !== 'NULL' && 
                              typeof order.payment_method === 'string' &&
                              order.payment_method.trim() !== '') 
                              ? order.payment_method : null;
        
        // Determine status class
        let statusClass = 'pending';
        if (status === 'Processing') {
            statusClass = 'processing';
        } else if (status === 'Ready') {
            statusClass = 'ready';
        }
    
    // Action buttons (no Approve/Reject - orders go directly to payment)
    let actionButtons = '';
    if (status === 'Ready') {
        // Check if delivery is already "Out for Delivery"
        const isOutForDelivery = deliveryStatus === 'Out for Delivery';
        
        if (isOutForDelivery) {
            // Already out for delivery - show unclickable status button
            actionButtons = `
                <a href="../Admin/ViewOrderAccept.html?order_id=${orderId}" class="order-card-btn view-btn" title="View Order Details">
                    <i class="fas fa-eye"></i> View
                </a>
                <button class="order-card-btn" style="cursor: not-allowed; opacity: 0.7;" disabled title="Out for Delivery">
                    <i class="fas fa-truck mr-2"></i>Out for Delivery
                </button>
                <a href="../Admin/DeliveriesAdmin.html" class="order-card-btn track-delivery-btn" title="Track Delivery">
                    <i class="fas fa-map-marker-alt"></i> Track Delivery
                </a>
            `;
        } else {
            // Not yet out for delivery - show "Ready for Delivery" button
            actionButtons = `
                <a href="../Admin/ViewOrderAccept.html?order_id=${orderId}" class="order-card-btn view-btn" title="View Order Details">
                    <i class="fas fa-eye"></i> View
                </a>
                <button class="order-card-btn ready-delivery-btn" onclick="setReadyForDelivery(${orderId})" title="Mark as Ready for Delivery">
                    <i class="fas fa-truck"></i> Ready for Delivery
                </button>
                <a href="../Admin/DeliveriesAdmin.html" class="order-card-btn track-delivery-btn" title="Track Delivery">
                    <i class="fas fa-map-marker-alt"></i> Track Delivery
                </a>
            `;
        }
    } else {
        actionButtons = `
            <a href="../Admin/ViewOrderAccept.html?order_id=${orderId}" class="order-card-btn view-btn" title="View Order Details">
                <i class="fas fa-eye"></i> View
            </a>
        `;
    }
    
    return `
        <div class="order-card ${statusClass}" data-order-id="${orderId}">
            <div class="order-card-header">
                <span class="order-id">ORD-${orderId.toString().padStart(4, '0')}</span>
                <span class="order-amount">${amount}</span>
            </div>
            <div class="order-card-body">
                <div class="customer-name">${escapeHtml(customerName)}</div>
                <div class="order-meta">
                    <div class="order-meta-item">
                        <i class="fas fa-calendar"></i>
                        <span>${orderDate}</span>
                    </div>
                    <div class="order-meta-item">
                        <i class="fas fa-clock"></i>
                        <span>Available: ${availabilityDate}</span>
                    </div>
                </div>
            </div>
            <div class="order-card-footer">
                ${actionButtons}
            </div>
        </div>
    `;
    } catch (error) {
        console.error('[Create Order Card] Error creating card for order:', order.Order_ID, error);
        // Return a minimal error card
        return `
            <div class="order-card pending" data-order-id="${order.Order_ID || 'unknown'}">
                <div class="order-card-header">
                    <span class="order-id">ORD-${(order.Order_ID || 0).toString().padStart(4, '0')}</span>
                    <span class="order-amount">Error</span>
                </div>
                <div class="order-card-body">
                    <div class="customer-name">Error loading order</div>
                    <div class="text-danger small">${error.message || 'Unknown error'}</div>
                </div>
            </div>
        `;
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Track last known order IDs to detect new orders
let lastKnownOrderIds = new Set();
let isInitialLoad = true;

// Load orders
async function loadOrders() {
    try {
        const response = await fetch('../api/get_orders.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.orders) {
            // Get current order IDs
            const currentOrderIds = new Set(data.orders.map(order => order.Order_ID));
            
            // Detect new orders (only after initial load)
            if (!isInitialLoad) {
                const newOrderIds = [];
                currentOrderIds.forEach(orderId => {
                    if (!lastKnownOrderIds.has(orderId)) {
                        newOrderIds.push(orderId);
                    }
                });
                
                // Show notification if new orders detected
                if (newOrderIds.length > 0) {
                    const newOrders = data.orders.filter(order => newOrderIds.includes(order.Order_ID));
                    const customerNames = newOrders.map(order => order.customer_name || 'Unknown').join(', ');
                    const orderCount = newOrderIds.length;
                    
                    // Show popup notification
                    if (typeof AdminNotifications !== 'undefined') {
                        AdminNotifications.info(
                            `${orderCount} new order${orderCount > 1 ? 's' : ''} received! ${orderCount > 1 ? 'Customers' : 'Customer'}: ${customerNames}`,
                            {
                                title: 'New Order Alert',
                                duration: 8000,
                                showProgress: true
                            }
                        );
                    }
                }
            } else {
                // Mark initial load as complete
                isInitialLoad = false;
            }
            
            // Update last known order IDs
            lastKnownOrderIds = currentOrderIds;
            
            // Categorize orders by status for tabs (no Pending Approval - orders go directly to Waiting Payment)
            const processingOrders = [];
            const readyOrders = [];
            const waitingPaymentOrders = [];
            const rejectedOrders = [];
            
            data.orders.forEach(order => {
                const status = order.status || 'Waiting Payment';
                // Treat legacy "Pending Approval" as Waiting Payment (no approval step)
                const effectiveStatus = status === 'Pending Approval' ? 'Waiting Payment' : status;
                
                if (effectiveStatus === 'Processing') {
                    processingOrders.push(order);
                } else if (effectiveStatus === 'Ready') {
                    readyOrders.push(order);
                } else if (effectiveStatus === 'Waiting Payment') {
                    waitingPaymentOrders.push(order);
                } else if (effectiveStatus === 'Rejected') {
                    rejectedOrders.push(order);
                } else {
                    waitingPaymentOrders.push(order);
                }
            });
            
            // Get tab card containers
            const processingCards = document.getElementById('processingCards');
            const readyCards = document.getElementById('readyCards');
            const waitingPaymentCards = document.getElementById('waitingPaymentCards');
            const rejectedCards = document.getElementById('rejectedCards');
            
            // Display orders in their respective tab containers (load in parallel for better performance)
            if (processingOrders.length === 0 && processingCards) {
                processingCards.innerHTML = '<div class="text-center py-5"><p class="text-muted">No processing orders</p></div>';
            } else if (processingCards) {
                const cardPromises = processingOrders.map(order => createOrderCard(order));
                const cardHtmls = await Promise.all(cardPromises);
                processingCards.innerHTML = cardHtmls.join('');
            }
            
            if (readyOrders.length === 0 && readyCards) {
                readyCards.innerHTML = '<div class="text-center py-5"><p class="text-muted">No ready orders</p></div>';
            } else if (readyCards) {
                const cardPromises = readyOrders.map(order => createOrderCard(order));
                const cardHtmls = await Promise.all(cardPromises);
                readyCards.innerHTML = cardHtmls.join('');
            }
            
            if (waitingPaymentOrders.length === 0 && waitingPaymentCards) {
                waitingPaymentCards.innerHTML = '<div class="text-center py-5"><p class="text-muted">No waiting payment orders</p></div>';
            } else if (waitingPaymentCards) {
                const cardPromises = waitingPaymentOrders.map(order => createOrderCard(order));
                const cardHtmls = await Promise.all(cardPromises);
                waitingPaymentCards.innerHTML = cardHtmls.join('');
            }
            
            if (rejectedOrders.length === 0 && rejectedCards) {
                rejectedCards.innerHTML = '<div class="text-center py-5"><p class="text-muted">No rejected orders</p></div>';
            } else if (rejectedCards) {
                const cardPromises = rejectedOrders.map(order => createOrderCard(order));
                const cardHtmls = await Promise.all(cardPromises);
                rejectedCards.innerHTML = cardHtmls.join('');
            }
            
            // Update tab counts
            const processingCountEl = document.getElementById('processingCount');
            const readyCountEl = document.getElementById('readyCount');
            const waitingPaymentCountEl = document.getElementById('waitingPaymentCount');
            const rejectedCountEl = document.getElementById('rejectedCount');
            
            if (processingCountEl) processingCountEl.textContent = processingOrders.length;
            if (readyCountEl) readyCountEl.textContent = readyOrders.length;
            if (waitingPaymentCountEl) waitingPaymentCountEl.textContent = waitingPaymentOrders.length;
            if (rejectedCountEl) rejectedCountEl.textContent = rejectedOrders.length;
            
            // Ensure event delegation is setup after adding cards
            if (!eventDelegationSetup) {
                setupEventDelegation();
            }
            
            // Update statistics
            updateStatistics(data.orders);
        } else {
            // Silently handle failed load
        }
    } catch (error) {
        console.error('[Load Orders] Error loading orders:', error);
        // Show error message to user
        const processingCards = document.getElementById('processingCards');
        const readyCards = document.getElementById('readyCards');
        const waitingPaymentCards = document.getElementById('waitingPaymentCards');
        const rejectedCards = document.getElementById('rejectedCards');
        
        const errorMessage = '<div class="text-center py-5"><p class="text-danger">Error loading orders. Please refresh the page.</p><p class="text-muted small">' + (error.message || 'Unknown error') + '</p></div>';
        
        if (processingCards) processingCards.innerHTML = errorMessage;
        if (readyCards) readyCards.innerHTML = errorMessage;
        if (waitingPaymentCards) waitingPaymentCards.innerHTML = errorMessage;
        if (rejectedCards) rejectedCards.innerHTML = errorMessage;
    }
}

// Update statistics
function updateStatistics(orders) {
    const totalOrders = orders.length;
    
    // Pending Payments: Orders awaiting customer payment (includes legacy Pending Approval)
    const pendingPayments = orders.filter(o => {
        const status = (o.status || '').trim();
        return status === 'Waiting Payment' || status === 'Pending Approval';
    }).length;
    
    // In Progress: Orders that are being processed
    // Status values: 'Processing' (new) or 'Being Processed' (legacy)
    const inProgress = orders.filter(o => {
        const status = (o.status || '').trim();
        return status === 'Processing' || status === 'Being Processed';
    }).length;
    
    // Completed: Orders that are ready/completed
    // Status values: 'Ready' (new) or 'Completed' (legacy)
    const completed = orders.filter(o => {
        const status = (o.status || '').trim();
        return status === 'Ready' || status === 'Completed';
    }).length;
    
    const totalOrdersEl = document.getElementById('totalOrders');
    const pendingPaymentsEl = document.getElementById('pendingPayments');
    const inProgressEl = document.getElementById('inProgress');
    const completedEl = document.getElementById('completed');
    
    if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
    if (pendingPaymentsEl) pendingPaymentsEl.textContent = pendingPayments;
    if (inProgressEl) inProgressEl.textContent = inProgress;
    if (completedEl) completedEl.textContent = completed;
    
    // Statistics updated silently
}

// Update payment status
async function updatePaymentStatus(orderId, paymentStatus) {
    
    // Check if order is approved (not pending approval or rejected)
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    if (row) {
        const paymentDropdown = row.querySelector('.payment-dropdown');
        if (paymentDropdown && paymentDropdown.disabled) {
            if (window.AdminNotifications) {
                AdminNotifications.warning('Cannot update payment status. Order must be approved first.', { duration: 4000 });
            }
            return;
        }
    }
    
    // Get the dropdown element to store previous value
    const dropdown = document.querySelector(`.payment-dropdown[data-order-id="${orderId}"]`);
    const previousValue = dropdown ? dropdown.value : null;
    
    const confirmed = await AdminNotifications.confirm(
        `Change payment status to "${paymentStatus}"?`,
        {
            title: 'Change Payment Status',
            confirmText: 'Change',
            cancelText: 'Cancel'
        }
    );
    
    if (!confirmed) {
        // Reset dropdown to previous value
        if (dropdown && previousValue) {
            dropdown.value = previousValue;
        }
        return;
    }
    
    try {
        const response = await fetch('../api/update_payment_status.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                order_id: parseInt(orderId),
                payment_status: paymentStatus
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Payment status updated successfully
            if (window.AdminNotifications) {
                AdminNotifications.success('Payment status updated successfully!', { duration: 3000 });
            }
            
            // Reload orders to reflect changes
            await loadOrders();
            
            // Trigger inventory update (works even if not on inventory page - function will check)
            setTimeout(() => {
                if (window.loadInventory) {
                    window.loadInventory();
                }
            }, 500);
        } else {
            const errorMessage = (data.message || 'Unknown error').replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
            if (window.AdminNotifications) {
                AdminNotifications.error('Failed to update payment status: ' + errorMessage, { duration: 5000 });
            }
            // Reload to reset dropdown
            await loadOrders();
        }
    } catch (error) {
        if (window.AdminNotifications) {
            AdminNotifications.error('Failed to update payment status. Please try again.', { duration: 5000 });
        }
        // Reload to reset dropdown
        await loadOrders();
    }
}

// Track approval in progress to prevent double-clicks
let approvalInProgress = false;

// Approve order
async function approveOrder(orderId) {
    orderId = parseInt(orderId);
    
    // Prevent double-clicks
    if (approvalInProgress) {
        console.warn('Approval already in progress, ignoring duplicate request');
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.warning('Approval request already in progress. Please wait...', { duration: 3000 });
        }
        return;
    }
    
    if (!orderId || isNaN(orderId)) {
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.warning('Invalid order ID', { duration: 4000 });
        }
        return;
    }
    
    const confirmed = await AdminNotifications.confirm(
        `Approve order ORD-${orderId.toString().padStart(4, '0')}? The customer will be able to proceed with payment.`,
        {
            title: 'Approve Order',
            confirmText: 'Approve',
            cancelText: 'Cancel'
        }
    );
    
    if (!confirmed) {
        return;
    }
    
    // Set flag and disable buttons
    approvalInProgress = true;
    const approveButtons = document.querySelectorAll(`.approve-btn[onclick*="${orderId}"], .approve-order-btn[data-order-id="${orderId}"]`);
    approveButtons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';
        const originalHTML = btn.innerHTML;
        btn.dataset.originalHTML = originalHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Approving...';
    });
    
    try {
        const response = await fetch('../api/approve_order.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            cache: 'no-cache',
            body: JSON.stringify({
                order_id: orderId
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            if (typeof AdminNotifications !== 'undefined') {
                AdminNotifications.success('Order approved successfully!', { duration: 3000 });
            }
            await loadOrders();
        } else {
            // Check if order was already approved (race condition)
            if (data.already_approved || (data.message && data.message.includes('not pending approval'))) {
                if (typeof AdminNotifications !== 'undefined') {
                    AdminNotifications.warning('Order was already approved. Refreshing list...', { duration: 3000 });
                }
                // Reload to get current status
                await loadOrders();
            } else {
                const errorMessage = (data.message || 'Unknown error').replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
                if (typeof AdminNotifications !== 'undefined') {
                    AdminNotifications.error('Failed to approve order: ' + errorMessage, { duration: 5000 });
                }
            }
        }
    } catch (error) {
        console.error('Error approving order:', error);
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.error('Failed to approve order. Please try again.', { duration: 5000 });
        }
    } finally {
        // Re-enable buttons
        approvalInProgress = false;
        approveButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '';
            btn.style.cursor = '';
            if (btn.dataset.originalHTML) {
                btn.innerHTML = btn.dataset.originalHTML;
            }
        });
    }
}

// Reject order
// Set order as Ready for Delivery (updates delivery status to "Out for Delivery" and sends email)
// Show modal for driver and vehicle assignment (for order cards)
async function setReadyForDelivery(orderId) {
    if (!orderId) {
        console.error('[Ready for Delivery] Order ID is required');
        if (window.AdminNotifications) {
            AdminNotifications.error('Order ID not found. Please refresh the page.', { duration: 5000 });
        }
        return;
    }
    
    await showAssignDriverVehicleModalOrders(orderId);
}

// Show modal for driver and vehicle assignment (OrdersAdmin page)
async function showAssignDriverVehicleModalOrders(orderId) {
    const modal = document.getElementById('assignDriverVehicleModal');
    const driverSelect = document.getElementById('driverSelectOrders');
    const vehicleSelect = document.getElementById('vehicleSelectOrders');
    const assignError = document.getElementById('assignErrorOrders');
    const assignLoading = document.getElementById('assignLoadingOrders');
    
    if (!modal || !driverSelect || !vehicleSelect) {
        console.error('Assignment modal elements not found');
        return;
    }
    
    // Reset form
    assignError.style.display = 'none';
    assignError.textContent = '';
    driverSelect.innerHTML = '<option value="">Loading drivers...</option>';
    vehicleSelect.innerHTML = '<option value="">Loading vehicles...</option>';
    
    // Show modal
    $(modal).modal('show');
    
    // Load drivers and vehicles
    try {
        // Load drivers
        const driversResponse = await fetch('../api/get_delivery_drivers.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (driversResponse.ok) {
            const driversData = await driversResponse.json();
            if (driversData.success && driversData.drivers) {
                driverSelect.innerHTML = '<option value="">Select a driver</option>';
                driversData.drivers.forEach(driver => {
                    const option = document.createElement('option');
                    option.value = driver.user_id;
                    option.textContent = `${driver.full_name}${driver.active_deliveries > 0 ? ` (${driver.active_deliveries} active)` : ' (Available)'}`;
                    driverSelect.appendChild(option);
                });
            } else {
                driverSelect.innerHTML = '<option value="">No drivers available</option>';
            }
        } else {
            driverSelect.innerHTML = '<option value="">Error loading drivers</option>';
        }
        
        // Load vehicles
        const vehiclesResponse = await fetch('../api/get_fleet.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (vehiclesResponse.ok) {
            const vehiclesData = await vehiclesResponse.json();
            if (vehiclesData.success && vehiclesData.vehicles) {
                vehicleSelect.innerHTML = '<option value="">Select a vehicle</option>';
                vehiclesData.vehicles.forEach(vehicle => {
                    const option = document.createElement('option');
                    option.value = vehicle.vehicle_id;
                    const statusText = vehicle.status === 'Available' ? 'Available' : vehicle.status;
                    const activeText = vehicle.active_deliveries > 0 ? ` (${vehicle.active_deliveries} active)` : '';
                    option.textContent = `${vehicle.vehicle_model} - ${statusText}${activeText}`;
                    vehicleSelect.appendChild(option);
                });
            } else {
                vehicleSelect.innerHTML = '<option value="">No vehicles available</option>';
            }
        } else {
            vehicleSelect.innerHTML = '<option value="">Error loading vehicles</option>';
        }
    } catch (error) {
        console.error('Error loading drivers/vehicles:', error);
        assignError.textContent = 'Error loading drivers or vehicles. Please try again.';
        assignError.style.display = 'block';
    }
    
    // Setup confirm button
    const confirmBtn = document.getElementById('confirmAssignBtnOrders');
    if (confirmBtn) {
        // Remove any existing event listeners by cloning
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.onclick = async function() {
            await handleDriverVehicleAssignmentOrders(orderId, driverSelect.value, vehicleSelect.value);
        };
    }
}

// Handle driver and vehicle assignment (OrdersAdmin page)
async function handleDriverVehicleAssignmentOrders(orderId, driverId, vehicleId) {
    const assignError = document.getElementById('assignErrorOrders');
    const assignLoading = document.getElementById('assignLoadingOrders');
    const confirmBtn = document.getElementById('confirmAssignBtnOrders');
    
    // Validate
    if (!driverId || !vehicleId) {
        assignError.textContent = 'Please select both a driver and a vehicle.';
        assignError.style.display = 'block';
        return;
    }
    
    // Show loading
    assignError.style.display = 'none';
    assignLoading.style.display = 'block';
    if (confirmBtn) confirmBtn.disabled = true;
    
    try {
        // First, get or create delivery record
        let deliveryId = null;
        const deliveryResponse = await fetch(`../api/get_delivery_by_order.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (deliveryResponse.ok) {
            const deliveryData = await deliveryResponse.json();
            if (deliveryData.success && deliveryData.delivery) {
                deliveryId = deliveryData.delivery.Delivery_ID;
            }
        }
        
        // If no delivery exists, update delivery status will create it
        // Update delivery status to "Out for Delivery" with driver assignment
        const statusResponse = await fetch('../api/update_delivery_status.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                order_id: orderId,
                delivery_id: deliveryId,
                status: 'Out for Delivery',
                driver_id: parseInt(driverId)
            })
        });
        
        const statusData = await statusResponse.json();
        
        if (!statusData.success) {
            throw new Error(statusData.message || 'Failed to update delivery status');
        }
        
        // Get the delivery ID from the response or use the one we found
        const finalDeliveryId = statusData.delivery_id || deliveryId;
        
        if (!finalDeliveryId) {
            throw new Error('Delivery ID not found after status update');
        }
        
        // Assign vehicle
        const vehicleResponse = await fetch('../api/assign_vehicle.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                delivery_id: finalDeliveryId,
                vehicle_id: parseInt(vehicleId)
            })
        });
        
        const vehicleData = await vehicleResponse.json();
        
        if (!vehicleData.success) {
            throw new Error(vehicleData.message || 'Failed to assign vehicle');
        }
        
        // Success - close modal and reload orders
        $('#assignDriverVehicleModal').modal('hide');
        
        if (window.AdminNotifications) {
            AdminNotifications.success('Driver and vehicle assigned successfully. Order is now Out for Delivery.', {
                duration: 5000
            });
        }
        
        // Reload orders to reflect the changes
        setTimeout(() => {
            loadOrders();
        }, 1000);
        
    } catch (error) {
        console.error('Error assigning driver/vehicle:', error);
        assignError.textContent = error.message || 'Failed to assign driver and vehicle. Please try again.';
        assignError.style.display = 'block';
    } finally {
        assignLoading.style.display = 'none';
        if (confirmBtn) confirmBtn.disabled = false;
    }
}

async function rejectOrder(orderId) {
    orderId = parseInt(orderId);
    
    if (!orderId || isNaN(orderId)) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Invalid order ID', { duration: 4000 });
        }
        return;
    }
    
    // Use custom prompt dialog for rejection reason
    const rejectionReason = await AdminNotifications.prompt(
        'Please provide a reason for rejecting this order (optional):',
        '',
        {
            title: 'Reject Order',
            placeholder: 'Enter rejection reason (optional)',
            confirmText: 'Continue',
            cancelText: 'Cancel'
        }
    );
    
    if (rejectionReason === null) {
        // User cancelled
        return;
    }
    
    // Use custom confirmation dialog
    const confirmed = await AdminNotifications.confirm(
        `Reject order ORD-${orderId.toString().padStart(4, '0')}? This action cannot be undone.`,
        {
            title: 'Confirm Rejection',
            confirmText: 'Reject',
            cancelText: 'Cancel',
            danger: true
        }
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch('../api/reject_order.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                order_id: orderId,
                rejection_reason: rejectionReason || null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            AdminNotifications.success('Order rejected successfully.', { duration: 3000 });
            await loadOrders();
        } else {
            AdminNotifications.error('Failed to reject order: ' + (data.message || 'Unknown error'), {
                details: data
            });
        }
    } catch (error) {
        AdminNotifications.error('Failed to reject order. Please try again.', {
            details: { error: error.message }
        });
    }
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
    // Ensure orderId is a number and newStatus is a string
    orderId = parseInt(orderId);
    newStatus = String(newStatus).trim();
    
    if (!orderId || !newStatus) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Invalid order ID or status', { duration: 4000 });
        }
        return;
    }
    
    // Check if order is approved (not pending approval or rejected)
    // We need to check the current order status from the table
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    if (row) {
        const statusDropdown = row.querySelector('.status-dropdown');
        if (statusDropdown && statusDropdown.disabled) {
            if (window.AdminNotifications) {
                AdminNotifications.warning('Cannot update status. Order must be approved first.', { duration: 4000 });
            }
            return;
        }
    }
    
    // Get the dropdown element to store previous value
    const dropdown = document.querySelector(`.status-dropdown[data-order-id="${orderId}"]`);
    const previousValue = dropdown ? dropdown.value : null;
    
    const confirmed = await AdminNotifications.confirm(
        `Change order status to "${newStatus}"?`,
        {
            title: 'Change Order Status',
            confirmText: 'Change',
            cancelText: 'Cancel'
        }
    );
    
    if (!confirmed) {
        // Reset dropdown to previous value
        if (dropdown && previousValue) {
            dropdown.value = previousValue;
        }
        return;
    }
    
    try {
        const requestBody = {
            order_id: orderId,
            status: newStatus
        };
        
        const response = await fetch('../api/update_order_status.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            // Filter out localhost URLs from error messages
            const cleanErrorText = errorText.replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Show message with stock reduction info if applicable
            let message = 'Order status updated successfully!';
            if (data.stock_reduced) {
                message += '\n\nStock levels have been reduced for all products in this order.';
            }
            if (window.AdminNotifications) {
                AdminNotifications.success(message, { duration: 5000 });
            }
            
            // If status changed to Ready, switch to Ready tab
            if (newStatus === 'Ready') {
                // Switch to Ready tab
                $('.tab-btn').removeClass('active');
                $('.tab-content').removeClass('active');
                $('#ready-tab').addClass('active');
                $('#ready-content').addClass('active');
            }
            
            // Reload orders to reflect changes
            await loadOrders();
            
            // Trigger inventory update if stock was reduced (works even if not on inventory page)
            if (data.stock_reduced) {
                setTimeout(() => {
                    if (window.loadInventory) {
                        window.loadInventory();
                    }
                }, 1000);
            }
        } else {
            const errorMessage = (data.message || 'Unknown error').replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
            if (window.AdminNotifications) {
                AdminNotifications.error('Failed to update order status: ' + errorMessage, { duration: 5000 });
            }
            // Reload to reset dropdown
            await loadOrders();
        }
    } catch (error) {
        if (window.AdminNotifications) {
            AdminNotifications.error('Failed to update order status. Please try again.', { duration: 5000 });
        }
        // Reload to reset dropdown
        await loadOrders();
    }
}

// Download order (placeholder)
function downloadOrder(orderId) {
    if (window.AdminNotifications) {
        AdminNotifications.info(`Download order ${orderId} (Feature coming soon)`, {
            title: 'Download Order',
            duration: 4000
        });
    }
}

// Delete order
async function deleteOrder(orderId) {
    // Ensure orderId is a number
    orderId = parseInt(orderId);
    
    if (!orderId || isNaN(orderId)) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Invalid order ID', { duration: 4000 });
        }
        return;
    }
    
    // Use custom confirmation dialog
    const confirmed = await AdminNotifications.confirm(
        `Are you sure you want to delete order ORD-${orderId.toString().padStart(4, '0')}? This action cannot be undone.`,
        {
            title: 'Delete Order',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        }
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch('../api/delete_order.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                order_id: orderId
            })
        });
        
        // Try to parse response
        let data;
        try {
            const responseText = await response.text();
            // Filter out localhost URLs from response
            const cleanResponseText = responseText.replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
            data = JSON.parse(cleanResponseText || responseText);
        } catch (parseError) {
            throw new Error('Invalid response from server');
        }
        
        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }
        
        if (data.success) {
            AdminNotifications.success('Order deleted successfully!', { duration: 3000 });
            
            // Reload orders to reflect changes
            await loadOrders();
        } else {
            throw new Error(data.message || 'Failed to delete order');
        }
    } catch (error) {
        AdminNotifications.error('Failed to delete order: ' + error.message, {
            details: { error: error.message }
        });
    }
}

// Setup event delegation for dropdowns (backup in case inline handlers don't work)
// NOTE: We're using event delegation as the PRIMARY method since inline handlers may not work reliably
let eventDelegationSetup = false;
function setupEventDelegation() {
    if (eventDelegationSetup) {
        return;
    }
    
    // Use event delegation for status dropdowns
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('status-dropdown')) {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            const newStatus = e.target.value.trim();
            if (orderId && newStatus) {
                // Prevent inline handler from also firing
                e.stopImmediatePropagation();
                updateOrderStatus(orderId, newStatus);
            }
        }
        
        if (e.target.classList.contains('payment-dropdown')) {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            const paymentStatus = e.target.value.trim();
            if (orderId && paymentStatus) {
                // Prevent inline handler from also firing
                e.stopImmediatePropagation();
                updatePaymentStatus(orderId, paymentStatus);
            }
        }
    });
    
    eventDelegationSetup = true;
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setupEventDelegation();
        loadOrders();
    });
} else {
    setupEventDelegation();
    loadOrders();
}

// Auto-refresh every 15 seconds to detect new orders faster
setInterval(loadOrders, 15000);

// Export functions for global access
window.updatePaymentStatus = updatePaymentStatus;
window.updateOrderStatus = updateOrderStatus;
window.downloadOrder = downloadOrder;
window.deleteOrder = deleteOrder;
window.loadOrders = loadOrders;
window.approveOrder = approveOrder;
window.rejectOrder = rejectOrder;

